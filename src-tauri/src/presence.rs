use discord_rich_presence::{
    DiscordIpc, DiscordIpcClient,
    activity::{Activity, Assets, Button, Timestamps},
};
use once_cell::sync::Lazy;
use std::future::Future;
use std::pin::Pin;
use std::sync::Mutex as StdMutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::{mpsc, oneshot};
use tokio::time::{Duration, interval};

#[derive(Clone, Debug)]
pub struct PresenceData {
    pub state: String,
    pub details: String,
    pub large_image_key: String,
    pub large_image_text: String,
    pub small_image_key: Option<String>,
    pub small_image_text: Option<String>,
}

#[derive(Debug)]
enum PresenceCommand {
    Connect(oneshot::Sender<bool>),
    Disconnect(oneshot::Sender<()>),
    UpdateData(PresenceData),
    IsConnected(oneshot::Sender<bool>),
    Tick,
}

struct PresenceActor {
    receiver: mpsc::Receiver<PresenceCommand>,
    client: Option<DiscordIpcClient>,
    data: PresenceData,
    start_timestamp: i64,
}

impl PresenceActor {
    fn new(receiver: mpsc::Receiver<PresenceCommand>) -> Self {
        let start = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let data = PresenceData {
            state: "Idle in Launcher...".to_string(),
            details: "  ".to_string(),
            large_image_key: "ezppfarm".to_string(),
            large_image_text: "EZPPFarm".to_string(),
            small_image_key: None,
            small_image_text: None,
        };

        PresenceActor {
            receiver,
            client: None,
            data,
            start_timestamp: start,
        }
    }

    async fn run(&mut self) {
        let mut update_interval = interval(Duration::from_secs(5));

        loop {
            tokio::select! {
                Some(cmd) = self.receiver.recv() => {
                    match cmd {
                        PresenceCommand::Connect(responder) => self.handle_connect(responder).await,
                        PresenceCommand::Disconnect(responder) => {
                            self.handle_disconnect(responder).await;
                        },
                        PresenceCommand::UpdateData(new_data) => {
                            self.data = new_data;
                        },
                        PresenceCommand::IsConnected(responder) => {
                            let _ = responder.send(self.client.is_some());
                        }
                        PresenceCommand::Tick => {
                            if self.client.is_some() {
                                self.handle_update().await;
                            }
                        }
                    }
                }
                _ = update_interval.tick() => {
                    let _ = PRESENCE_TX.send(PresenceCommand::Tick).await;
                }
            }
        }
    }

    fn handle_connect(
        &mut self,
        responder: oneshot::Sender<bool>,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        Box::pin(async move {
            if self.client.is_some() {
                let _ = responder.send(true);
                return;
            }

            println!("Actor: Connecting to Discord...");
            let mut dc_client = DiscordIpcClient::new("1032772293220384808");
            match dc_client.connect() {
                Ok(()) => {
                    self.client = Some(dc_client);
                    println!("Actor: Connected successfully.");
                    self.handle_update().await;
                    let _ = responder.send(true);
                }
                Err(e) => {
                    eprintln!(
                        "Failed to connect to Discord: {:?}. Scheduling bounded retry...",
                        e
                    );
                    let tx = PRESENCE_TX.clone();
                    tokio::spawn(async move {
                        for attempt in 1..=3 {
                            tokio::time::sleep(Duration::from_secs(5 * attempt)).await;
                            let (resp_tx, rx) = oneshot::channel();
                            if tx.send(PresenceCommand::Connect(resp_tx)).await.is_ok() {
                                if rx.await.unwrap_or(false) {
                                    println!("Actor: Reconnection attempt {} succeeded", attempt);
                                    break;
                                }
                                println!(
                                    "Actor: Reconnection attempt {} failed, retrying...",
                                    attempt
                                );
                            }
                        }
                    });

                    if !responder.is_closed() {
                        let _ = responder.send(false);
                    }
                }
            }
        })
    }

