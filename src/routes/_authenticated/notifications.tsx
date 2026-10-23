import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Empty, ErrorState, Loading, PageHeader, Section } from "@/components/protege/ui";
import { useI18n, type TKey } from "@/lib/i18n";
import { pageHead, q } from "@/lib/mutate";
import { notificationText, safeLink } from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: pageHead("Notifications"),
  component: Notifications,
});

function Notifications() {
  const { t, fInstant } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useQuery({
    queryKey: ["notifs"],
    queryFn: () =>
      q(supabase.from("notifications").select("id, message_key, link, read_at, created_at").order("created_at", { ascending: false }).limit(100)),
  });
  function refresh() {
    qc.invalidateQueries({ queryKey: ["notifs"] });
    qc.invalidateQueries({ queryKey: ["ctx"] });
  }
  async function markAll() {
    const { error } = await supabase.rpc("mark_notifications_read");
    if (!error) refresh();
  }
  async function open(id: string, link: string | null) {
    await supabase.rpc("mark_notification_read", { _id: id });
    refresh();
    const l = safeLink(link);
    const [path = "/notifications", hash] = l.split("#");
    navigate({ to: path, ...(hash ? { hash } : {}) });
  }
  if (list.isLoading) return <Loading />;
  if (list.error) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  const items = list.data!;
  return (
    <div className="space-y-5">
      <PageHeader title={t("notif_title")}>
        {items.some((n) => !n.read_at) && (
          <Button variant="outline" size="sm" onClick={markAll}>
            {t("mark_all_read")}
          </Button>
        )}
      </PageHeader>
      <Section>
        {items.length === 0 ? (
          <Empty>{t("notif_none")}</Empty>
        ) : (
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n.id, n.link)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm hover:bg-accent"
                >
                  <span className={n.read_at ? "" : "font-semibold"}>
                    {!n.read_at && <span className="mr-2 inline-block size-2 rounded-full bg-pink" aria-label="unread" />}
                    {t(notificationText(n.message_key) as TKey)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{fInstant(n.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
