import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loading } from "@/components/protege/ui";
import { useI18n } from "@/lib/i18n";
import { ctxQuery, homeFor, logEvent } from "@/lib/session";
import { AuthCard } from "./auth";

export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing you in — Protege" },
      { name: "description", content: "Completing your secure Protege sign-in." },
      { property: "og:title", content: "Signing you in — Protege" },
      { property: "og:description", content: "Completing your secure Protege sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Callback,
});

function Callback() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let done = false;
    async function go() {
      const { data } = await supabase.auth.getUser();
      if (!data.user || done) return false;
      done = true;
      qc.clear();
      logEvent("login");
      const ctx = await qc.fetchQuery(ctxQuery);
      navigate({ to: homeFor(ctx), replace: true });
      return true;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN") void go();
    });
    void go();
    const timer = setTimeout(() => { if (!done) setFailed(true); }, 8000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(timer); };
  }, [navigate, qc]);
  return (
    <AuthCard title={t("auth_title")}>
      {failed ? <p role="alert">{t("link_invalid")}</p> : <Loading />}
    </AuthCard>
  );
}
