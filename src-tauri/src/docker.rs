use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::OnceLock;

use tauri::{AppHandle, Emitter};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

static DOCKER_PATH: OnceLock<PathBuf> = OnceLock::new();

/// Locate the docker binary. Tries PATH first, then OS-specific
/// well-known install locations. Falls back to bare "docker" so the
/// error surfaces when the command is actually invoked.
fn locate_docker() -> PathBuf {
    let exe_name = if cfg!(windows) {
        "docker.exe"
    } else {
        "docker"
    };

    if let Some(path_var) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path_var) {
            let candidate = dir.join(exe_name);
            if candidate.is_file() {
                return candidate;
            }
        }
    }

    let candidates: &[&str] = if cfg!(windows) {
        &[
            r"C:\Program Files\Docker\Docker\resources\bin\docker.exe",
            r"C:\Program Files\Docker\Docker\resources\docker.exe",
            r"C:\ProgramData\DockerDesktop\version-bin\docker.exe",
        ]
    } else if cfg!(target_os = "macos") {
        &[
            "/usr/local/bin/docker",
            "/opt/homebrew/bin/docker",
            "/Applications/Docker.app/Contents/Resources/bin/docker",
        ]
    } else {
        &[
            "/usr/bin/docker",
            "/usr/local/bin/docker",
            "/snap/bin/docker",
        ]
    };

    for c in candidates {
        let p = PathBuf::from(c);
        if p.is_file() {
            return p;
        }
    }

    PathBuf::from(exe_name)
}

/// Returns a Command pre-configured to invoke `docker` from the
/// best-known location. Windows variants suppress the console window.
pub fn docker_cmd() -> Command {
    let path = DOCKER_PATH.get_or_init(locate_docker);
    let mut cmd = Command::new(path);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

#[derive(Serialize, Clone, Debug)]
pub struct DockerStatus {
    pub installed: bool,
    pub running: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub fn docker_status() -> DockerStatus {
    let path = DOCKER_PATH.get_or_init(locate_docker).clone();
    let path_str = path.to_string_lossy().to_string();

    let version_out = docker_cmd().arg("--version").output();
    let Ok(out) = version_out else {
        return DockerStatus {
            installed: false,
            running: false,
            version: None,
            path: Some(path_str),
            error: Some(
                "Docker not installed or not found in PATH. \
                 Install Docker Desktop and restart ShadowHost."
                    .into(),
            ),
        };
    };

    let version = String::from_utf8_lossy(&out.stdout)
        .trim()
        .to_string()
        .replace("Docker version ", "");

    let info = docker_cmd()
        .args(["info", "--format", "{{.ServerVersion}}"])
        .output();
    let running = info
        .as_ref()
        .map(|o| o.status.success() && !o.stdout.is_empty())
        .unwrap_or(false);
    let error = if !running {
        Some("Docker engine is not running. Please start Docker Desktop.".into())
    } else {
        None
    };

    DockerStatus {
        installed: true,
        running,
        version: Some(version),
        path: Some(path_str),
        error,
    }
}

pub fn inspect_state(name: &str) -> Option<String> {
    let out = docker_cmd()
        .args(["inspect", "--format", "{{.State.Status}}", name])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

pub fn container_exists(name: &str) -> bool {
    inspect_state(name).is_some()
}

pub fn image_exists(image: &str) -> bool {
    let out = docker_cmd()
        .args(["image", "inspect", image])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
    matches!(out, Ok(s) if s.success())
}

pub fn remove_container(name: &str, force: bool) -> Result<(), String> {
    let mut cmd = docker_cmd();
    cmd.arg("rm");
    if force {
        cmd.arg("-f");
    }
    cmd.arg(name);
    let out = cmd.output().map_err(|e| e.to_string())?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr).to_string();
        if !err.contains("No such container") {
            return Err(err);
        }
    }
    Ok(())
}

pub fn stop_container(name: &str, timeout: u32) -> Result<(), String> {
    let out = docker_cmd()
        .args(["stop", "-t", &timeout.to_string(), name])
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    Ok(())
}

pub fn kill_container(name: &str) -> Result<(), String> {
    let out = docker_cmd()
        .args(["kill", name])
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    Ok(())
}

pub fn restart_container(name: &str) -> Result<(), String> {
    let out = docker_cmd()
        .args(["restart", name])
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    Ok(())
}

#[derive(Serialize, Clone, Debug)]
pub struct ContainerStats {
    pub cpu_percent: f64,
    pub mem_usage_mb: f64,
    pub mem_limit_mb: f64,
    pub mem_percent: f64,
}

pub fn container_stats(name: &str) -> Option<ContainerStats> {
    let out = docker_cmd()
        .args([
            "stats",
            "--no-stream",
            "--format",
            "{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}",
            name,
        ])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let line = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let parts: Vec<&str> = line.split('|').collect();
    if parts.len() < 3 {
        return None;
    }
    let cpu_percent = parts[0].trim().trim_end_matches('%').parse().unwrap_or(0.0);
    let (used, limit) = parts[1].split_once('/').unwrap_or((parts[1], ""));
    let mem_usage_mb = parse_mem_to_mb(used.trim());
    let mem_limit_mb = parse_mem_to_mb(limit.trim());
    let mem_percent = parts[2].trim().trim_end_matches('%').parse().unwrap_or(0.0);
    Some(ContainerStats {
        cpu_percent,
        mem_usage_mb,
        mem_limit_mb,
        mem_percent,
    })
}

fn parse_mem_to_mb(s: &str) -> f64 {
    let s = s.trim();
    let split_at = s.chars().position(|c| c.is_alphabetic()).unwrap_or(s.len());
    let (num, unit) = s.split_at(split_at);
    let n: f64 = num.trim().parse().unwrap_or(0.0);
    match unit.trim().to_lowercase().as_str() {
        "b" => n / 1024.0 / 1024.0,
        "kib" | "kb" => n / 1024.0,
        "mib" | "mb" => n,
        "gib" | "gb" => n * 1024.0,
        "tib" | "tb" => n * 1024.0 * 1024.0,
        _ => n,
    }
}

/// Sends a single command to a running container.
/// Uses RCON via `docker exec rcon-cli` for Java servers (reliable, no EOF issues).
/// Falls back to `docker attach` + stdin for Bedrock and similar containers.
pub fn send_stdin(name: &str, line: &str, use_rcon: bool) -> Result<(), String> {
    if use_rcon {
        let out = docker_cmd()
            .args(["exec", name, "rcon-cli", line.trim_end()])
            .output()
            .map_err(|e| e.to_string())?;
        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            return Err(if stderr.is_empty() {
                String::from_utf8_lossy(&out.stdout).to_string()
            } else {
                stderr
            });
        }
        return Ok(());
    }

    use std::io::Write;
    let mut child = docker_cmd()
        .args(["attach", "--sig-proxy=false", name])
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| e.to_string())?;
    if let Some(stdin) = child.stdin.as_mut() {
        let payload = format!("{}\n", line.trim_end());
        stdin
            .write_all(payload.as_bytes())
            .map_err(|e| e.to_string())?;
        stdin.flush().map_err(|e| e.to_string())?;
    }
    drop(child.stdin.take());
    let _ = child.kill();
    let _ = child.wait();
    Ok(())
}

