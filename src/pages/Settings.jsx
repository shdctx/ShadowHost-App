import { useEffect, useState } from "react";
import { Save, FolderOpen, RotateCcw } from "lucide-react";
import { Button, Card, CardHeader, Input, Label, Toggle } from "../components/ui";
import { useServer } from "../state/ServerContext";
import { pickDirectory, api } from "../lib/api";

export default function SettingsPage({ onReplaySetup }) {
  const { settings, systemInfo, updateSettings, refreshSettings } = useServer();
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (settings && !draft) setDraft(settings);
  }, [settings, draft]);

  if (!draft) {
    return (
      <Card>
        <div className="text-center text-[var(--color-fg-mute)] py-8">
          Loading settings …
        </div>
      </Card>
    );
  }

  const update = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateSettings(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const restartSetup = async () => {
    await api.saveSettings({ ...draft, setup_completed: false });
    await refreshSettings();
    onReplaySetup?.();
  };

  const totalRam = systemInfo?.total_ram_mb ?? 16384;

  return (
    <div className="space-y-5 max-w-2xl">
      <Card>
        <CardHeader
          title="Global defaults"
          subtitle="Pre-filled values when you create a new server."
        />
        <div className="space-y-4">
          <div>
            <Label>Default data directory</Label>
            <div className="flex gap-2">
              <Input
                value={draft.default_data_dir}
                onChange={(e) => update({ default_data_dir: e.target.value })}
                placeholder="Leave empty to use the system default"
                className="font-mono"
              />
              <Button
                variant="secondary"
                onClick={async () => {
                  const p = await pickDirectory();
                  if (p) update({ default_data_dir: p });
                }}
              >
                <FolderOpen className="size-4" />
                Browse
              </Button>
            </div>
            <p className="text-[11px] text-[var(--color-fg-mute)] mt-1.5">
              Each server gets its own subfolder named after its ID.
            </p>
          </div>

          <div>
            <Label>
              Default RAM ({draft.default_ram_mb} MB · system: {totalRam} MB)
            </Label>
            <input
              type="range"
              min={512}
              max={Math.max(1024, totalRam - 1024)}
              step={256}
              value={draft.default_ram_mb}
              onChange={(e) =>
                update({ default_ram_mb: Number(e.target.value) })
              }
              className="w-full accent-violet-500"
            />
          </div>

          <div>
            <Label>Default CPU limit (cores · 0 = unlimited)</Label>
            <Input
              type="number"
              step="0.1"
              value={draft.default_cpu_limit}
              onChange={(e) =>
                update({ default_cpu_limit: Number(e.target.value) })
              }
            />
          </div>

          <div className="border-t border-[var(--color-border-base)] pt-4">
            <Toggle
              checked={draft.auto_pull_images}
              onChange={(v) => update({ auto_pull_images: v })}
              label="Auto-update Docker images on server start"
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Setup"
          subtitle="Re-run the first-time setup wizard."
        />
        <Button variant="secondary" onClick={restartSetup}>
          <RotateCcw className="size-3.5" />
          Replay setup
        </Button>
      </Card>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        onClick={save}
        disabled={saving}
        className="w-full"
      >
        <Save className="size-4" />
        {saved ? "Saved ✓" : saving ? "Saving …" : "Save"}
      </Button>
    </div>
  );
}
