use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default)]
pub struct AppSettings {
    pub default_data_dir: String,
    pub default_ram_mb: u32,
    pub default_cpu_limit: f32,
    pub auto_pull_images: bool,
    pub setup_completed: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_data_dir: String::new(),
            default_ram_mb: 2048,
            default_cpu_limit: 0.0,
            auto_pull_images: true,
            setup_completed: false,
        }
    }
}

pub struct AppSettingsState(pub Mutex<AppSettings>);

fn settings_path() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("ShadowHost").join("settings.json")
}

pub fn load_from_disk() -> AppSettings {
    let path = settings_path();
    match std::fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).unwrap_or_default(),
        Err(_) => AppSettings::default(),
    }
}

fn save_to_disk(settings: &AppSettings) -> Result<(), String> {
    let path = settings_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    std::fs::write(&path, text).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_settings(state: tauri::State<AppSettingsState>) -> AppSettings {
    state.0.lock().unwrap().clone()
}

#[tauri::command]
pub fn save_settings(
    new_settings: AppSettings,
    state: tauri::State<AppSettingsState>,
) -> Result<AppSettings, String> {
    let mut guard = state.0.lock().unwrap();
    *guard = new_settings.clone();
    save_to_disk(&new_settings)?;
    Ok(new_settings)
}

#[tauri::command]
pub fn mark_setup_complete(state: tauri::State<AppSettingsState>) -> Result<(), String> {
    let mut guard = state.0.lock().unwrap();
    guard.setup_completed = true;
    save_to_disk(&guard)?;
    Ok(())
}
