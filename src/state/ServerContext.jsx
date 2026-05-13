import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { api, events } from "../lib/api";

const MAX_LOG_LINES = 1500;
const ServerContext = createContext(null);

export function ServerProvider({ children }) {
  const [servers, setServers] = useState([]);
  const [eggs, setEggs] = useState([]);
  const [settings, setSettings] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [docker, setDocker] = useState(null);
  const [statusMap, setStatusMap] = useState({});
  const [ready, setReady] = useState(false);
  const logsRef = useRef({});
  const [logTick, setLogTick] = useState(0);
  const unsubRef = useRef([]);

  const bumpLogs = () => setLogTick((t) => t + 1);

  const refreshDocker = useCallback(async () => {
    setDocker(await api.dockerStatus().catch(() => null));
  }, []);

  const refreshSettings = useCallback(async () => {
    setSettings(await api.getSettings().catch(() => null));
  }, []);

  const refreshServers = useCallback(async () => {
    const list = await api.listServers().catch(() => []);
    setServers(list);
    const newStatus = {};
    await Promise.all(
      list.map(async (s) => {
        const rt = await api.serverRuntime(s.id).catch(() => null);
        newStatus[s.id] = rt?.state ?? "stopped";
      }),
    );
    setStatusMap(newStatus);
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const [sys, eg, st, dock] = await Promise.all([
        api.getSystemInfo().catch(() => null),
        api.listEggs().catch(() => []),
        api.getSettings().catch(() => null),
        api.dockerStatus().catch(() => null),
      ]);
      if (!mounted) return;
      setSystemInfo(sys);
      setEggs(eg);
      setSettings(st);
      setDocker(dock);
      await refreshServers();
      setReady(true);
    })();

    const subs = [];
    events
      .onLog((line) => {
        const id = line.server_id;
        const arr = logsRef.current[id] || [];
        if (arr.length >= MAX_LOG_LINES) arr.shift();
        arr.push({ ...line, key: crypto.randomUUID() });
        logsRef.current[id] = arr;
        bumpLogs();
      })
      .then((unsub) => subs.push(unsub));
    events
      .onStatus(({ server_id, state }) => {
        setStatusMap((prev) => ({ ...prev, [server_id]: state }));
      })
      .then((unsub) => subs.push(unsub));
    unsubRef.current = subs;

    // Periodically refresh docker status so the UI reacts if user starts/stops it
    const dockerPoll = setInterval(() => {
      refreshDocker();
    }, 10000);

    return () => {
      mounted = false;
      unsubRef.current.forEach((u) => u && u());
      clearInterval(dockerPoll);
    };
  }, [refreshServers, refreshDocker]);

  const updateSettings = async (next) => {
    const saved = await api.saveSettings(next);
    setSettings(saved);
    return saved;
  };

  const getLogs = (serverId) => logsRef.current[serverId] ?? [];
  const clearLogs = (serverId) => {
    logsRef.current[serverId] = [];
    bumpLogs();
  };

  const value = {
    ready,
    servers,
    eggs,
    settings,
    systemInfo,
    docker,
    statusMap,
    logTick,
    getLogs,
    clearLogs,
    refreshServers,
    refreshDocker,
    refreshSettings,
    updateSettings,
  };

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
}

export function useServer() {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error("useServer outside provider");
  return ctx;
}
