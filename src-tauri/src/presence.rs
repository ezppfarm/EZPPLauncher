use once_cell::sync::Lazy;
use presenceforge::{ActivityBuilder, AsyncDiscordIpcClient};
use std::sync::Mutex as StdMutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, RunEvent};
use tokio::sync::{mpsc, oneshot};
use tokio::time::{Duration, interval};

#[derive(Clone, Debug)]
pub struct PresenceButton {
    pub label: String,
    pub url: String,
}

#[derive(Clone, Debug)]
pub struct PresenceData {
    pub state: String,
    pub details: String,
    pub large_image_key: String,
    pub large_image_text: String,
    pub small_image_key: Option<String>,
    pub small_image_text: Option<String>,
    pub dynamic_button: Option<PresenceButton>,
}

impl Default for PresenceData {
    fn default() -> Self {
        Self {
            state: "Idle in Launcher...".to_string(),
            details: "  ".to_string(),
            large_image_key: "ezppfarm".to_string(),
            large_image_text: "EZPPFarm".to_string(),
            small_image_key: None,
            small_image_text: None,
            dynamic_button: None,
        }
    }
}

#[derive(Debug)]
enum PresenceCommand {
    Connect(oneshot::Sender<bool>),
    Disconnect(oneshot::Sender<()>),
    UpdateData(PresenceData),
    IsConnected(oneshot::Sender<bool>),
}

enum ReconnectResult {
    Connected(AsyncDiscordIpcClient),
    Failed,
}

struct PresenceActor {
    receiver: mpsc::Receiver<PresenceCommand>,
    reconnect_rx: mpsc::Receiver<ReconnectResult>,
    reconnect_tx: mpsc::Sender<ReconnectResult>,
    client: Option<AsyncDiscordIpcClient>,
    data: PresenceData,
    start_timestamp: i64,
    reconnecting: bool,
}

impl PresenceActor {
    fn new(receiver: mpsc::Receiver<PresenceCommand>) -> Self {
        let start = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let (reconnect_tx, reconnect_rx) = mpsc::channel(1);

        Self {
            receiver,
            reconnect_rx,
            reconnect_tx,
            client: None,
            data: PresenceData::default(),
            start_timestamp: start,
            reconnecting: false,
        }
    }

    async fn run(&mut self) {
        let mut heartbeat = interval(Duration::from_secs(5));
        heartbeat.tick().await;

        loop {
            tokio::select! {
                Some(cmd) = self.receiver.recv() => {
                    match cmd {
                        PresenceCommand::Connect(resp) => self.cmd_connect(resp).await,
                        PresenceCommand::Disconnect(resp) => self.cmd_disconnect(resp).await,
                        PresenceCommand::UpdateData(data) => {
                            self.data = data;
                            self.push_presence().await;
                        }
                        PresenceCommand::IsConnected(resp) => {
                            let _ = resp.send(self.client.is_some());
                        }
                    }
                }

                Some(result) = self.reconnect_rx.recv() => {
                    self.reconnecting = false;
                    match result {
                        ReconnectResult::Connected(client) => {
                            println!("Presence: reconnect succeeded.");
                            self.client = Some(client);
                            self.push_presence().await;
                        }
                        ReconnectResult::Failed => {
                            eprintln!("Presence: all reconnect attempts exhausted.");
                        }
                    }
                }

                _ = heartbeat.tick() => {
                    self.push_presence().await;
                }
            }
        }
    }

    async fn cmd_connect(&mut self, resp: oneshot::Sender<bool>) {
        if self.client.is_some() {
            let _ = resp.send(true);
            return;
        }

        match try_connect_once().await {
            Some(client) => {
                self.client = Some(client);
                self.reconnecting = false;
                self.push_presence().await;
                let _ = resp.send(true);
            }
            None => {
                eprintln!("Presence: initial connect failed; spawning reconnect task.");
                let _ = resp.send(false);
                self.spawn_reconnect_task();
            }
        }
    }

    async fn cmd_disconnect(&mut self, resp: oneshot::Sender<()>) {
        if let Some(mut client) = self.client.take() {
            let _ = client.clear_activity().await;
            println!("Presence: disconnected.");
        }
        let _ = resp.send(());
    }

    async fn push_presence(&mut self) {
        let client = match self.client.as_mut() {
            Some(c) => c,
            None => return,
        };

        let mut builder = ActivityBuilder::new()
            .state(&self.data.state)
            .details(&self.data.details)
            .start_timestamp(self.start_timestamp as u64)
            .large_image(&self.data.large_image_key)
            .large_text(&self.data.large_image_text);

        if let Some(key) = &self.data.small_image_key {
            builder = builder.small_image(key);
        }
        if let Some(text) = &self.data.small_image_text {
            builder = builder.small_text(text);
        }

        if let Some(btn) = &self.data.dynamic_button {
            builder = builder.button(&btn.label, &btn.url);
        } else {
            builder = builder.button(
                "Download the Launcher",
                "https://git.ez-pp.farm/EZPPFarm/EZPPLauncher/releases/latest",
            );
        }
        builder = builder.button("Join EZPPFarm", "https://ez-pp.farm/discord");

        let activity = builder.build();

        /* println!("Presence: updating activity: {:?}", activity); */
        if let Err(e) = client.set_activity(&activity).await {
            eprintln!("Presence: set_activity failed ({:?}); will reconnect.", e);
            self.client = None;
            self.spawn_reconnect_task();
        }
    }

