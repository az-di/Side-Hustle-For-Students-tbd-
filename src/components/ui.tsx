import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Tiny class joiner — avoids pulling in clsx for six components. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ──────────────────────────────── buttons ─────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-ink",
  secondary: "bg-surface text-ink border border-line hover:border-ink-faint",
  ghost: "text-ink-soft hover:bg-brand-soft hover:text-brand-ink",
  danger: "bg-danger-soft text-danger border border-danger/20 hover:bg-danger hover:text-white",
};

const BUTTON_SIZES = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: keyof typeof BUTTON_SIZES }) {
  return (
    <button
      {...props}
      className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: keyof typeof BUTTON_SIZES }) {
  return (
    <Link {...props} className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)} />
  );
}

// ──────────────────────────────── surfaces ────────────────────────────────

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx("rounded-card border border-line bg-surface p-4", className)}>{children}</div>
  );
}

export function CardLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cx(
        "block rounded-card border border-line bg-surface p-4 transition-colors hover:border-brand/40",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-soft">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface px-5 py-10 text-center">
      <p className="font-medium">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">{body}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

// ──────────────────────────────── form bits ───────────────────────────────

const FIELD =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-ink-faint " +
  "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cx(FIELD, className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cx(FIELD, "min-h-24 resize-y", className)} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} className={cx(FIELD, "appearance-none", className)} />;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-ink-soft">{hint}</span> : null}
    </label>
  );
}

export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
      {children}
    </p>
  );
}

// ──────────────────────────────── indicators ──────────────────────────────

type BadgeTone = "neutral" | "brand" | "money" | "warn" | "danger";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-canvas text-ink-soft border-line",
  brand: "bg-brand-soft text-brand-ink border-brand/20",
  money: "bg-money-soft text-money border-money/20",
  warn: "bg-warn-soft text-warn border-warn/20",
  danger: "bg-danger-soft text-danger border-danger/20",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Rating display. `count` of 0 renders "No reviews yet" rather than 0 stars. */
export function Stars({ rating, count }: { rating: number | null; count: number }) {
  if (!rating || count === 0) {
    return <span className="text-xs text-ink-faint">No reviews yet</span>;
  }
  const rounded = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span aria-hidden className="text-warn">
        {"★".repeat(rounded)}
        <span className="text-line">{"★".repeat(5 - rounded)}</span>
      </span>
      <span className="text-ink-soft">
        {rating.toFixed(1)}
        <span className="text-ink-faint"> ({count})</span>
      </span>
      <span className="sr-only">
        {rating.toFixed(1)} out of 5, {count} review{count === 1 ? "" : "s"}
      </span>
    </span>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-ink"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/**
 * The money line on a SELLER-facing surface. Deliberately labelled "You'd
 * receive" so there is never a question of whose number this is.
 */
export function PayoutLine({ label = "You'd receive", children }: { label?: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-xs uppercase tracking-wide text-ink-faint">{label}</span>
      <span className="text-lg font-semibold text-money">{children}</span>
    </span>
  );
}

export function TagChip({ name, kind }: { name: string; kind?: "SERVICE" | "COURSE" }) {
  return <Badge tone={kind === "COURSE" ? "neutral" : "brand"}>{name}</Badge>;
}

// RelativeTime and Countdown read the clock during render. They are server
// components rendered fresh on every request, so the value is stable for the
// lifetime of the response; the purity rule is about client re-renders.
export function RelativeTime({ date }: { date: Date }) {
  // eslint-disable-next-line react-hooks/purity
  const ms = Date.now() - date.getTime();
  const mins = Math.round(ms / 60_000);
  const label =
    mins < 1
      ? "just now"
      : mins < 60
        ? `${mins}m ago`
        : mins < 60 * 24
          ? `${Math.round(mins / 60)}h ago`
          : `${Math.round(mins / (60 * 24))}d ago`;
  return (
    <time dateTime={date.toISOString()} className="text-xs text-ink-faint">
      {label}
    </time>
  );
}

/** Counts down to a request's deadline. Renders "Expired" once past. */
export function Countdown({ to }: { to: Date }) {
  // eslint-disable-next-line react-hooks/purity
  const ms = to.getTime() - Date.now();
  if (ms <= 0) return <Badge tone="neutral">Expired</Badge>;
  const hours = Math.floor(ms / 3_600_000);
  const label = hours >= 24 ? `${Math.floor(hours / 24)}d left` : hours >= 1 ? `${hours}h left` : "under 1h left";
  return <Badge tone={hours < 24 ? "warn" : "neutral"}>{label}</Badge>;
}
