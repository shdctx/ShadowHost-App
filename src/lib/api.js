import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

export const api = {
  // System
  getSystemInfo: () => invoke("get_system_info"),
  detectJava: () => invoke("detect_java"),
  dockerStatus: () => invoke("docker_status"),

  // Settings
  getSettings: () => invoke("get_settings"),
  saveSettings: (newSettings) => invoke("save_settings", { newSettings }),
  markSetupComplete: () => invoke("mark_setup_complete"),

  // Docker images
  pullImage: (image) => invoke("pull_image", { image }),
  checkImage: (image) => invoke("check_image", { image }),

  // Eggs
  listEggs: () => invoke("list_eggs"),

  // Servers
  listServers: () => invoke("list_servers"),
  createServer: (input) => invoke("create_server", { input }),
  updateServer: (server) => invoke("update_server", { server }),
  deleteServer: (serverId, deleteFiles) =>
    invoke("delete_server", { serverId, deleteFiles }),
  startServer: (serverId) => invoke("start_server", { serverId }),
  stopServer: (serverId) => invoke("stop_server", { serverId }),
  killServer: (serverId) => invoke("kill_server", { serverId }),
  restartServer: (serverId) => invoke("restart_server", { serverId }),
  sendCommand: (serverId, command) =>
    invoke("send_command", { serverId, command }),
  serverRuntime: (serverId) => invoke("server_runtime", { serverId }),

  // Files
  listFiles: (serverId, subPath = "") =>
    invoke("list_files", { serverId, subPath }),
  readFile: (serverId, subPath) =>
    invoke("read_file", { serverId, subPath }),
  writeFile: (serverId, subPath, content) =>
    invoke("write_file", { serverId, subPath, content }),
};

export const events = {
  onLog: (cb) => listen("server://log", (event) => cb(event.payload)),
  onStatus: (cb) => listen("server://status", (event) => cb(event.payload)),
};

export async function pickDirectory() {
  return await open({ multiple: false, directory: true });
}