/// Pull an image, streaming progress lines back via the `server://log`
/// event for the given server. Blocks until pull completes.
pub fn pull_image_streaming(image: &str, app: &AppHandle, server_id: &str) -> Result<(), String> {
    let mut child = docker_cmd()
        .args(["pull", image])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    if let Some(out) = child.stdout.take() {
        let app2 = app.clone();
        let id2 = server_id.to_string();
        std::thread::spawn(move || {
            let reader = BufReader::new(out);
            for line in reader.lines().map_while(Result::ok) {
                let _ = app2.emit(
                    "server://log",
                    LogLine {
                        server_id: id2.clone(),
                        stream: "system".into(),
                        text: format!("[pull] {}", line),
                    },
                );
            }
        });
    }
    if let Some(err) = child.stderr.take() {
        let app2 = app.clone();
        let id2 = server_id.to_string();
        std::thread::spawn(move || {
            let reader = BufReader::new(err);
            for line in reader.lines().map_while(Result::ok) {
                let _ = app2.emit(
                    "server://log",
                    LogLine {
                        server_id: id2.clone(),
                        stream: "stderr".into(),
                        text: format!("[pull] {}", line),
                    },
                );
            }
        });
    }

    let status = child.wait().map_err(|e| e.to_string())?;
    if !status.success() {
        return Err(format!("Failed to pull image '{}'.", image));
    }
    Ok(())
}

#[derive(Serialize, Clone)]
struct LogLine {
    server_id: String,
    stream: String,
    text: String,
}

/// True when no other docker container has the given host port bound.
/// Returns Ok(true) when port is free, Ok(false) when in use,
/// Err if we can't query docker.
pub fn host_port_free(port: u16, protocol: &str) -> Result<bool, String> {
    let needle = format!("{}/{}", port, protocol);
    let out = docker_cmd()
        .args(["ps", "-a", "--format", "{{.Ports}}"])
        .output()
        .map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&out.stdout);
    for line in text.lines() {
        // Lines look like: "0.0.0.0:25565->25565/tcp"
        for part in line.split(',') {
            if part.contains(&format!(":{}->", port)) && part.contains(&needle) {
                return Ok(false);
            }
        }
    }
    Ok(true)
}

#[tauri::command]
pub fn pull_image(image: String) -> Result<(), String> {
    let out = docker_cmd()
        .args(["pull", &image])
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn check_image(image: String) -> bool {
    image_exists(&image)
}
