import { useEffect, useMemo, useState } from "react";
import {
  Play,
  Square,
  Zap,
  RefreshCcw,
  Terminal,
  FileText,
  Settings as Cog,
  ChevronLeft,
  Activity,
} from "lucide-react";
import { Button, Card, StatusPill } from "../components/ui";
import { useServer } from "../state/ServerContext";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import ConsoleTab from "../components/tabs/ConsoleTab";
import FilesTab from "../components/tabs/FilesTab";
import SettingsTab from "../components/tabs/SettingsTab";

const TABS = [
  { id: "console", label: "Console", icon: Terminal },
  { id: "files", label: "Files", icon: FileText },
  { id: "settings", label: "Settings", icon: Cog },
];

function mapState(state) {
  if (state === "running") return "running";
  if (["starting", "created", "restarting"].includes(state)) return "starting";
  if (state === "stopping") return "stopping";
  return "stopped";
}

export default function ServerDetail({ route, onNavigate }) {
  const { servers, statusMap, refreshServers } = useServer();
  const [tab, setTab] = useState(route.tab ?? "console");
  const [stats, setStats] = useState(null);

  const server = useMemo(
    () => servers.find((s) => s.id === route.serverId),
    [servers, route.serverId],
  );

  useEffect(() => {
    if (route.tab) setTab(route.tab);
  }, [route.tab]);

  const state = mapState(statusMap[route.serverId]);
  const isRunning = state === "running";

  useEffect(() => {
    if (!server) return;
    let cancelled = false;
    const tick = async () => {
      const rt = await api.serverRuntime(server.id).catch(() => null);
      if (!cancelled) setStats(rt?.stats ?? null);
    };
    tick();
    const interval = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [server, isRunning]);

  if (!server) {
    return (
      <Card>
        <div className="py-8 text-center text-[var(--color-fg-mute)]">
          Server not found.{" "}
          <button
            onClick={() => onNavigate({ page: "overview" })}
            className="text-violet-400 hover:underline"
          >
            Back to dashboard
          </button>
        </div>
      </Card>
    );
  }

  const handle = async (fn, label) => {
    try {
      await fn();
      refreshServers();
    } catch (e) {
      alert(`${label}: ${e}`);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate({ page: "overview" })}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold truncate">{server.name}</h2>
            <StatusPill status={state} />
          </div>
          <div className="text-xs text-[var(--color-fg-mute)] font-mono mt-0.5">
            {server.egg_id} · {server.image} · port {server.port}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRunning ? (
            <>
              <Button
                variant="secondary"
                size="md"
                onClick={() => handle(() => api.stopServer(server.id), "Stop")}
              >
                <Square className="size-4 fill-current" />
                Stop
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() =>
                  handle(() => api.restartServer(server.id), "Restart")
                }
              >
                <RefreshCcw className="size-4" />
                Restart
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={() => handle(() => api.killServer(server.id), "Kill")}
              >
                <Zap className="size-4" />
                Kill
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={() => handle(() => api.startServer(server.id), "Start")}
            >
              <Play className="size-4 fill-current" />
              Start
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="CPU"
          value={stats ? `${stats.cpu_percent.toFixed(1)}%` : "—"}
          subtle={
            server.cpu_limit > 0
              ? `limit ${server.cpu_limit} cores`
              : "no limit"
          }
        />
        <StatCard
          label="RAM"
          value={
            stats
              ? `${stats.mem_usage_mb.toFixed(0)} / ${stats.mem_limit_mb.toFixed(0)} MB`
              : "—"
          }
          subtle={
            stats ? `${stats.mem_percent.toFixed(1)}%` : `limit ${server.max_ram_mb} MB`
          }
        />
        <StatCard
          label="Status"
          value={state}
          subtle={statusMap[server.id] ?? "stopped"}
        />
      </div>

      <Card className="flex-1 min-h-0 flex flex-col p-0">
        <div className="flex items-center border-b border-[var(--color-border-base)] px-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 -mb-px transition-colors",
                  active
                    ? "text-white border-violet-500"
                    : "text-[var(--color-fg-mute)] border-transparent hover:text-white",
                )}
              >
                <Icon className="size-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1 min-h-0 p-4">
          {tab === "console" && <ConsoleTab server={server} state={state} />}
          {tab === "files" && <FilesTab server={server} />}
          {tab === "settings" && (
            <SettingsTab server={server} onChange={refreshServers} />
          )}
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, subtle }) {
  return (
    <div className="rounded-xl border border-[var(--color-border-base)] bg-[var(--color-bg-base)]/60 p-3.5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--color-fg-mute)] font-medium">
        <Activity className="size-3" />
        {label}
      </div>
      <div className="text-lg font-semibold tracking-tight mt-1">{value}</div>
      <div className="text-[11px] text-[var(--color-fg-mute)] mt-0.5">{subtle}</div>
    </div>
  );
}
