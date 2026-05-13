import { useEffect, useState } from "react";
import { Save, Trash2, Plus, X } from "lucide-react";
import { Button, Input, Label } from "../ui";
import { useServer } from "../../state/ServerContext";
import { api } from "../../lib/api";

export default function SettingsTab({ server, onChange }) {
  const { systemInfo, refreshServers } = useServer();
  const [draft, setDraft] = useState(server);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [newEnvKey, setNewEnvKey] = useState("");

  useEffect(() => {
    setDraft(server);
  }, [server]);

  const totalRam = systemInfo?.total_ram_mb ?? 16384;
  const maxAllowed = Math.max(1024, totalRam - 1024);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateServer({ ...draft, env: draft.env });
      setSaved(true);
      onChange?.();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (deleteFiles) => {
    const text = deleteFiles
      ? `Delete "${draft.name}" AND its world data?`
      : `Delete "${draft.name}"? World data on disk is kept.`;
    if (!confirm(text)) return;
    try {
      await api.deleteServer(draft.id, deleteFiles);
      await refreshServers();
      window.history.back();
    } catch (e) {
      setError(String(e));
    }
  };

  const setEnv = (key, value) => {
    setDraft((d) => ({ ...d, env: { ...d.env, [key]: value } }));
  };
  const removeEnv = (key) => {
    setDraft((d) => {
      const ne = { ...d.env };
      delete ne[key];
      return { ...d, env: ne };
    });
  };
  const addEnv = () => {
    const k = newEnvKey.trim();
    if (!k) return;
    setEnv(k, "");
    setNewEnvKey("");
  };

  return (
    <div className="h-full overflow-auto space-y-5 pr-1">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">General</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label>Name</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Image</Label>
            <Input
              value={draft.image}
              onChange={(e) => setDraft({ ...draft, image: e.target.value })}
              className="font-mono text-xs"
            />
          </div>
          <div>
            <Label>World folder</Label>
            <Input
              value={draft.data_dir}
              onChange={(e) => setDraft({ ...draft, data_dir: e.target.value })}
              className="font-mono text-xs"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Network</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Host port</Label>
            <Input
              type="number"
              value={draft.port}
              onChange={(e) =>
                setDraft({ ...draft, port: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Protocol</Label>
            <select
              value={draft.port_protocol}
              onChange={(e) =>
                setDraft({ ...draft, port_protocol: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-base)] text-sm"
            >
              <option value="tcp">TCP (Java)</option>
              <option value="udp">UDP (Bedrock)</option>
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Resources</h3>
        <div>
          <Label>
            RAM ({draft.max_ram_mb} MB · max {maxAllowed} MB)
          </Label>
          <input
            type="range"
            min={512}
            max={maxAllowed}
            step={256}
            value={draft.max_ram_mb}
            onChange={(e) =>
              setDraft({ ...draft, max_ram_mb: Number(e.target.value) })
            }
            className="w-full accent-violet-500"
          />
        </div>
        <div>
          <Label>CPU limit (cores · 0 = unlimited)</Label>
          <Input
            type="number"
            step="0.1"
            value={draft.cpu_limit}
            onChange={(e) =>
              setDraft({ ...draft, cpu_limit: Number(e.target.value) })
            }
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Container environment</h3>
        <div className="space-y-1.5">
          {Object.entries(draft.env || {}).map(([k, v]) => (
            <div
              key={k}
              className="grid grid-cols-[1fr_1.4fr_auto] gap-2 items-center"
            >
              <Input value={k} readOnly className="font-mono text-xs opacity-70" />
              <Input
                value={v}
                onChange={(e) => setEnv(k, e.target.value)}
                className="font-mono text-xs"
              />
              <Button variant="ghost" size="sm" onClick={() => removeEnv(k)}>
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Input
              value={newEnvKey}
              onChange={(e) => setNewEnvKey(e.target.value)}
              placeholder="New ENV key …"
              className="font-mono text-xs"
            />
            <Button variant="secondary" size="md" onClick={addEnv}>
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>
        </div>
      </section>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="sticky bottom-0 -mx-1 px-1 py-2 bg-gradient-to-t from-[var(--color-bg-base)] to-transparent flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleDelete(false)}>
            <Trash2 className="size-3.5 text-red-400" />
            Delete server
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(true)}>
            <Trash2 className="size-3.5 text-red-400" />
            Delete + world data
          </Button>
        </div>
        <Button variant="primary" onClick={save} disabled={saving}>
          <Save className="size-4" />
          {saved ? "Saved ✓" : saving ? "Saving …" : "Save"}
        </Button>
      </div>
    </div>
  );
}
