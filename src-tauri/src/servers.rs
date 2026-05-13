use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Mutex;
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Emitter, Manager};

use crate::docker;
use crate::eggs;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ServerDef {
    pub id: String,
    pub name: String,
    pub egg_id: String,
    pub image: String,
    pub data_dir: String,
    /// Host-Port → container port
    pub port: u16,
    /// "tcp" for Java, "udp" for Bedrock
    pub port_protocol: String,
    pub max_ram_mb: u32,
    pub cpu_limit: f32,
    pub env: HashMap<String, String>,
    pub stop_command: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(default)]
pub struct ServersFile {
    pub servers: Vec<ServerDef>,
}

pub struct ServersState(pub Mutex<ServersFile>);

#[derive(Serialize, Clone)]
pub struct LogPayload {
    pub server_id: String,
    pub stream: String,
    pub text: String,
}

#[derive(Serialize, Clone)]
pub struct StatusPayload {
    pub server_id: String,
    pub state: String,
}

fn servers_file_path() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("ShadowHost").join("servers.json")
}

pub fn load_from_disk() -> ServersFile {
    let path = servers_file_path();
    match std::fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).unwrap_or_default(),
        Err(_) => ServersFile::default(),
    }
}

fn save_to_disk(file: &ServersFile) -> Result<(), String> {
    let path = servers_file_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(file).map_err(|e| e.to_string())?;
    std::fs::write(&path, text).map_err(|e| e.to_string())?;
    Ok(())
}

fn container_name(id: &str) -> String {
    format!("shadowhost-{}", id)
}

#[tauri::command]
pub fn list_servers(state: tauri::State<ServersState>) -> Vec<ServerDef> {
    state.0.lock().unwrap().servers.clone()
}

#[derive(Deserialize, Debug)]
pub struct CreateServerInput {
    pub name: String,
    pub egg_id: String,
    pub port: u16,
    pub max_ram_mb: u32,
    pub cpu_limit: f32,
    pub data_dir: Option<String>,
    pub env_overrides: Option<HashMap<String, String>>,
}

fn slugify(name: &str) -> String {
    let mut out = String::new();
    for c in name.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
        } else if c == ' ' || c == '-' || c == '_' {
            out.push('-');
        }
    }
    while out.contains("--") {
        out = out.replace("--", "-");
    }
    out.trim_matches('-').to_string()
}

fn default_data_dir(slug: &str) -> PathBuf {
    let base = dirs::data_local_dir()
        .or_else(dirs::data_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("ShadowHost").join("servers").join(slug)
}

fn short_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{:x}", nanos)
}

#[tauri::command]
pub fn create_server(
    input: CreateServerInput,
    state: tauri::State<ServersState>,
) -> Result<ServerDef, String> {
    let egg =
        eggs::find_egg(&input.egg_id).ok_or_else(|| format!("Unknown egg: {}", input.egg_id))?;

    let slug = slugify(&input.name);
    if slug.is_empty() {
        return Err("Please choose a name containing at least one letter or digit.".into());
    }
    let sid = short_id();
    let suffix = &sid[..sid.len().min(6)];
    let id = format!("{}-{}", slug, suffix);

    let data_dir = input
        .data_dir
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| default_data_dir(&id));
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;

    let mut env: HashMap<String, String> = egg.default_env.iter().cloned().collect();
    for var in &egg.variables {
        env.entry(var.key.clone())
            .or_insert_with(|| var.default.clone());
    }
    if let Some(overrides) = input.env_overrides {
        for (k, v) in overrides {
            env.insert(k, v);
        }
    }
    env.insert("MEMORY".into(), format!("{}M", input.max_ram_mb));

    let def = ServerDef {
        id,
        name: input.name,
        egg_id: egg.id.clone(),
        image: egg.image.clone(),
        data_dir: data_dir.to_string_lossy().to_string(),
        port: input.port,
        port_protocol: if egg.category == "bedrock" {
            "udp".into()
        } else {
            "tcp".into()
        },
        max_ram_mb: input.max_ram_mb,
        cpu_limit: input.cpu_limit,
        env,
        stop_command: egg.stop_command,
    };

    let mut guard = state.0.lock().unwrap();
    guard.servers.push(def.clone());
    save_to_disk(&guard)?;
    Ok(def)
}

#[tauri::command]
pub fn update_server(
    server: ServerDef,
    state: tauri::State<ServersState>,
) -> Result<ServerDef, String> {
    let mut guard = state.0.lock().unwrap();
    let pos = guard
        .servers
        .iter()
        .position(|s| s.id == server.id)
        .ok_or("Server not found.")?;
    guard.servers[pos] = server.clone();
    save_to_disk(&guard)?;
    Ok(server)
}

