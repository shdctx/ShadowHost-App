import { cn } from "../lib/cn";

export function Card({ className, children, ...rest }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--color-border-base)] bg-[var(--color-bg-base)]/60 backdrop-blur p-5 shadow-lg shadow-black/20",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-4 gap-4">
      <div>
        <div className="font-semibold text-[var(--color-fg-base)] tracking-tight">
          {title}
        </div>
        {subtitle && (
          <div className="text-xs text-[var(--color-fg-mute)] mt-0.5">{subtitle}</div>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

const variants = {
  primary:
    "bg-gradient-to-br from-violet-500 to-fuchsia-600 hover:from-violet-400 hover:to-fuchsia-500 text-white shadow-md shadow-violet-900/40",
  secondary:
    "bg-[var(--color-bg-elev)] hover:bg-[var(--color-bg-hover)] text-[var(--color-fg-base)] border border-[var(--color-border-base)]",
  danger:
    "bg-red-600/90 hover:bg-red-500 text-white shadow-md shadow-red-900/40",
  ghost:
    "hover:bg-[var(--color-bg-elev)] text-[var(--color-fg-mute)] hover:text-white",
  success:
    "bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/40",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  disabled,
  ...rest
}) {
  return (
    <button
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:saturate-50",
        "focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-[var(--color-bg-deep)]",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-5 py-2.5 text-sm",
        variants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Input({ className, ...rest }) {
  return (
    <input
      className={cn(
        "w-full px-3 py-2 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-base)]",
        "text-sm text-[var(--color-fg-base)] placeholder:text-[var(--color-fg-mute)]/60",
        "focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 transition-colors",
        className,
      )}
      {...rest}
    />
  );
}

export function Label({ children, className }) {
  return (
    <label
      className={cn(
        "block text-xs font-medium uppercase tracking-wider text-[var(--color-fg-mute)] mb-1.5",
        className,
      )}
    >
      {children}
    </label>
  );
}

export function Stat({ label, value, hint, accent = false }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-deep)]/40 p-3",
        accent && "border-violet-500/30 bg-violet-500/5",
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-mute)] font-medium">
        {label}
      </div>
      <div className="text-lg font-semibold mt-1 tracking-tight">{value}</div>
      {hint && (
        <div className="text-[11px] text-[var(--color-fg-mute)] mt-0.5">{hint}</div>
      )}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <span
        className={cn(
          "relative inline-block w-10 h-5 rounded-full transition-colors",
          checked ? "bg-violet-500" : "bg-[var(--color-bg-hover)]",
        )}
        onClick={() => onChange(!checked)}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5",
          )}
        />
      </span>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}

export function StatusPill({ status }) {
  const m = {
    stopped: { txt: "Offline", cls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30" },
    starting: { txt: "Starting", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
    running: { txt: "Online", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
    stopping: { txt: "Stopping", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  };
  const c = m[status] ?? m.stopped;
  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium border", c.cls)}>
      {c.txt}
    </span>
  );
}
