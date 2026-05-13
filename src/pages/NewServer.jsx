import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, Server, FolderOpen } from "lucide-react";
import { Button, Card, CardHeader, Input, Label } from "../components/ui";
import { useServer } from "../state/ServerContext";
import { api, pickDirectory } from "../lib/api";
import { cn } from "../lib/cn";

const STEPS = ["Template", "Configuration", "Review"];

export default function NewServer({ onNavigate }) {
  const { eggs, settings, systemInfo, refreshServers } = useServer();
  const [step, setStep] = useState(0);
  const [eggId, setEggId] = useState(eggs[0]?.id ?? "paper");
  const [name, setName] = useState("");
  const [port, setPort] = useState(25565);
  const [ram, setRam] = useState(settings?.default_ram_mb ?? 2048);
  const [cpu, setCpu] = useState(settings?.default_cpu_limit ?? 0);
  const [dataDir, setDataDir] = useState("");
  const [envOverrides, setEnvOverrides] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const egg = useMemo(() => eggs.find((e) => e.id === eggId), [eggs, eggId]);

  useEffect(() => {
    if (egg) {
      setPort(egg.default_port);
      const init = {};
      egg.variables.forEach((v) => {
        init[v.key] = v.default;
      });
      setEnvOverrides(init);
    }
  }, [eggId, egg]);

  const totalRam = systemInfo?.total_ram_mb ?? 16384;
  const maxAllowed = Math.max(1024, totalRam - 1024);

  const submit = async () => {
    if (!name.trim()) {
      setError("Please choose a name.");
      setStep(1);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createServer({
        name: name.trim(),
        egg_id: eggId,
        port: Number(port),
        max_ram_mb: Number(ram),
        cpu_limit: Number(cpu),
        data_dir: dataDir || null,
        env_overrides: envOverrides,
      });
      await refreshServers();
      onNavigate({ page: "server", serverId: created.id });
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate({ page: "overview" })}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <h2 className="text-lg font-semibold tracking-tight">New server</h2>
      </div>

      <Stepper step={step} />

      {step === 0 && (
        <Card>
          <CardHeader
            title="Pick a template"
            subtitle="The template selects the Docker image and sensible defaults."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {eggs.map((e) => (
              <button
                key={e.id}
                onClick={() => setEggId(e.id)}
                className={cn(
                  "text-left p-4 rounded-xl border transition-colors",
                  eggId === e.id
                    ? "border-violet-500/50 bg-violet-500/10"
                    : "border-[var(--color-border-base)] bg-[var(--color-bg-deep)]/40 hover:bg-[var(--color-bg-elev)]",
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold">{e.name}</div>
                  {eggId === e.id && (
                    <Check className="size-4 text-violet-400" />
                  )}
                </div>
                <p className="text-xs text-[var(--color-fg-mute)] leading-relaxed">
                  {e.description}
                </p>
                <div className="mt-2 text-[10px] font-mono text-[var(--color-fg-mute)]">
                  {e.image}
                </div>
              </button>
            ))}
          </div>
          <div className="flex justify-end mt-5">
            <Button variant="primary" onClick={() => setStep(1)}>
              Continue
            </Button>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader
            title="Configuration"
            subtitle={`${egg?.name} · ${egg?.image}`}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Server name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Survival World"
                autoFocus
              />
            </div>

            <div>
              <Label>Host port</Label>
              <Input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
              />
              <p className="text-[11px] text-[var(--color-fg-mute)] mt-1">
                {egg?.category === "bedrock"
                  ? "UDP · Bedrock default 19132"
                  : "TCP · Java default 25565"}
              </p>
            </div>

            <div>
              <Label>CPU limit (cores)</Label>
              <Input
                type="number"
                step="0.1"
                value={cpu}
                onChange={(e) => setCpu(e.target.value)}
                placeholder="0 = unlimited"
              />
            </div>

            <div className="md:col-span-2">
              <Label>RAM ({ram} MB · max {maxAllowed} MB)</Label>
              <input
                type="range"
                min={512}
                max={maxAllowed}
                step={256}
                value={ram}
                onChange={(e) => setRam(Number(e.target.value))}
                className="w-full accent-violet-500"
              />
            </div>

            <div className="md:col-span-2">
              <Label>World folder (optional)</Label>
              <div className="flex gap-2">
                <Input
                  value={dataDir}
                  onChange={(e) => setDataDir(e.target.value)}
                  placeholder="Leave empty to use the ShadowHost default"
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
            </div>
          </div>

          {egg && egg.variables.length > 0 && (
            <div className="mt-6 border-t border-[var(--color-border-base)] pt-4">
              <div className="text-sm font-medium mb-3">
                Template variables
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {egg.variables.map((v) => (
                  <div key={v.key}>
                    <Label>{v.label}</Label>
                    {v.kind === "select" ? (
                      <select
                        value={envOverrides[v.key] ?? v.default}
                        onChange={(e) =>
                          setEnvOverrides((p) => ({
                            ...p,
                            [v.key]: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-base)] text-sm"
                      >
                        {v.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        type={v.kind === "number" ? "number" : "text"}
                        value={envOverrides[v.key] ?? v.default}
                        onChange={(e) =>
                          setEnvOverrides((p) => ({
                            ...p,
                            [v.key]: e.target.value,
                          }))
                        }
                      />
                    )}
                    {v.description && (
                      <p className="text-[11px] text-[var(--color-fg-mute)] mt-1">
                        {v.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button
              variant="primary"
              onClick={() => setStep(2)}
              disabled={!name.trim()}
            >
              Continue
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader
            title="Review"
            subtitle="Double-check the configuration and create the server."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <SummaryRow label="Name" value={name} />
            <SummaryRow label="Template" value={egg?.name} />
            <SummaryRow label="Image" value={egg?.image} />
            <SummaryRow
              label="Port"
              value={`${port} ${egg?.category === "bedrock" ? "UDP" : "TCP"}`}
            />
            <SummaryRow label="RAM" value={`${ram} MB`} />
            <SummaryRow
              label="CPU"
              value={cpu > 0 ? `${cpu} cores` : "unlimited"}
            />
            <SummaryRow
              label="World folder"
              value={dataDir || "ShadowHost default"}
              className="md:col-span-2"
            />
          </div>

          {error && (
            <div className="p-3 mb-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button variant="primary" onClick={submit} disabled={submitting}>
              <Server className="size-4" />
              {submitting ? "Creating …" : "Create server"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
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
              i === step && "bg-violet-500/20 text-violet-300 border border-violet-500/40",
              i > step && "bg-[var(--color-bg-elev)] text-[var(--color-fg-mute)]",
            )}
          >
            {i < step ? <Check className="size-3" /> : i + 1}
          </div>
          <div
            className={cn(
              "text-xs font-medium",
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

function SummaryRow({ label, value, className }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-deep)]/40 p-3",
        className,
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-mute)] font-medium">
        {label}
      </div>
      <div className="text-sm mt-0.5 font-medium truncate">{value || "—"}</div>
    </div>
  );
}
