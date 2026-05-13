use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EggVariable {
    pub key: String,
    pub label: String,
    pub description: String,
    pub default: String,
    /// "text" | "select" | "number" | "boolean"
    pub kind: String,
    pub options: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Egg {
    pub id: String,
    pub name: String,
    pub description: String,
    pub image: String,
    pub default_env: Vec<(String, String)>,
    pub variables: Vec<EggVariable>,
    pub stop_command: String,
    pub default_port: u16,
    /// "java" | "bedrock"
    pub category: String,
}

fn v(
    key: &str,
    label: &str,
    desc: &str,
    default: &str,
    kind: &str,
    options: &[&str],
) -> EggVariable {
    EggVariable {
        key: key.into(),
        label: label.into(),
        description: desc.into(),
        default: default.into(),
        kind: kind.into(),
        options: options.iter().map(|s| (*s).to_string()).collect(),
    }
}

fn env(k: &str, v: &str) -> (String, String) {
    (k.into(), v.into())
}

fn rcon_env() -> Vec<(String, String)> {
    vec![
        env("ENABLE_RCON", "true"),
        env("RCON_PASSWORD", "shadowhost"),
        env("RCON_PORT", "25575"),
    ]
}

#[tauri::command]
pub fn list_eggs() -> Vec<Egg> {
    let mut eggs = Vec::new();

    let mut paper_env = vec![
        env("EULA", "TRUE"),
        env("TYPE", "PAPER"),
        env("ONLINE_MODE", "TRUE"),
        env("ENABLE_AUTOPAUSE", "FALSE"),
    ];
    paper_env.extend(rcon_env());
    eggs.push(Egg {
        id: "paper".into(),
        name: "Paper".into(),
        description: "Performance-tuned Spigot fork. Recommended for most multiplayer servers."
            .into(),
        image: "itzg/minecraft-server:latest".into(),
        default_env: paper_env,
        variables: vec![
            v(
                "VERSION",
                "Minecraft Version",
                "e.g. LATEST or 1.20.4",
                "LATEST",
                "text",
                &[],
            ),
            v(
                "MOTD",
                "MOTD",
                "Description shown in the multiplayer menu",
                "A ShadowHost Paper Server",
                "text",
                &[],
            ),
            v(
                "DIFFICULTY",
                "Difficulty",
                "",
                "normal",
                "select",
                &["peaceful", "easy", "normal", "hard"],
            ),
            v("MAX_PLAYERS", "Max players", "", "20", "number", &[]),
        ],
        stop_command: "stop".into(),
        default_port: 25565,
        category: "java".into(),
    });

    let mut vanilla_env = vec![env("EULA", "TRUE"), env("TYPE", "VANILLA")];
    vanilla_env.extend(rcon_env());
    eggs.push(Egg {
        id: "vanilla".into(),
        name: "Vanilla".into(),
        description: "Original Mojang server — no plugins or mods.".into(),
        image: "itzg/minecraft-server:latest".into(),
        default_env: vanilla_env,
        variables: vec![
            v(
                "VERSION",
                "Version",
                "e.g. LATEST or 1.20.4",
                "LATEST",
                "text",
                &[],
            ),
            v(
                "MOTD",
                "MOTD",
                "",
                "A ShadowHost Vanilla Server",
                "text",
                &[],
            ),
            v(
                "DIFFICULTY",
                "Difficulty",
                "",
                "normal",
                "select",
                &["peaceful", "easy", "normal", "hard"],
            ),
            v("MAX_PLAYERS", "Max players", "", "20", "number", &[]),
        ],
        stop_command: "stop".into(),
        default_port: 25565,
        category: "java".into(),
    });

    let mut fabric_env = vec![env("EULA", "TRUE"), env("TYPE", "FABRIC")];
    fabric_env.extend(rcon_env());
    eggs.push(Egg {
        id: "fabric".into(),
        name: "Fabric".into(),
        description: "Lightweight mod loader for modern Minecraft versions.".into(),
        image: "itzg/minecraft-server:latest".into(),
        default_env: fabric_env,
        variables: vec![
            v("VERSION", "MC version", "", "LATEST", "text", &[]),
            v(
                "FABRIC_LOADER_VERSION",
                "Fabric loader",
                "Leave blank for latest",
                "",
                "text",
                &[],
            ),
            v(
                "MOTD",
                "MOTD",
                "",
                "A ShadowHost Fabric Server",
                "text",
                &[],
            ),
        ],
        stop_command: "stop".into(),
        default_port: 25565,
        category: "java".into(),
    });

    let mut forge_env = vec![env("EULA", "TRUE"), env("TYPE", "FORGE")];
    forge_env.extend(rcon_env());
    eggs.push(Egg {
        id: "forge".into(),
        name: "Forge".into(),
        description: "Classic mod loader for large modpacks.".into(),
        image: "itzg/minecraft-server:latest".into(),
        default_env: forge_env,
        variables: vec![
            v("VERSION", "MC version", "", "1.20.1", "text", &[]),
            v(
                "FORGE_VERSION",
                "Forge version",
                "Leave blank to match MC version",
                "",
                "text",
                &[],
            ),
            v("MOTD", "MOTD", "", "A ShadowHost Forge Server", "text", &[]),
        ],
        stop_command: "stop".into(),
        default_port: 25565,
        category: "java".into(),
    });

    let mut spigot_env = vec![env("EULA", "TRUE"), env("TYPE", "SPIGOT")];
    spigot_env.extend(rcon_env());
    eggs.push(Egg {
        id: "spigot".into(),
        name: "Spigot".into(),
        description: "Bukkit fork with broad plugin support.".into(),
        image: "itzg/minecraft-server:latest".into(),
        default_env: spigot_env,
        variables: vec![
            v("VERSION", "Version", "", "LATEST", "text", &[]),
            v(
                "MOTD",
                "MOTD",
                "",
                "A ShadowHost Spigot Server",
                "text",
                &[],
            ),
        ],
        stop_command: "stop".into(),
        default_port: 25565,
        category: "java".into(),
    });

    eggs.push(Egg {
        id: "bedrock".into(),
        name: "Bedrock".into(),
        description: "Bedrock-Edition server (Windows, mobile, console clients).".into(),
        image: "itzg/minecraft-bedrock-server:latest".into(),
        default_env: vec![env("EULA", "TRUE")],
        variables: vec![
            v("VERSION", "Version", "e.g. LATEST", "LATEST", "text", &[]),
            v(
                "SERVER_NAME",
                "Server name",
                "",
                "ShadowHost Bedrock",
                "text",
                &[],
            ),
            v(
                "GAMEMODE",
                "Gamemode",
                "",
                "survival",
                "select",
                &["survival", "creative", "adventure"],
            ),
            v(
                "DIFFICULTY",
                "Difficulty",
                "",
                "easy",
                "select",
                &["peaceful", "easy", "normal", "hard"],
            ),
            v("MAX_PLAYERS", "Max players", "", "10", "number", &[]),
        ],
        stop_command: "stop".into(),
        default_port: 19132,
        category: "bedrock".into(),
    });

    eggs
}

pub fn find_egg(id: &str) -> Option<Egg> {
    list_eggs().into_iter().find(|e| e.id == id)
}