    async fn handle_disconnect(&mut self, responder: oneshot::Sender<()>) {
        if let Some(mut client) = self.client.take() {
            println!("Actor: Disconnecting from Discord...");
            let _ = client.clear_activity();
            let _ = client.close();
            println!("Actor: Disconnected successfully.");
        }
        let _ = responder.send(());
    }

    async fn handle_update(&mut self) {
        if let Some(client) = self.client.as_mut() {
            let mut assets = Assets::new()
                .large_image(&self.data.large_image_key)
                .large_text(&self.data.large_image_text);

            if let Some(key) = &self.data.small_image_key {
                assets = assets.small_image(key);
            }
            if let Some(text) = &self.data.small_image_text {
                assets = assets.small_text(text);
            }

            let activity = Activity::new()
                .state(&self.data.state)
                .details(&self.data.details)
                .timestamps(Timestamps::new().start(self.start_timestamp))
                .assets(assets)
                .buttons(vec![
                    Button::new(
                        "Download the Launcher",
                        "https://git.ez-pp.farm/EZPPFarm/EZPPLauncher/releases/latest",
                    ),
                    Button::new("Join EZPPFarm", "https://ez-pp.farm/discord"),
                ]);

            if let Err(e) = client.set_activity(activity) {
                eprintln!("Failed to set activity, disconnecting: {:?}", e);
                self.client = None;

                // Don't await reconnection here - send command to avoid blocking the actor
                let tx = PRESENCE_TX.clone();
                tokio::spawn(async move {
                    tokio::time::sleep(Duration::from_secs(1)).await;
                    let (resp_tx, _) = oneshot::channel();
                    let _ = tx.send(PresenceCommand::Connect(resp_tx)).await;
                });
            } else {
                println!("Actor: Presence updated successfully.");
            }
        }
    }
}

static PRESENCE_TX: Lazy<mpsc::Sender<PresenceCommand>> = Lazy::new(|| {
    let (tx, rx) = mpsc::channel(10);
    let mut actor = PresenceActor::new(rx);
    tokio::spawn(async move { actor.run().await });
    tx
});

pub static PRESENCE_DATA: Lazy<StdMutex<PresenceData>> = Lazy::new(|| {
    StdMutex::new(PresenceData {
        state: "Idle in Launcher...".to_string(),
        details: "  ".to_string(),
        large_image_key: "ezppfarm".to_string(),
        large_image_text: "EZPPFarm".to_string(),
        small_image_key: None,
        small_image_text: None,
    })
});

pub async fn connect() -> bool {
    let (tx, rx) = oneshot::channel();
    if PRESENCE_TX.send(PresenceCommand::Connect(tx)).await.is_ok() {
        return rx.await.unwrap_or(false);
    }
    false
}

pub async fn disconnect() {
    let (tx, rx) = oneshot::channel();
    // Use a timeout to ensure we don't hang the exit process if Discord is unresponsive
    if let Ok(_) = PRESENCE_TX.send(PresenceCommand::Disconnect(tx)).await {
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
    let mut data = PRESENCE_DATA.lock().unwrap();
    if let Some(s) = state {
        data.state = s.to_string();
    }
    if let Some(d) = details {
        data.details = d.to_string();
    }
    if let Some(img) = large_image_key {
        data.large_image_key = img.to_string();
    }
    let data_clone = data.clone();
    let tx = PRESENCE_TX.clone();
    tokio::spawn(async move {
        let _ = tx.send(PresenceCommand::UpdateData(data_clone)).await;
    });
}

pub fn update_user(username: Option<&str>, id: Option<&str>) {
    let mut data = PRESENCE_DATA.lock().unwrap();
    data.small_image_key = id.map(|id_str| format!("https://a.ez-pp.farm/{}", id_str));
    data.small_image_text = username.map(|s| s.to_string());
    let data_clone = data.clone();
    let tx = PRESENCE_TX.clone();
    tokio::spawn(async move {
        let _ = tx.send(PresenceCommand::UpdateData(data_clone)).await;
    });
}
