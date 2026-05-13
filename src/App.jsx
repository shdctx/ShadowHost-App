import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Overview from "./pages/Overview";
import NewServer from "./pages/NewServer";
import ServerDetail from "./pages/ServerDetail";
import System from "./pages/System";
import SettingsPage from "./pages/Settings";
import Setup from "./pages/Setup";
import { ServerProvider, useServer } from "./state/ServerContext";

function pageTitle(route, servers) {
  switch (route.page) {
    case "overview":
      return { title: "Dashboard", subtitle: "All servers at a glance" };
    case "new-server":
      return { title: "New server", subtitle: "Create a new Minecraft server" };
    case "server": {
      const s = servers.find((x) => x.id === route.serverId);
      return {
        title: s?.name ?? "Server",
        subtitle: s ? `${s.egg_id} · port ${s.port}` : "",
      };
    }
    case "system":
      return { title: "System", subtitle: "Docker, hardware, Java" };
    case "settings":
      return { title: "Settings", subtitle: "Global defaults" };
    default:
      return { title: "ShadowHost", subtitle: "" };
  }
}

function Shell() {
  const { ready, settings, servers } = useServer();
  const [route, setRoute] = useState({ page: "overview" });
  const [forceSetup, setForceSetup] = useState(false);

  if (!ready) {
    return (
      <div className="h-screen w-screen grid place-items-center text-[var(--color-fg-mute)]">
        Loading …
      </div>
    );
  }

  const showSetup = forceSetup || (settings && !settings.setup_completed);

  if (showSetup) {
    return <Setup onDone={() => setForceSetup(false)} />;
  }

  const meta = pageTitle(route, servers);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar route={route} onNavigate={setRoute} />
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-[var(--color-border-base)] bg-[var(--color-bg-base)]/40 backdrop-blur px-6 flex items-center shrink-0">
          <div>
            <h1 className="text-base font-semibold tracking-tight">{meta.title}</h1>
            <p className="text-xs text-[var(--color-fg-mute)]">{meta.subtitle}</p>
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-auto p-6">
          {route.page === "overview" && <Overview onNavigate={setRoute} />}
          {route.page === "new-server" && <NewServer onNavigate={setRoute} />}
          {route.page === "server" && (
            <ServerDetail route={route} onNavigate={setRoute} />
          )}
          {route.page === "system" && <System />}
          {route.page === "settings" && (
            <SettingsPage onReplaySetup={() => setForceSetup(true)} />
          )}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ServerProvider>
      <Shell />
    </ServerProvider>
  );
}
