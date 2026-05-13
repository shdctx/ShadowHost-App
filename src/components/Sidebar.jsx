import {
  LayoutGrid,
  Server,
  Settings as Cog,
  Plus,
  Box,
  Activity,
} from "lucide-react";
import { cn } from "../lib/cn";
import { useServer } from "../state/ServerContext";

const STATUS_COLORS = {
  running: "bg-emerald-400",
  exited: "bg-zinc-500",
  stopped: "bg-zinc-500",
  created: "bg-amber-400",
  starting: "bg-amber-400",
  paused: "bg-amber-400",
  restarting: "bg-amber-400",
};

function StatusDot({ state }) {
  const color = STATUS_COLORS[state] ?? "bg-zinc-500";
  return (
    <span
      className={cn(
        "size-2 rounded-full shrink-0",
        color,
        state === "running" && "status-dot-pulse",
      )}
    />
  );
}

export default function Sidebar({ route, onNavigate }) {
  const { servers, statusMap, docker } = useServer();
  const dockerOk = docker?.running;

  return (
    <aside className="flex flex-col w-64 shrink-0 border-r border-[var(--color-border-base)] bg-[var(--color-bg-base)]/70 backdrop-blur">
      <div className="px-5 py-5 border-b border-[var(--color-border-base)] flex items-center gap-3">
        <div className="size-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 grid place-items-center shadow-lg shadow-violet-900/40">
          <Server className="size-5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold tracking-tight">ShadowHost</div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-mute)]">
            Server Panel
          </div>
        </div>
      </div>

      <nav className="px-2 pt-3 pb-1 space-y-1">
        <NavItem
          icon={LayoutGrid}
          label="Dashboard"
          active={route.page === "overview"}
          onClick={() => onNavigate({ page: "overview" })}
        />
        <NavItem
          icon={Activity}
          label="System"
          active={route.page === "system"}
          onClick={() => onNavigate({ page: "system" })}
          badge={
            !dockerOk && (
              <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-300 border border-red-500/30">
                !
              </span>
            )
          }
        />
        <NavItem
          icon={Cog}
          label="Settings"
          active={route.page === "settings"}
          onClick={() => onNavigate({ page: "settings" })}
        />
      </nav>

      <div className="px-4 pt-5 pb-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-mute)] font-semibold">
          Servers ({servers.length})
        </span>
        <button
          onClick={() => onNavigate({ page: "new-server" })}
          className="size-5 grid place-items-center rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-fg-mute)] hover:text-white"
          title="New server"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-2 space-y-1">
        {servers.length === 0 && (
          <div className="text-xs text-[var(--color-fg-mute)] px-3 py-4 leading-relaxed">
            No servers yet.
            <button
              onClick={() => onNavigate({ page: "new-server" })}
              className="block mt-2 text-violet-400 hover:text-violet-300"
            >
              + Create your first server
            </button>
          </div>
        )}
        {servers.map((s) => {
          const isActive = route.page === "server" && route.serverId === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onNavigate({ page: "server", serverId: s.id })}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2.5",
                isActive
                  ? "bg-[var(--color-bg-hover)] text-white"
                  : "text-[var(--color-fg-base)] hover:bg-[var(--color-bg-elev)]",
              )}
            >
              <StatusDot state={statusMap[s.id]} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-sm">{s.name}</div>
                <div className="text-[11px] text-[var(--color-fg-mute)] truncate">
                  :{s.port} · {s.egg_id}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="px-4 py-3 border-t border-[var(--color-border-base)] flex items-center gap-2.5">
        <Box
          className={cn(
            "size-4",
            dockerOk ? "text-emerald-400" : "text-red-400",
          )}
        />
        <span className="text-xs text-[var(--color-fg-base)]">
          Docker {dockerOk ? "running" : "offline"}
        </span>
      </div>
    </aside>
  );
}

function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-[var(--color-bg-hover)] text-white"
          : "text-[var(--color-fg-mute)] hover:text-white hover:bg-[var(--color-bg-elev)]",
      )}
    >
      <Icon className="size-4" />
      {label}
      {badge}
    </button>
  );
}
