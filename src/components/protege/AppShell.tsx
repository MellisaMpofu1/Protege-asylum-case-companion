import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  Briefcase,
  Calendar,
  FileText,
  Home,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Scale,
  MapPin,
  Settings,
  Shield,
  X,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type TKey } from "@/lib/i18n";
import { canOpen, homeFor, roles, useAppCtx } from "@/lib/session";
import { Onboarding } from "./Legal";
import { DemoBanner, ErrorState, Loading, Wordmark } from "./ui";

type NavItem = { to: string; key: TKey; icon: typeof Home };
const APPLICANT: NavItem[] = [
  { to: "/home", key: "nav_home", icon: Home },
  { to: "/case", key: "nav_case", icon: LayoutDashboard },
  { to: "/documents", key: "nav_documents", icon: FileText },
  { to: "/appointments", key: "nav_appointments", icon: Calendar },
  { to: "/support", key: "nav_support", icon: LifeBuoy },
  { to: "/rights", key: "nav_rights", icon: Scale },
  { to: "/life", key: "nav_life", icon: MapPin },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const ctx = useAppCtx();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const uid = ctx.data?.user_id;
  useEffect(() => {
    if (!uid) return;
    // Live notification badge; RLS limits rows to the current recipient. Refetch on (re)connect.
    const ch = supabase
      .channel(`notifs-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` }, () => {
        qc.invalidateQueries({ queryKey: ["ctx"] });
        qc.invalidateQueries({ queryKey: ["notifs"] });
        qc.invalidateQueries({ queryKey: ["appts"] });
        qc.invalidateQueries({ queryKey: ["case"] });
        qc.invalidateQueries({ queryKey: ["home"] });
        qc.invalidateQueries({ queryKey: ["appstatus"] });
        qc.invalidateQueries({ queryKey: ["caseload-status"] });
        qc.invalidateQueries({ queryKey: ["case-appts"] });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") qc.invalidateQueries({ queryKey: ["ctx"] });
      });
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [uid, qc]);

  if (ctx.isLoading)
    return (
      <div className="p-6">
        <Loading />
      </div>
    );
  if (ctx.error)
    return (
      <div className="p-6">
        <ErrorState error={ctx.error} onRetry={() => ctx.refetch()} />
      </div>
    );

  const r = roles(ctx.data);
  const items: NavItem[] =
    r.portal === "applicant"
      ? [...APPLICANT, { to: "/notifications", key: "nav_notifications", icon: Bell }, { to: "/settings", key: "nav_settings", icon: Settings }]
      : [
          ...(r.isPractitioner ? [{ to: "/work", key: "nav_caseload" as TKey, icon: Briefcase }] : []),
          ...(r.isAdmin
            ? [
                { to: "/admin", key: "nav_admin" as TKey, icon: Shield },
                { to: "/admin/monitoring", key: "nav_monitoring" as TKey, icon: BarChart3 },
              ]
            : []),
          { to: "/notifications", key: "nav_notifications", icon: Bell },
          { to: "/settings", key: "nav_settings", icon: Settings },
        ];
  const allowed = canOpen(ctx.data, pathname);

  async function signOut() {
    await qc.cancelQueries();
    await supabase.removeAllChannels();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav = (compact = false) => (
    <nav aria-label={t("menu")} className="flex flex-col gap-1">
      {items.map((i) => (
        <Link
          key={i.to}
          to={i.to}
          onClick={() => setOpen(false)}
          title={compact ? t(i.key) : undefined}
          aria-label={t(i.key)}
          activeOptions={{ exact: i.to === "/admin" }}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
          activeProps={{
            className: "bg-accent text-primary font-semibold",
            "aria-current": "page",
          }}
        >
          <i.icon className="size-4" aria-hidden />
          <span className={compact ? "sr-only" : "min-w-0"}>{t(i.key)}</span>
          {i.key === "nav_notifications" && (ctx.data?.unread ?? 0) > 0 && (
            <span
              className="ml-auto rounded-full bg-pink px-2 text-xs text-primary-foreground"
              aria-label={`${ctx.data?.unread} unread`}
            >
              {ctx.data?.unread}
            </span>
          )}
        </Link>
      ))}
      <Button variant="ghost"
        onClick={signOut}
        title={compact ? t("sign_out") : undefined}
        aria-label={t("sign_out")}
        className="mt-2 h-auto justify-start gap-3 px-3 py-2.5 text-muted-foreground"
      >
        <LogOut className="size-4" aria-hidden /> <span className={compact ? "sr-only" : ""}>{t("sign_out")}</span>
      </Button>
    </nav>
  );

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-card focus:p-2"
      >
        Skip to content
      </a>
      {r.isDemo && <DemoBanner />}
      <header className="sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-card px-4 py-3 lg:hidden">
        <Wordmark className="w-36" />
        <Button variant="ghost" size="icon"
          aria-label={t("menu")}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </header>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="protege-navigation">
          <DialogTitle>{t("menu")}</DialogTitle>
          <DialogDescription className="sr-only">{t("tagline")}</DialogDescription>
          <Wordmark />
          {nav()}
        </DialogContent>
      </Dialog>
      <div className="flex">
        <aside className={`sticky top-0 hidden h-dvh shrink-0 flex-col overflow-y-auto border-r bg-card p-3 lg:flex ${collapsed ? "w-20" : "w-60"}`}>
          <div className="mb-6 flex items-center justify-between gap-2">
            {!collapsed && <Wordmark className="w-36" />}
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setCollapsed((v) => !v)} aria-label={t(collapsed ? "expand_navigation" : "collapse_navigation")} title={t(collapsed ? "expand_navigation" : "collapse_navigation")}>
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          </div>
          {nav(collapsed)}
        </aside>
        <main id="main" className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8 xl:px-10">
          <div className="protege-content mx-auto w-full max-w-7xl">{ctx.data?.onboarded === false ? (
              <Onboarding />
            ) : allowed ? (
              children
            ) : (
              <div role="alert" className="mx-auto max-w-md rounded-xl border bg-card p-6 text-center">
                <h1 className="text-xl font-semibold">{t("access_denied")}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{t("access_denied_body")}</p>
                <Button asChild className="mt-4">
                  <Link to={homeFor(ctx.data)}>{t("go_home")}</Link>
                </Button>
              </div>
            )}</div>
        </main>
      </div>
    </div>
  );
}
