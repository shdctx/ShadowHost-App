mod docker;
mod eggs;
mod servers;
mod settings;
mod system;

use std::sync::Mutex;

use servers::ServersState;
use settings::AppSettingsState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_settings = settings::load_from_disk();
    let initial_servers = servers::load_from_disk();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .manage(AppSettingsState(Mutex::new(initial_settings)))
        .manage(ServersState(Mutex::new(initial_servers)))
        .invoke_handler(tauri::generate_handler![
            system::get_system_info,
            system::detect_java,
            settings::get_settings,
            settings::save_settings,
            settings::mark_setup_complete,
            docker::docker_status,
            docker::pull_image,
            docker::check_image,
            eggs::list_eggs,
            servers::list_servers,
            servers::create_server,
            servers::update_server,
            servers::delete_server,
            servers::start_server,
            servers::stop_server,
            servers::kill_server,
            servers::restart_server,
            servers::send_command,
            servers::server_runtime,
            servers::list_files,
            servers::read_file,
            servers::write_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
