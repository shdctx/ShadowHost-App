import { useEffect, useState } from "react";
import { Box, Coffee, RefreshCw, Check, X } from "lucide-react";
import { Button, Card, CardHeader, Stat } from "../components/ui";
import { useServer } from "../state/ServerContext";
import { api } from "../lib/api";

export default function System() {
  const { docker, systemInfo, refreshDocker } = useServer();
  const [javaInstalls, setJavaInstalls] = useState([]);
  const [loadingJava, setLoadingJava] = useState(false);

  const loadJava = async () => {
    setLoadingJava(true);
    try {
      const list = await api.detectJava();
      setJavaInstalls(list);
    } finally {
      setLoadingJava(false);
    }
  };

  useEffect(() => {
    loadJava();
  }, []);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Docker Engine"
          subtitle="Container runtime for your servers."
          action={
            <Button variant="ghost" size="sm" onClick={refreshDocker}>
              <RefreshCw className="size-3.5" />
              Re-check
            </Button>
          }
        />

        <div className="flex items-center gap-3 p-4 rounded-xl border border-[var(--color-border-base)] bg-[var(--color-bg-deep)]/40">
          <div
            className={`size-10 rounded-xl grid place-items-center ${
              docker?.running ? "bg-emerald-500/15" : "bg-red-500/15"
            }`}
          >
            <Box
              className={`size-5 ${
                docker?.running ? "text-emerald-400" : "text-red-400"
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 font-semibold">
              Docker{" "}
              {docker?.running ? (
                <>
                  <span className="text-emerald-400">running</span>
                  <Check className="size-4 text-emerald-400" />
                </>
              ) : (
                <>
                  <span className="text-red-400">
                    {docker?.installed ? "unreachable" : "not installed"}
                  </span>
                  <X className="size-4 text-red-400" />
                </>
              )}
            </div>
            {docker?.version && (
              <div className="text-xs text-[var(--color-fg-mute)] mt-0.5 font-mono">
                {docker.version}
              </div>
            )}
            {docker?.path && (
              <div className="text-xs text-[var(--color-fg-mute)] mt-0.5 font-mono truncate">
                {docker.path}
              </div>
            )}
            {docker?.error && (
              <div className="text-xs text-red-300 mt-1">{docker.error}</div>
            )}
          </div>
        </div>

        {!docker?.installed && (
          <div className="mt-3 text-sm text-[var(--color-fg-mute)]">
            Install{" "}
            <a
              href="https://www.docker.com/products/docker-desktop/"
              target="_blank"
              rel="noreferrer"
              className="text-violet-400 hover:underline"
            >
              Docker Desktop
            </a>{" "}
            (Windows/macOS) or{" "}
            <a
              href="https://docs.docker.com/engine/install/"
              target="_blank"
              rel="noreferrer"
              className="text-violet-400 hover:underline"
            >
              Docker Engine
            </a>{" "}
            (Linux), then restart ShadowHost.
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader title="Hardware" subtitle="Live system resources." />
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label="Total RAM"
              value={
                systemInfo
                  ? `${(systemInfo.total_ram_mb / 1024).toFixed(1)} GB`
                  : "–"
              }
              hint={systemInfo ? `${systemInfo.total_ram_mb} MB` : ""}
            />
            <Stat
              label="Available"
              value={
                systemInfo
                  ? `${(systemInfo.available_ram_mb / 1024).toFixed(1)} GB`
                  : "–"
              }
            />
            <Stat label="CPU cores" value={systemInfo?.cpu_cores ?? "–"} />
            <Stat
              label="OS"
              value={
                systemInfo
                  ? `${systemInfo.os.toUpperCase()} ${systemInfo.arch}`
                  : "–"
              }
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Java"
            subtitle="Optional — only needed if you run servers outside Docker."
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={loadJava}
                disabled={loadingJava}
              >
                <RefreshCw
                  className={`size-3.5 ${loadingJava ? "animate-spin" : ""}`}
                />
              </Button>
            }
          />
          {javaInstalls.length === 0 ? (
            <div className="text-sm text-[var(--color-fg-mute)] py-6 text-center">
              <Coffee className="size-5 mx-auto mb-2 opacity-60" />
              No Java installations found. That&apos;s fine — Docker bundles its
              own Java inside the server image.
            </div>
          ) : (
            <ul className="space-y-1.5 max-h-48 overflow-auto pr-1">
              {javaInstalls.map((j, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-deep)]/40 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium">
                      Java {j.major}{" "}
                      <span className="text-[var(--color-fg-mute)] text-xs">
                        ({j.vendor})
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--color-fg-mute)] truncate font-mono">
                      {j.path}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--color-bg-hover)] text-[var(--color-fg-mute)] shrink-0">
                    {j.version}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