    fn spawn_reconnect_task(&mut self) {
        if self.reconnecting {
            return;
        }
        self.reconnecting = true;

        let tx = self.reconnect_tx.clone();
        tokio::spawn(async move {
            const MAX_ATTEMPTS: u32 = 5;
            for attempt in 1..=MAX_ATTEMPTS {
                let delay = Duration::from_secs(5 * attempt as u64);
                println!(
                    "Presence: reconnect attempt {}/{} in {:?}…",
                    attempt, MAX_ATTEMPTS, delay
                );
                tokio::time::sleep(delay).await;

                if let Some(client) = try_connect_once().await {
                    let _ = tx.send(ReconnectResult::Connected(client)).await;
                    return;
                }
            }
            let _ = tx.send(ReconnectResult::Failed).await;
        });
    }
}

async fn try_connect_once() -> Option<AsyncDiscordIpcClient> {
    match AsyncDiscordIpcClient::new("1032772293220384808").await {
        Ok(mut client) => match client.connect().await {
            Ok(_) => {
                println!("Presence: IPC connected.");
                Some(client)
            }
            Err(e) => {
                eprintln!("Presence: IPC connect error: {:?}", e);
                None
            }
        },
        Err(e) => {
            eprintln!("Presence: failed to create client: {:?}", e);
            None
        }
    }
}

static PRESENCE_TX: Lazy<mpsc::Sender<PresenceCommand>> = Lazy::new(|| {
    let (tx, rx) = mpsc::channel(32);
    let mut actor = PresenceActor::new(rx);
    tokio::spawn(async move { actor.run().await });
    tx
});

pub static PRESENCE_DATA: Lazy<StdMutex<PresenceData>> =
    Lazy::new(|| StdMutex::new(PresenceData::default()));

pub async fn connect() -> bool {
    let (tx, rx) = oneshot::channel();
    if PRESENCE_TX.send(PresenceCommand::Connect(tx)).await.is_ok() {
        return rx.await.unwrap_or(false);
    }
    false
}

pub async fn disconnect() {
    let (tx, rx) = oneshot::channel();
    if PRESENCE_TX.send(PresenceCommand::Disconnect(tx)).await.is_ok() {
        let _ = tokio::time::timeout(Duration::from_secs(2), rx).await;
    }
}

pub async fn has_presence() -> bool {
    let (tx, rx) = oneshot::channel();
    if PRESENCE_TX
        .send(PresenceCommand::IsConnected(tx))
        .await
        .is_ok()
    {
        return rx.await.unwrap_or(false);
    }
    false
}

pub fn update_status(state: Option<&str>, details: Option<&str>, large_image_key: Option<&str>) {
    let data = {
        let mut guard = PRESENCE_DATA.lock().unwrap();
        if let Some(s) = state {
            guard.state = s.to_string();
        }
        if let Some(d) = details {
            guard.details = d.to_string();
        }
        if let Some(img) = large_image_key {
            guard.large_image_key = img.to_string();
        }
        guard.clone()
    };

    let tx = PRESENCE_TX.clone();
    tokio::spawn(async move {
        let _ = tx.send(PresenceCommand::UpdateData(data)).await;
    });
}

pub fn update_user(username: Option<&str>, id: Option<&str>) {
    let data = {
        let mut guard = PRESENCE_DATA.lock().unwrap();
        guard.small_image_key = id.map(|s| format!("https://a.ez-pp.farm/{}", s));
        guard.small_image_text = username.map(str::to_string);
        guard.clone()
    };

    let tx = PRESENCE_TX.clone();
    tokio::spawn(async move {
        let _ = tx.send(PresenceCommand::UpdateData(data)).await;
    });
}

pub fn set_button(label: &str, url: &str) {
    let data = {
        let mut guard = PRESENCE_DATA.lock().unwrap();
        guard.dynamic_button = Some(PresenceButton {
            label: label.to_string(),
            url: url.to_string(),
        });
        guard.clone()
    };

    let tx = PRESENCE_TX.clone();
    tokio::spawn(async move {
        let _ = tx.send(PresenceCommand::UpdateData(data)).await;
    });
}

pub fn clear_button() {
    let data = {
        let mut guard = PRESENCE_DATA.lock().unwrap();
        guard.dynamic_button = None;
        guard.clone()
    };

    let tx = PRESENCE_TX.clone();
    tokio::spawn(async move {
        let _ = tx.send(PresenceCommand::UpdateData(data)).await;
    });
}

pub fn handle_run_event(_app: &AppHandle, event: &RunEvent) {
    if let RunEvent::ExitRequested { .. } | RunEvent::Exit = event {
        tauri::async_runtime::block_on(async {
            disconnect().await;
        });
    }
}