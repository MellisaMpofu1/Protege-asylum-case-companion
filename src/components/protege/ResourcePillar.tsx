import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Empty, ErrorState, Loading, PageHeader, Section } from "./ui";
import { useI18n, type TKey } from "@/lib/i18n";
import { q } from "@/lib/mutate";

/** Published, reviewed information cards for one pillar. Honest empty state when none exist. */
export function ResourcePillar({ orgId, category, title, intro }: { orgId: string; category: "rights" | "life"; title: TKey; intro: TKey }) {
  const { t, fDate, locale } = useI18n();
  const list = useQuery({
    queryKey: ["pillar", orgId, category, locale],
    queryFn: () =>
      q(
        supabase
          .from("resources")
          .select("id, title, summary, publisher, source_url, applicability, last_reviewed_on, reviewer_name")
          .eq("org_id", orgId)
          .eq("status", "published")
          .eq("category", category)
          .eq("locale", locale)
          .not("last_reviewed_on", "is", null)
          .order("title"),
      ),
  });
  return (
    <div className="space-y-5">
      <PageHeader title={t(title)} />
      <p className="text-sm text-muted-foreground">{t(intro)}</p>
      {list.isLoading ? (
        <Loading />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data?.length ? (
        <Empty>{t("no_reviewed_info")}</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.data.map((r) => (
            <Section key={r.id} title={r.title}>
              <p className="whitespace-pre-wrap text-sm">{r.summary}</p>
              {r.applicability && <p className="mt-2 text-xs text-muted-foreground">{r.applicability}</p>}
              <p className="mt-3 text-xs text-muted-foreground">
                {r.publisher} · {t("reviewed_on", { d: fDate(r.last_reviewed_on!) ?? "" })}
              </p>
              {r.source_url && (
                <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-violet underline">
                  {t("official_source")} <ExternalLink className="size-3.5" aria-hidden />
                </a>
              )}
            </Section>
          ))}
        </div>
      )}
    </div>
  );
}
