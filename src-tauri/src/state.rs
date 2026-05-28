// state.rs
use crate::config::Config;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppState {
    pub config: Mutex<Config>,
    pub opened_files: Mutex<Vec<PathBuf>>,
}
