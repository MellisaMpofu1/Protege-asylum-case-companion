import logo from "@/assets/protege-logo.png.asset.json";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n, type TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="Protege — Your asylum case companion in Portugal"
      width={1920}
      height={640}
      className={cn("h-auto w-44 max-w-full", className)}
    />
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <h1 className="min-w-0 break-words text-2xl font-semibold text-foreground md:text-3xl">{title}</h1>
      {children}
    </div>
  );
}

export function Section({
  title,
  children,
  action,
  className,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0 border-t py-5 md:py-6", className)} aria-label={title}>
      {(title || action) && (
        <div className="mb-4 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          {title && <h2 className="min-w-0 text-lg font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Loading() {
  const { t } = useI18n();
  return (
    <div role="status" className="flex items-center gap-2 py-8 text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden /> {t("loading")}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  const msg = (error as { message?: string })?.message ?? "";
  const key: TKey = /Failed to fetch|network/i.test(msg)
    ? "error_network"
    : /permission|forbidden/i.test(msg)
      ? "error_forbidden"
      : "error_generic";
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
    >
      <p className="flex items-center gap-2 font-semibold text-destructive">
        <AlertTriangle className="size-4" aria-hidden /> {t(key)}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          {t("retry")}
        </Button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">{children}</p>;
}

export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="min-w-0 text-sm text-muted-foreground sm:w-36 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium">{children}</dd>
    </div>
  );
}

const tone = {
  neutral: "bg-muted text-foreground border-border",
  info: "bg-lavender text-primary border-border",
  success: "bg-success/10 text-success border-success/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  danger: "bg-destructive/10 text-destructive border-destructive/30",
};

export function Pill({
  children,
  variant = "neutral",
  icon,
}: {
  children: ReactNode;
  variant?: keyof typeof tone;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        tone[variant],
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function SourceBadge({ source }: { source: string | null | undefined }) {
  const { t } = useI18n();
  if (!source) return <Pill>{t("not_recorded")}</Pill>;
  const icon =
    source === "practitioner_reviewed" ? (
      <ShieldCheck className="size-3" aria-hidden />
    ) : source === "linked_correspondence" ? (
      <FileText className="size-3" aria-hidden />
    ) : (
      <User className="size-3" aria-hidden />
    );
  return (
    <Pill variant={source === "practitioner_reviewed" ? "info" : "neutral"} icon={icon}>
      {t(`src_${source}` as TKey)}
    </Pill>
  );
}

export function ReviewBadge({ state }: { state: string }) {
  const { t } = useI18n();
  return (
    <Pill
      variant={state === "unreviewed" ? "warning" : "success"}
      icon={
        state === "unreviewed" ? (
          <Clock className="size-3" aria-hidden />
        ) : (
          <CheckCircle2 className="size-3" aria-hidden />
        )
      }
    >
      {t(`rs_${state}` as TKey)}
    </Pill>
  );
}

export function ActionStatusBadge({ status, overdue }: { status: string; overdue?: boolean }) {
  const { t } = useI18n();
  const v =
    status === "verified_complete"
      ? "success"
      : status === "cancelled"
        ? "neutral"
        : status === "reported_complete"
          ? "info"
          : "neutral";
  const icon =
    status === "verified_complete" ? (
      <CheckCircle2 className="size-3" aria-hidden />
    ) : status === "cancelled" ? (
      <XCircle className="size-3" aria-hidden />
    ) : (
      <Clock className="size-3" aria-hidden />
    );
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Pill variant={v} icon={icon}>
        {t(`st_${status}` as TKey)}
      </Pill>
      {overdue && (
        <Pill variant="danger" icon={<AlertTriangle className="size-3" aria-hidden />}>
          {t("st_overdue")}
        </Pill>
      )}
    </span>
  );
}

export function DemoBanner() {
  const { t } = useI18n();
  return (
    <div
      role="note"
      className="bg-pink px-4 py-1.5 text-center text-xs font-semibold text-primary-foreground"
    >
      {t("demo_banner")}
    </div>
  );
}

export function InlineError({ k }: { k: TKey | null }) {
  const { t } = useI18n();
  if (!k) return null;
  return (
    <p role="alert" className="text-sm font-medium text-destructive">
      {t(k)}
    </p>
  );
}
