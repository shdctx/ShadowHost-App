---
name: ShadowHost architecture
description: ShadowHost is a cross-platform Tauri desktop client for managing multiple Minecraft servers in Docker containers (Pelican/Pterodactyl-style).
type: project
---

ShadowHost is a Tauri 2 desktop manager for local Minecraft servers. UI is English-only.

- **Multi-server model**: List of servers persisted in `~/<config>/ShadowHost/servers.json`. Each server has its own id/name/port/limits/env.
- **Docker runtime**: Every server runs in a dedicated container `shadowhost-<id>`. Standard image `itzg/minecraft-server` (covers Vanilla, Paper, Forge, Fabric, Spigot via env vars) and `itzg/minecraft-bedrock-server` for Bedrock.
- **Egg template system** in `eggs.rs`: built-in templates with image + default env + variable schema.
- **Docker integration via CLI** (`docker` command spawned through `std::process`), not the Engine API — robust across versions and avoids bollard.
- **Docker binary auto-detection** (`docker.rs::locate_docker`): tries PATH first, then OS-specific install locations (Windows `C:\Program Files\Docker\Docker\resources\bin`, macOS `/usr/local/bin`/`/opt/homebrew/bin`/`Docker.app/Contents/Resources/bin`, Linux `/usr/bin`/`/snap/bin`).
- **Self-setup**: First-run wizard (`pages/Setup.jsx`) walks the user through Docker check → storage/RAM defaults → image pre-pull. Re-runnable from Settings. `start_server` performs pre-flight checks (Docker reachable, data dir created, image present — auto-pulls with live progress streamed to the server console, then port-conflict check) before `docker create` + `docker start`.
- **Cross-platform**: Same code runs on Windows, macOS, Linux. Conditional compilation (`#[cfg(windows)]`) for `CREATE_NO_WINDOW` flag and `taskkill` vs `kill`. Java detection probes per-OS install roots.
- **CI**: `.github/workflows/build.yml` runs `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, then `tauri build --debug` on all three platforms.

Why: User wanted Pelican-style multi-server Docker orchestration, English-only UI, and the app should self-setup as much as possible across Windows/Linux/macOS.

How to apply:
- Server-lifecycle operations route through `servers.rs` → `docker.rs`, never spawn `java` directly.
- New egg templates: add to `eggs::list_eggs()` with image + env + variables.
- Keep clippy-clean (`-D warnings`) — CI rejects warnings.
- All user-facing strings (UI labels, Rust error messages emitted via Tauri commands) MUST be English.
- New Tauri commands need to be registered in `lib.rs::run()` and exposed through `src/lib/api.js`.
