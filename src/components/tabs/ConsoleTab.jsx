import { useEffect, useRef, useState } from "react";
import { Send, Trash2, ArrowDownToLine, Pause } from "lucide-react";
import { Button, Input } from "../ui";
import { useServer } from "../../state/ServerContext";
import { api } from "../../lib/api";
import { cn } from "../../lib/cn";

export default function ConsoleTab({ server, state }) {
  const { getLogs, clearLogs, logTick } = useServer();
  const logs = getLogs(server.id);
  const [input, setInput] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const scrollRef = useRef(null);

  useEffect(() => {}, [logTick]);

  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length, logTick, autoScroll]);

  const isRunning = state === "running" || state === "starting";

  const submit = async (e) => {
    e?.preventDefault();
    const cmd = input.trim();
    if (!cmd || !isRunning) return;
    try {
      await api.sendCommand(server.id, cmd);
      setHistory((h) => [...h.slice(-50), cmd]);
      setHistoryIdx(-1);
      setInput("");
    } catch (err) {
      alert("Error: " + err);
    }
  };

  const onKey = (e) => {
    if (e.key === "ArrowUp" && history.length) {
      e.preventDefault();
      const next = historyIdx < 0 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(next);
      setInput(history[next]);
    } else if (e.key === "ArrowDown" && historyIdx >= 0) {
      e.preventDefault();
      const next = historyIdx + 1;
      if (next >= history.length) {
        setHistoryIdx(-1);
        setInput("");
      } else {
        setHistoryIdx(next);
        setInput(history[next]);
      }
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-end gap-2 mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAutoScroll((v) => !v)}
        >
          {autoScroll ? (
            <ArrowDownToLine className="size-3.5" />
          ) : (
            <Pause className="size-3.5" />
          )}
          {autoScroll ? "Auto" : "Paused"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => clearLogs(server.id)}>
          <Trash2 className="size-3.5" />
          Clear
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 rounded-lg border border-[var(--color-border-base)] bg-black/40 p-3 overflow-auto"
      >
        {logs.length === 0 ? (
          <div className="text-[var(--color-fg-mute)] text-sm py-12 text-center">
            No output yet. Start the server to see live logs here.
          </div>
        ) : (
          logs.map((line) => (
            <div
              key={line.key}
              className={cn(
                "console-line",
                line.stream === "stderr" && "text-red-300",
                line.stream === "system" && "text-violet-300 font-medium",
                line.stream === "input" && "text-emerald-300",
                line.stream === "stdout" && "text-[var(--color-fg-base)]",
              )}
            >
              {line.text}
            </div>
          ))
        )}
      </div>

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder={
            isRunning
              ? "Enter command … (e.g. say Hello)"
              : "Server is not running"
          }
          disabled={!isRunning}
          className="font-mono"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!isRunning || !input.trim()}
        >
          <Send className="size-4" />
          Send
        </Button>
      </form>
    </div>
  );
}