#[tauri::command]
pub fn delete_server(
    server_id: String,
    delete_files: bool,
    state: tauri::State<ServersState>,
) -> Result<(), String> {
    let mut guard = state.0.lock().unwrap();
    let pos = guard
        .servers
        .iter()
        .position(|s| s.id == server_id)
        .ok_or("Server not found.")?;
    let removed = guard.servers.remove(pos);
    save_to_disk(&guard)?;
    drop(guard);

    let name = container_name(&removed.id);
    let _ = docker::remove_container(&name, true);

    if delete_files {
        let _ = std::fs::remove_dir_all(&removed.data_dir);
    }
    Ok(())
}

fn build_create_args(def: &ServerDef) -> Vec<String> {
    let mut args = vec![
        "create".to_string(),
        "--name".into(),
        container_name(&def.id),
        "-i".into(),
        "--restart".into(),
        "no".into(),
    ];
    let port_map = if def.port_protocol == "udp" {
        format!("{}:19132/udp", def.port)
    } else {
        format!("{}:25565", def.port)
    };
    args.push("-p".into());
    args.push(port_map);

    args.push("-m".into());
    args.push(format!("{}m", def.max_ram_mb));
    if def.cpu_limit > 0.0 {
        args.push("--cpus".into());
        args.push(format!("{:.2}", def.cpu_limit));
    }

    let data = Path::new(&def.data_dir);
    args.push("-v".into());
    args.push(format!("{}:/data", data.to_string_lossy()));

    let mut env_keys: Vec<&String> = def.env.keys().collect();
    env_keys.sort();
    for k in env_keys {
        let v = def.env.get(k).cloned().unwrap_or_default();
        args.push("-e".into());
        args.push(format!("{}={}", k, v));
    }

    args.push(def.image.clone());
    args
}

fn server_def(server_id: &str, state: &tauri::State<ServersState>) -> Result<ServerDef, String> {
    let guard = state.0.lock().unwrap();
    guard
        .servers
        .iter()
        .find(|s| s.id == server_id)
        .cloned()
        .ok_or_else(|| "Server not found.".into())
}

#[tauri::command]
pub fn start_server(app: AppHandle, server_id: String) -> Result<(), String> {
    let def = {
        let state = app.state::<ServersState>();
        server_def(&server_id, &state)?
    };

    // 1) Docker reachable?
    let status = docker::docker_status();
    if !status.running {
        return Err(status
            .error
            .unwrap_or_else(|| "Docker engine not reachable.".into()));
    }

    // 2) Data directory must exist
    std::fs::create_dir_all(&def.data_dir)
        .map_err(|e| format!("Failed to create data directory '{}': {}", def.data_dir, e))?;

    let name = container_name(&def.id);

    // 3) Pull image if missing
    if !docker::image_exists(&def.image) {
        emit_log(
            &app,
            &def.id,
            "system",
            &format!("Image '{}' not found locally — pulling …", def.image),
        );
        docker::pull_image_streaming(&def.image, &app, &def.id)?;
        emit_log(&app, &def.id, "system", "Image pull complete.");
    }

    // 4) Remove leftover container with same name (settings might have changed)
    if docker::container_exists(&name) {
        let _ = docker::remove_container(&name, true);
    }

    // 5) Verify host port is not in use by another docker container
    if let Ok(false) = docker::host_port_free(def.port, &def.port_protocol) {
        return Err(format!(
            "Port {}/{} is already used by another Docker container.",
            def.port, def.port_protocol
        ));
    }

    // 6) Create + start
    let args = build_create_args(&def);
    let out = docker::docker_cmd()
        .args(&args)
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr).to_string();
        return Err(format!("docker create failed: {}", err.trim()));
    }

    let out = docker::docker_cmd()
        .args(["start", &name])
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr).to_string();
        return Err(format!("docker start failed: {}", err.trim()));
    }

    emit_status(&app, &def.id, "running");
    emit_log(
        &app,
        &def.id,
        "system",
        &format!("→ Container '{}' started", name),
    );

    // 7) Stream logs
    let app_clone = app.clone();
    let log_name = name.clone();
    let log_id = def.id.clone();
    thread::spawn(move || {
        let mut child = match docker::docker_cmd()
            .args(["logs", "-f", "--tail", "200", &log_name])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(c) => c,
            Err(_) => return,
        };

        if let Some(out) = child.stdout.take() {
            let app2 = app_clone.clone();
            let id2 = log_id.clone();
            thread::spawn(move || {
                let reader = BufReader::new(out);
                for line in reader.lines().map_while(Result::ok) {
                    emit_log(&app2, &id2, "stdout", &line);
                }
            });
        }
        if let Some(err) = child.stderr.take() {
            let app2 = app_clone.clone();
            let id2 = log_id.clone();
            thread::spawn(move || {
                let reader = BufReader::new(err);
                for line in reader.lines().map_while(Result::ok) {
                    emit_log(&app2, &id2, "stderr", &line);
                }
            });
        }

        let _ = child.wait();
        emit_status(&app_clone, &log_id, "stopped");
        emit_log(&app_clone, &log_id, "system", "← Container stopped.");
    });

    Ok(())
}

