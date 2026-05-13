use serde::Serialize;
use std::process::Command;
use sysinfo::System;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Serialize, Clone)]
pub struct JavaInstall {
    pub path: String,
    pub version: String,
    pub major: u32,
    pub vendor: String,
}

#[derive(Serialize, Clone)]
pub struct SystemInfo {
    pub total_ram_mb: u64,
    pub available_ram_mb: u64,
    pub os: String,
    pub arch: String,
    pub cpu_cores: usize,
}

#[tauri::command]
pub fn get_system_info() -> SystemInfo {
    let mut sys = System::new();
    sys.refresh_memory();
    let cpu_cores = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1);
    SystemInfo {
        total_ram_mb: sys.total_memory() / 1024 / 1024,
        available_ram_mb: sys.available_memory() / 1024 / 1024,
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        cpu_cores,
    }
}

fn java_exe_name() -> &'static str {
    if cfg!(windows) {
        "java.exe"
    } else {
        "java"
    }
}

#[tauri::command]
pub fn detect_java() -> Vec<JavaInstall> {
    let mut results = Vec::new();
    let mut tried = std::collections::HashSet::new();

    for path in candidate_java_paths() {
        let normalized = path.to_string_lossy().to_lowercase();
        if !tried.insert(normalized) {
            continue;
        }
        if let Some(info) = probe_java(&path.to_string_lossy()) {
            results.push(info);
        }
    }

    results
}

fn candidate_java_paths() -> Vec<std::path::PathBuf> {
    let mut paths = Vec::new();
    let exe = java_exe_name();

    // PATH java (the bare name will trigger PATH lookup)
    paths.push(std::path::PathBuf::from(exe));

    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        paths.push(std::path::PathBuf::from(&java_home).join("bin").join(exe));
    }

    if cfg!(windows) {
        let roots = [
            r"C:\Program Files\Java",
            r"C:\Program Files\Eclipse Adoptium",
            r"C:\Program Files\Microsoft",
            r"C:\Program Files\Zulu",
            r"C:\Program Files\BellSoft",
            r"C:\Program Files (x86)\Java",
        ];
        for root in roots {
            if let Ok(entries) = std::fs::read_dir(root) {
                for entry in entries.flatten() {
                    let p = entry.path().join("bin").join(exe);
                    if p.exists() {
                        paths.push(p);
                    }
                }
            }
        }
    } else if cfg!(target_os = "macos") {
        if let Ok(entries) = std::fs::read_dir("/Library/Java/JavaVirtualMachines") {
            for entry in entries.flatten() {
                let p = entry.path().join("Contents/Home/bin/java");
                if p.exists() {
                    paths.push(p);
                }
            }
        }
        let extras = [
            "/opt/homebrew/opt/openjdk/bin/java",
            "/usr/local/opt/openjdk/bin/java",
        ];
        for p in extras {
            let pb = std::path::PathBuf::from(p);
            if pb.exists() {
                paths.push(pb);
            }
        }
    } else {
        let roots = ["/usr/lib/jvm", "/usr/java", "/opt/java"];
        for root in roots {
            if let Ok(entries) = std::fs::read_dir(root) {
                for entry in entries.flatten() {
                    let p = entry.path().join("bin/java");
                    if p.exists() {
                        paths.push(p);
                    }
                }
            }
        }
    }

    paths
}

fn probe_java(path: &str) -> Option<JavaInstall> {
    let mut cmd = Command::new(path);
    cmd.arg("-version");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let output = cmd.output().ok()?;
    let text = String::from_utf8_lossy(&output.stderr).to_string()
        + &String::from_utf8_lossy(&output.stdout);
    if text.is_empty() {
        return None;
    }

    let version = extract_version(&text)?;
    let major = parse_major(&version);
    let vendor = extract_vendor(&text);
    Some(JavaInstall {
        path: path.to_string(),
        version,
        major,
        vendor,
    })
}

fn extract_version(text: &str) -> Option<String> {
    for line in text.lines() {
        if let Some(start) = line.find('"') {
            if let Some(end) = line[start + 1..].find('"') {
                return Some(line[start + 1..start + 1 + end].to_string());
            }
        }
    }
    None
}

fn parse_major(version: &str) -> u32 {
    let cleaned = version.trim_start_matches("1.");
    cleaned
        .split(|c: char| !c.is_ascii_digit())
        .next()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(0)
}

fn extract_vendor(text: &str) -> String {
    for line in text.lines() {
        let lower = line.to_lowercase();
        if lower.contains("openjdk") {
            return "OpenJDK".into();
        }
        if lower.contains("temurin") {
            return "Eclipse Temurin".into();
        }
        if lower.contains("zulu") {
            return "Azul Zulu".into();
        }
        if lower.contains("corretto") {
            return "Amazon Corretto".into();
        }
        if lower.contains("graalvm") {
            return "GraalVM".into();
        }
        if lower.contains("java(tm)") || lower.contains("hotspot") {
            return "Oracle Java".into();
        }
    }
    "Unknown".into()
}
