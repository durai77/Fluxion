import { ReactNode } from "react";
import { ArrowRight, FolderOpen, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  className?: string;
}

interface BrandMarkProps {
  compact?: boolean;
}

interface SurfaceCardProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

interface MetricCardProps {
  label: string;
  value: string;
  detail?: string;
  tone?: "primary" | "success" | "warning" | "neutral";
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function AppShell({ children, className }: AppShellProps) {
  return (
    <div className={cn("app-shell-bg min-h-screen overflow-auto lg:overflow-hidden text-[var(--dash-text-primary)]", className)}>
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-[var(--dash-accent)] shadow-[var(--dash-shadow)]">
        <div className="absolute inset-[1px] rounded-[15px] bg-white/10" />
        <div className="relative flex h-full w-full items-center justify-center">
          <FolderOpen className="h-5 w-5 text-[var(--dash-bg)]" />
        </div>
      </div>
      {!compact && (
        <div>
          <div className="font-display text-xl font-semibold tracking-tight text-[var(--dash-text-primary)]">Fluxion</div>
          <div className="text-[0.8125rem] font-medium uppercase tracking-[0.22em] text-[var(--dash-text-subtle)]">
            Cloud File Workspace
          </div>
        </div>
      )}
    </div>
  );
}

export function HeroBadge({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] px-5 py-2.5 text-[0.8125rem] font-semibold uppercase tracking-[0.24em] text-[var(--dash-text-muted)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <Sparkles className="h-3.5 w-3.5 text-[var(--dash-text-subtle)]" />
      {children}
    </div>
  );
}

export function SurfaceCard({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: SurfaceCardProps) {
  return (
    <section className={cn("surface-card p-7 md:p-8", className)}>
      {(eyebrow || title || description || actions) && (
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            {eyebrow && (
              <div className="text-[0.8125rem] font-semibold uppercase tracking-[0.26em] text-[var(--dash-text-subtle)]">{eyebrow}</div>
            )}
            {title && <h2 className="font-display text-[1.625rem] font-semibold tracking-tight text-[var(--dash-text-primary)]">{title}</h2>}
            {description && <p className="max-w-2xl text-[0.9375rem] leading-7 text-[var(--dash-text-muted)]">{description}</p>}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

export function MetricCard({ label, value, detail, tone = "neutral" }: MetricCardProps) {
  return (
    <div className="rounded-3xl border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="text-[0.8125rem] font-semibold uppercase tracking-[0.22em] text-[var(--dash-text-subtle)]">{label}</div>
      <div className="mt-3 font-display text-[2rem] font-semibold tracking-tight text-[var(--dash-text-primary)]">{value}</div>
      {detail ? <div className="mt-2 text-[0.9375rem] text-[var(--dash-text-muted)]">{detail}</div> : null}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "primary" | "success" | "warning" | "danger" | "neutral";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-[var(--dash-inset)] text-[var(--dash-text-secondary)] border-[var(--dash-panel-border)]"
      : tone === "success"
        ? "bg-[#F0FDF4] text-[#166534] border-[#BBF7D0] dark:bg-[#052E16] dark:text-[#86EFAC] dark:border-[#14532D]"
        : tone === "warning"
          ? "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A] dark:bg-[#451A03] dark:text-[#FCD34D] dark:border-[#78350F]"
          : tone === "danger"
            ? "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA] dark:bg-[#450A0A] dark:text-[#FCA5A5] dark:border-[#7F1D1D]"
            : "bg-[var(--dash-inset)] text-[var(--dash-text-muted)] border-[var(--dash-panel-border)]";

  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold", toneClass)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("rounded-[28px] border border-dashed border-[var(--dash-field-border)] bg-[var(--dash-inset)] px-6 py-12 text-center", className)}>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--dash-row-selected)] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <ArrowRight className="h-5 w-5 text-[var(--dash-text-muted)]" />
      </div>
      <h3 className="mt-5 font-display text-[1.375rem] font-semibold text-[var(--dash-text-primary)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-[0.9375rem] leading-7 text-[var(--dash-text-muted)]">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ProgressBar({ value, tone = "primary" }: { value: number; tone?: "primary" | "success" | "warning" }) {
  const barClass =
    tone === "success"
      ? "bg-[#22C55E]"
      : tone === "warning"
        ? "bg-[#F59E0B]"
        : "bg-[var(--dash-accent)]";

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--dash-panel-border)]">
      <div
        className={cn("h-full rounded-full transition-all duration-300", barClass)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
