import { useEffect, useState } from "react";
import {
  Folder,
  FileText,
  RefreshCw,
  Save,
  ChevronUp,
  ChevronRight,
} from "lucide-react";
import { Button } from "../ui";
import { api } from "../../lib/api";

const TEXT_EXT = [
  "txt", "yml", "yaml", "json", "properties", "toml", "log",
  "ini", "cfg", "conf", "md", "sh",
];

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function FilesTab({ server }) {
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);

  const load = async (sub) => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listFiles(server.id, sub);
      setEntries(list);
      setPath(sub);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load("");
  }, [server.id]);

  const goUp = () => {
    if (!path) return;
    const parts = path.split("/").filter(Boolean);
    parts.pop();
    load(parts.join("/"));
  };

  const openEntry = async (e) => {
    if (e.is_dir) {
      load(e.path);
      return;
    }
    const ext = e.name.split(".").pop()?.toLowerCase();
    const isText = TEXT_EXT.includes(ext) || !e.name.includes(".");
    if (!isText) {
      alert("Binary files can't be opened in the editor.");
      return;
    }
    try {
      const content = await api.readFile(server.id, e.path);
      setEditing({ name: e.name, path: e.path, content, original: content });
    } catch (err) {
      setError(String(err));
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await api.writeFile(server.id, editing.path, editing.content);
      setEditing({ ...editing, original: editing.content });
    } catch (e) {
      setError(String(e));
    }
  };

  if (editing) {
    const dirty = editing.content !== editing.original;
    return (
      <div className="h-full flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(null)}
            >
              <ChevronUp className="size-3.5 rotate-90" />
              Back
            </Button>
            <span className="font-mono text-sm truncate">/{editing.path}</span>
            {dirty && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Modified
              </span>
            )}
          </div>
          <Button variant="primary" size="sm" onClick={saveEdit} disabled={!dirty}>
            <Save className="size-3.5" />
            Save
          </Button>
        </div>
        <textarea
          value={editing.content}
          onChange={(e) => setEditing({ ...editing, content: e.target.value })}
          spellCheck={false}
          className="flex-1 min-h-0 font-mono text-[12.5px] p-3 rounded-lg bg-black/40 border border-[var(--color-border-base)] resize-none focus:outline-none focus:border-violet-500/50"
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Button variant="ghost" size="sm" onClick={goUp} disabled={!path}>
          <ChevronUp className="size-3.5" />
          Up
        </Button>
        <div className="font-mono text-xs text-[var(--color-fg-mute)] flex-1 min-w-0 truncate">
          /{path}
        </div>
        <Button variant="ghost" size="sm" onClick={() => load(path)} disabled={loading}>
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error && (
        <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-deep)]/30">
        {entries.length === 0 ? (
          <div className="text-sm text-[var(--color-fg-mute)] py-12 text-center">
            {loading ? "Loading …" : "This folder is empty."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {entries.map((e) => (
                <tr
                  key={e.path}
                  onClick={() => openEntry(e)}
                  className="hover:bg-[var(--color-bg-hover)] cursor-pointer border-b border-[var(--color-border-base)]/40 last:border-0"
                >
                  <td className="px-3 py-2 w-7">
                    {e.is_dir ? (
                      <Folder className="size-4 text-violet-400" />
                    ) : (
                      <FileText className="size-4 text-[var(--color-fg-mute)]" />
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono">{e.name}</td>
                  <td className="px-3 py-2 text-xs text-[var(--color-fg-mute)] text-right">
                    {e.is_dir ? "—" : formatSize(e.size)}
                  </td>
                  <td className="px-3 py-2 w-7">
                    <ChevronRight className="size-3.5 text-[var(--color-fg-mute)]" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
