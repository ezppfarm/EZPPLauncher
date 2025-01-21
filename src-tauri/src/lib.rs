mod reading_loop;
mod structs;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use crate::reading_loop::process_reading_loop;
use crate::structs::{State, StaticAddresses};
use eyre::Report;
use rosu_mem::{
    error::ProcessError,
    process::{Process, ProcessTraits},
};
use std::sync::{Arc, Mutex};
use std::{thread, time::Duration};
use structs::{InnerValues, OutputValues};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    println!("starting ezpplauncher!");
    osu_memory_reading();
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_fs::init());
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let app_window = app.get_webview_window("main").expect("no main window");
            app_window
                .set_always_on_top(true)
                .expect("failed to set always on top");
            app_window.set_focus().expect("failed to focus");
        }));
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn osu_memory_reading() {
    thread::spawn(|| {
        let output_values = Arc::new(Mutex::new(OutputValues::default()));
        let inner_values = InnerValues::default();

        let mut state = State {
            addresses: StaticAddresses::default(),
            ivalues: inner_values,
            values: output_values,
        };

        'init_loop: loop {
            println!("Searching for osu! process");
            let p = match Process::initialize("osu!.exe") {
                Ok(p) => p,
                Err(e) => {
                    println!("{:?}", Report::new(e));
                    thread::sleep(Duration::from_millis(5000));
                    continue 'init_loop;
                }
            };

            let mut values = state.values.lock().unwrap();

            println!("Using auto-detected osu! folder path");
            if let Some(ref dir) = p.executable_dir {
                values.osu_path.clone_from(dir);
            } else {
                println!(
                    "{:?}",
                    Report::msg(
                        "Can't auto-detect osu! folder path \
                         nor any was provided through command \
                         line argument",
                    )
                );
                continue 'init_loop;
            }

            if !values.osu_path.exists() {
                println!(
                    "Provided osu path doesn't exists!\n Path: {}",
                    &values.osu_path.to_str().unwrap()
                );

                println!(
                    "{:?}",
                    Report::msg(
                        "Can't auto-detect osu! folder path \
                     nor any was provided through command \
                     line argument",
                    )
                );
                continue 'init_loop;
            };

            drop(values);

            println!("Reading static signatures...");
            match StaticAddresses::new(&p) {
                Ok(v) => state.addresses = v,
                Err(e) => match e.downcast_ref::<ProcessError>() {
                    Some(&ProcessError::ProcessNotFound) => {
                        thread::sleep(Duration::from_millis(2000));
                        continue 'init_loop;
                    }
                    #[cfg(target_os = "windows")]
                    Some(&ProcessError::OsError { .. }) => {
                        println!("{:?}", e);
                        thread::sleep(Duration::from_millis(2000));
                        continue 'init_loop;
                    }
                    Some(_) | None => {
                        println!("{:?}", e);
                        thread::sleep(Duration::from_millis(2000));
                        continue 'init_loop;
                    }
                },
            };

            println!("osu! process found, Starting reading loop");

            'main_loop: loop {
                if let Err(e) = process_reading_loop(&p, &mut state) {
                    match e.downcast_ref::<ProcessError>() {
                        Some(&ProcessError::ProcessNotFound) => {
                            thread::sleep(Duration::from_millis(5000));
                            continue 'init_loop;
                        }
                        #[cfg(target_os = "windows")]
                        Some(&ProcessError::OsError { .. }) => {
                            println!("{:?}", e);
                            thread::sleep(Duration::from_millis(5000));
                            continue 'init_loop;
                        }
                        Some(_) | None => {
                            println!("{:?}", e);
                            thread::sleep(Duration::from_millis(5000));
                            continue 'main_loop;
                        }
                    }
                }
                let cloned_values = state.values.clone();
                let values_lock = cloned_values.lock().unwrap();
                let values = &*values_lock;

                println!("{:?}", values.current_stars);
                thread::sleep(Duration::from_millis(2000));
            }
        }
    });
}