#[tauri::command]
pub fn stop_server(app: AppHandle, server_id: String) -> Result<(), String> {
    let def = {
        let state = app.state::<ServersState>();
        server_def(&server_id, &state)?
    };
    let name = container_name(&def.id);

    let use_rcon = def.port_protocol == "tcp";
    let _ = docker::send_stdin(&name, &def.stop_command, use_rcon);
    emit_log(&app, &def.id, "system", "→ Stop command sent");

    let app_clone = app.clone();
    thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(2));
        let _ = docker::stop_container(&name, 30);
        emit_status(&app_clone, &def.id, "stopped");
    });

    Ok(())
}

#[tauri::command]
pub fn kill_server(app: AppHandle, server_id: String) -> Result<(), String> {
    let name = container_name(&server_id);
    docker::kill_container(&name)?;
    emit_log(&app, &server_id, "system", "⛔ Container force-killed.");
    emit_status(&app, &server_id, "stopped");
    Ok(())
}

#[tauri::command]
pub fn restart_server(server_id: String) -> Result<(), String> {
    let name = container_name(&server_id);
    docker::restart_container(&name)?;
    Ok(())
}

#[tauri::command]
pub fn send_command(
    server_id: String,
    command: String,
    app: AppHandle,
    state: tauri::State<ServersState>,
) -> Result<(), String> {
    let def = server_def(&server_id, &state)?;
    let name = container_name(&server_id);
    let use_rcon = def.port_protocol == "tcp";
    docker::send_stdin(&name, &command, use_rcon)?;
    emit_log(&app, &server_id, "input", &format!("> {}", command));
    Ok(())
}

#[derive(Serialize)]
pub struct ServerRuntime {
    pub state: String,
    pub stats: Option<docker::ContainerStats>,
}

#[tauri::command]
pub fn server_runtime(server_id: String) -> ServerRuntime {
    let name = container_name(&server_id);
    let state = docker::inspect_state(&name).unwrap_or_else(|| "stopped".to_string());
    let stats = if state == "running" {
        docker::container_stats(&name)
    } else {
        None
    };
    ServerRuntime { state, stats }
}

fn emit_log(app: &AppHandle, server_id: &str, stream: &str, text: &str) {
    let _ = app.emit(
        "server://log",
        LogPayload {
            server_id: server_id.to_string(),
            stream: stream.to_string(),
            text: text.to_string(),
        },
    );
}

fn emit_status(app: &AppHandle, server_id: &str, state: &str) {
    let _ = app.emit(
        "server://status",
        StatusPayload {
            server_id: server_id.to_string(),
            state: state.to_string(),
        },
    );
}

#[derive(Serialize, Clone, Debug)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

fn safe_join(base: &Path, sub: &str) -> Result<PathBuf, String> {
    let trimmed = sub.trim_start_matches(['/', '\\']);
    for part in trimmed.split(['/', '\\']) {
        if part == ".." {
            return Err("Path contains '..' — access denied.".into());
        }
    }
    Ok(base.join(trimmed))
}

#[tauri::command]
pub fn list_files(
    server_id: String,
    sub_path: String,
    state: tauri::State<ServersState>,
) -> Result<Vec<FileEntry>, String> {
    let def = server_def(&server_id, &state)?;
    let base = PathBuf::from(&def.data_dir);
    let target = safe_join(&base, &sub_path)?;
    if !target.exists() {
        return Ok(Vec::new());
    }
    if !target.is_dir() {
        return Err("Path is not a directory.".into());
    }

    let mut entries = Vec::new();
    for entry in std::fs::read_dir(&target).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        let path = entry.path();
        let rel = path
            .strip_prefix(&base)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        entries.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: rel,
            is_dir: meta.is_dir(),
            size: meta.len(),
        });
    }
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

#[tauri::command]
pub fn read_file(
    server_id: String,
    sub_path: String,
    state: tauri::State<ServersState>,
) -> Result<String, String> {
    let def = server_def(&server_id, &state)?;
    let base = PathBuf::from(&def.data_dir);
    let target = safe_join(&base, &sub_path)?;
    std::fs::read_to_string(&target).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_file(
    server_id: String,
    sub_path: String,
    content: String,
    state: tauri::State<ServersState>,
) -> Result<(), String> {
    let def = server_def(&server_id, &state)?;
    let base = PathBuf::from(&def.data_dir);
    let target = safe_join(&base, &sub_path)?;
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&target, content).map_err(|e| e.to_string())
}
