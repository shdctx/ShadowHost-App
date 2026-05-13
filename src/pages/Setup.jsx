import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  FolderOpen,
  RefreshCw,
  Server,
  Sparkles,
} from "lucide-react";
import { Button, Card, Input, Label } from "../components/ui";
import { useServer } from "../state/ServerContext";
import { api, pickDirectory } from "../lib/api";
import { cn } from "../lib/cn";

const STEPS = ["Docker", "Storage", "Image", "Done"];

const DEFAULT_IMAGE = "itzg/minecraft-server:latest";

const dockerInstallLink = {
  windows: "https://www.docker.com/products/docker-desktop/",
  macos: "https://www.docker.com/products/docker-desktop/",
  linux: "https://docs.docker.com/engine/install/",
};

function platformLink(os) {
  return dockerInstallLink[os] ?? dockerInstallLink.linux;
}

export default function Setup({ onDone }) {
  const { docker, refreshDocker, settings, updateSettings, systemInfo } =
    useServer();
  const [step, setStep] = useState(0);
  const [dataDir, setDataDir] = useState(settings?.default_data_dir ?? "");
  const [ram, setRam] = useState(settings?.default_ram_mb ?? 2048);
  const [imageStatus, setImageStatus] = useState("idle"); // idle | checking | present | missing | pulling | error
  const [pullError, setPullError] = useState(null);

  useEffect(() => {
    if (settings) {
      setDataDir(settings.default_data_dir);
      setRam(settings.default_ram_mb);
    }
  }, [settings]);

  const os = systemInfo?.os ?? "linux";
  const dockerOk = docker?.running;

  // Auto-advance when docker becomes available
  useEffect(() => {
    if (step === 0 && dockerOk) setStep(1);
  }, [step, dockerOk]);

  const checkImage = async () => {
    setImageStatus("checking");
    try {
      const present = await api.checkImage(DEFAULT_IMAGE);
      setImageStatus(present ? "present" : "missing");
    } catch {
      setImageStatus("missing");
    }
  };

  useEffect(() => {
    if (step === 2 && imageStatus === "idle") checkImage();
  }, [step, imageStatus]);

  const pull = async () => {
    setImageStatus("pulling");
    setPullError(null);
    try {
      await api.pullImage(DEFAULT_IMAGE);
      setImageStatus("present");
    } catch (e) {
      setImageStatus("error");
      setPullError(String(e));
    }
  };

  const finalize = async () => {
    await updateSettings({
      ...settings,
      default_data_dir: dataDir,
      default_ram_mb: Number(ram),
      setup_completed: true,
    });
    await api.markSetupComplete().catch(() => {});
    onDone?.();
  };

  return (
    <div className="min-h-full grid place-items-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        <header className="text-center space-y-2">
          <div className="size-14 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 grid place-items-center shadow-lg shadow-violet-900/40">
            <Sparkles className="size-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to ShadowHost
          </h1>
          <p className="text-sm text-[var(--color-fg-mute)]">
            Let&apos;s get your environment ready in just a few steps.
          </p>
        </header>

        <Stepper step={step} />

        {step === 0 && (
          <Card>
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "size-12 rounded-xl grid place-items-center shrink-0",
                  dockerOk ? "bg-emerald-500/15" : "bg-amber-500/15",
                )}
              >
                <Box
                  className={cn(
                    "size-6",
                    dockerOk ? "text-emerald-400" : "text-amber-400",
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold">Docker</h2>
                <p className="text-sm text-[var(--color-fg-mute)] mt-1">
                  ShadowHost runs each Minecraft server in its own Docker
                  container. Docker keeps things isolated and works the same on
                  Windows, macOS and Linux.
                </p>
                <div className="mt-3 p-3 rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-deep)]/40 text-sm space-y-1">
                  <Row label="Installed" value={docker?.installed} />
                  <Row label="Running" value={docker?.running} />
                  {docker?.version && (
                    <Row label="Version" value={docker.version} info />
                  )}
                  {docker?.path && (
                    <Row label="Path" value={docker.path} info mono />
                  )}
                  {docker?.error && (
                    <div className="text-red-300 text-xs mt-2">
                      {docker.error}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <Button variant="secondary" size="sm" onClick={refreshDocker}>
                    <RefreshCw className="size-3.5" />
                    Re-check
                  </Button>
                  {!docker?.installed && (
                    <a
                      href={platformLink(os)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow shadow-violet-900/40 hover:from-violet-400 hover:to-fuchsia-500"
                    >
                      <Download className="size-3.5" />
                      Install Docker
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                  <div className="ml-auto">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setStep(1)}
                      disabled={!dockerOk}
                    >
                      Continue
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-violet-500/15 grid place-items-center shrink-0">
                <FolderOpen className="size-6 text-violet-300" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold">Storage & defaults</h2>
                <p className="text-sm text-[var(--color-fg-mute)] mt-1">
                  Pick a folder where new server worlds will live, and set a
                  default amount of RAM.
                </p>
                <div className="mt-4 space-y-3">
                  <div>
                    <Label>Default data directory</Label>
                    <div className="flex gap-2">
                      <Input
                        value={dataDir}
                        onChange={(e) => setDataDir(e.target.value)}
                        placeholder="Leave empty to use the system default"
                        className="font-mono"
                      />
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          const p = await pickDirectory();
                          if (p) setDataDir(p);
                        }}
                      >
                        <FolderOpen className="size-4" />
                        Browse
                      </Button>
                    </div>
                    <p className="text-[11px] text-[var(--color-fg-mute)] mt-1">
                      Each server gets its own subfolder. Default is the system
                      app-data folder.
                    </p>
                  </div>
                  <div>
                    <Label>
                      Default memory ({ram} MB
                      {systemInfo && ` · system has ${systemInfo.total_ram_mb} MB`})
                    </Label>
                    <input
                      type="range"
                      min={512}
                      max={Math.max(1024, (systemInfo?.total_ram_mb ?? 8192) - 1024)}
                      step={256}
                      value={ram}
                      onChange={(e) => setRam(Number(e.target.value))}
                      className="w-full accent-violet-500"
                    />
                  </div>
                </div>

                <div className="flex justify-between mt-5">
                  <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setStep(2)}
                  >
                    Continue
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-violet-500/15 grid place-items-center shrink-0">
                <Download className="size-6 text-violet-300" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold">Server image</h2>
                <p className="text-sm text-[var(--color-fg-mute)] mt-1">
                  Pull the official Minecraft server image so your first server
                  starts instantly. You can skip this and pull on demand later.
                </p>
                <div className="mt-3 p-3 rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-deep)]/40 font-mono text-xs">
                  {DEFAULT_IMAGE}
                </div>
                <ImageStatus
                  status={imageStatus}
                  error={pullError}
                  onCheck={checkImage}
                />

                <div className="flex flex-wrap items-center gap-2 mt-5">
                  <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  {imageStatus !== "present" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={pull}
                      disabled={imageStatus === "pulling"}
                    >
                      <Download className="size-3.5" />
                      {imageStatus === "pulling" ? "Pulling …" : "Pull image"}
                    </Button>
                  )}
                  <div className="ml-auto">
                    <Button variant="primary" size="sm" onClick={() => setStep(3)}>
                      Continue
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <div className="text-center py-6">
              <div className="size-14 mx-auto rounded-2xl bg-emerald-500/15 grid place-items-center mb-3">
                <Check className="size-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold">You&apos;re all set</h2>
              <p className="text-sm text-[var(--color-fg-mute)] mt-1 max-w-md mx-auto">
                Create your first server next — pick a template, name it, and
                ShadowHost handles the rest.
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={finalize}
                className="mt-5"
              >
                <Server className="size-4" />
                Open dashboard
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, info, mono }) {
  const isBool = typeof value === "boolean";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-[var(--color-fg-mute)]">{label}</span>
      <span
        className={cn(
          "text-xs font-medium truncate",
          mono && "font-mono",
          isBool && value && "text-emerald-300",
          isBool && !value && "text-red-300",
          info && !isBool && "text-[var(--color-fg-base)]",
        )}
      >
        {isBool ? (value ? "yes" : "no") : value}
      </span>
    </div>
  );
}

function ImageStatus({ status, error, onCheck }) {
  if (status === "idle" || status === "checking") {
    return (
      <p className="text-xs text-[var(--color-fg-mute)] mt-2 inline-flex items-center gap-1.5">
        <RefreshCw className="size-3 animate-spin" />
        Checking …
      </p>
    );
  }
  if (status === "present") {
    return (
      <p className="text-sm text-emerald-300 mt-3 inline-flex items-center gap-2">
        <Check className="size-4" />
        Image is available locally.
      </p>
    );
  }
  if (status === "missing") {
    return (
      <p className="text-sm text-amber-200 mt-3">
        Image not present yet — click <b>Pull image</b> to download (~600 MB).
        ShadowHost can also pull it automatically the first time you start a
        server.
      </p>
    );
  }
  if (status === "pulling") {
    return (
      <p className="text-sm text-violet-300 mt-3 inline-flex items-center gap-2">
        <RefreshCw className="size-4 animate-spin" />
        Pulling — this can take a couple of minutes …
      </p>
    );
  }
  if (status === "error") {
    return (
      <div className="mt-3">
        <p className="text-sm text-red-300">{error || "Pull failed."}</p>
        <Button variant="ghost" size="sm" onClick={onCheck} className="mt-1">
          <RefreshCw className="size-3.5" />
          Retry
        </Button>
      </div>
    );
  }
  return null;
}

function Stepper({ step }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2 flex-1">
          <div
            className={cn(
              "size-6 rounded-full grid place-items-center text-xs font-semibold transition-colors",
              i < step && "bg-violet-500 text-white",
              i === step &&
                "bg-violet-500/20 text-violet-300 border border-violet-500/40",
              i > step && "bg-[var(--color-bg-elev)] text-[var(--color-fg-mute)]",
            )}
          >
            {i < step ? <Check className="size-3" /> : i + 1}
          </div>
          <div
            className={cn(
              "text-xs font-medium hidden sm:block",
              i === step ? "text-white" : "text-[var(--color-fg-mute)]",
            )}
          >
            {label}
          </div>
          {i < STEPS.length - 1 && (
            <div className="flex-1 h-px bg-[var(--color-border-base)]" />
          )}
        </div>
      ))}
    </div>
  );
}
