import { Plus, Play, Square, Trash2, Settings as Cog, Server } from "lucide-react";
import { Button, Card, CardHeader, StatusPill } from "../components/ui";
import { useServer } from "../state/ServerContext";
import { api } from "../lib/api";

function mapState(state) {
  if (state === "running") return "running";
  if (state === "starting" || state === "created" || state === "restarting")
    return "starting";
  if (state === "stopping") return "stopping";
  return "stopped";
}

export default function Overview({ onNavigate }) {
  const { servers, statusMap, refreshServers, docker } = useServer();

  const handleStart = async (id) => {
    try {
      await api.startServer(id);
      refreshServers();
    } catch (e) {
      alert("Error: " + e);
    }
  };

  const handleStop = async (id) => {
    try {
      await api.stopServer(id);
      refreshServers();
    } catch (e) {
      alert("Error: " + e);
    }
  };

  const handleDelete = async (s) => {
    const confirmed = confirm(
      `Delete server "${s.name}"?\nThe container will be removed but world data is kept.`,
    );
    if (!confirmed) return;
    try {
      await api.deleteServer(s.id, false);
      refreshServers();
    } catch (e) {
      alert("Error: " + e);
    }
  };

  return (
    <div className="space-y-5">
      {!docker?.running && (
        <Card className="border-red-500/40 bg-red-500/5">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-lg bg-red-500/20 grid place-items-center shrink-0">
              <Server className="size-4 text-red-300" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-red-200">Docker is not running</div>
              <p className="text-sm text-red-200/80 mt-0.5">
                {docker?.error ?? "Start Docker Desktop and try again."}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate({ page: "system" })}
            >
              Diagnose
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Your servers"
          subtitle={`${servers.length} server${servers.length === 1 ? "" : "s"} configured.`}
          action={
            <Button
              variant="primary"
              onClick={() => onNavigate({ page: "new-server" })}
            >
              <Plus className="size-4" />
              New server
            </Button>
          }
        />

        {servers.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="size-14 mx-auto rounded-2xl bg-violet-500/10 grid place-items-center mb-3">
              <Server className="size-7 text-violet-400" />
            </div>
            <div className="font-medium">No servers yet</div>
            <p className="text-sm text-[var(--color-fg-mute)] mt-1 max-w-sm mx-auto">
              Create your first Minecraft server. ShadowHost spins it up inside a
              Docker container.
            </p>
            <Button
              variant="primary"
              className="mt-4"
              onClick={() => onNavigate({ page: "new-server" })}
            >
              <Plus className="size-4" />
              Create first server
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {servers.map((s) => {
              const state = mapState(statusMap[s.id]);
              const isRunning = state === "running" || state === "starting";
              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-[var(--color-border-base)] bg-[var(--color-bg-deep)]/40 p-4 flex flex-wrap items-center gap-4"
                >
                  <button
                    onClick={() =>
                      onNavigate({ page: "server", serverId: s.id })
                    }
                    className="text-left flex-1 min-w-0"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold tracking-tight">{s.name}</span>
                      <StatusPill status={state} />
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-fg-mute)] mt-1 font-mono">
                      <span>{s.egg_id}</span>
                      <span>· :{s.port}</span>
                      <span>· {s.max_ram_mb} MB</span>
                      <span className="truncate">· {s.data_dir}</span>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 ml-auto">
                    {isRunning ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleStop(s.id)}
                      >
                        <Square className="size-3.5 fill-current" />
                        Stop
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleStart(s.id)}
                        disabled={!docker?.running}
                      >
                        <Play className="size-3.5 fill-current" />
                        Start
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onNavigate({ page: "server", serverId: s.id, tab: "settings" })
                      }
                      title="Settings"
                    >
                      <Cog className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(s)}
                      title="Delete"
                    >
                      <Trash2 className="size-3.5 text-red-400" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
