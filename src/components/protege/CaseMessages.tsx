import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Empty, ErrorState, Loading, Section } from "./ui";
import { useI18n } from "@/lib/i18n";
import { q, useRpc } from "@/lib/mutate";

/** Case-scoped conversation between the applicant and assigned staff. Never includes internal notes. */
export function CaseMessages({ caseId, side }: { caseId: string; side: "applicant" | "staff" }) {
  const { t, fInstant } = useI18n();
  const qc = useQueryClient();
  const key = ["messages", caseId];
  const list = useQuery({
    queryKey: key,
    queryFn: () =>
      q(supabase.from("case_messages").select("id, sender_role, sender_id, body, created_at").eq("case_id", caseId).order("created_at").limit(500)),
  });
  const [body, setBody] = useState("");
  const send = useRpc("send_case_message", [key]);
  const me = useRef<string | null>(null);
  const link = side === "applicant" ? "/support" : `/work/${caseId}`;

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => (me.current = data.user?.id ?? null));
    // Viewing the conversation clears this conversation's message notifications for the current user only.
    void supabase.rpc("mark_notifications_read_link", { _link: link }).then(() => {
      qc.invalidateQueries({ queryKey: ["ctx"] });
      qc.invalidateQueries({ queryKey: ["notifs"] });
    });
    const ch = supabase
      .channel(`msgs-${caseId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "case_messages", filter: `case_id=eq.${caseId}` }, () => {
        qc.invalidateQueries({ queryKey: key });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") qc.invalidateQueries({ queryKey: key });
      });
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  return (
    <Section title={side === "applicant" ? t("msg_title") : t("msg_staff_title")}>
      <p className="mb-3 text-xs text-muted-foreground">{t("msg_note")}</p>
      {list.isLoading ? (
        <Loading />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data?.length ? (
        <Empty>{t("msg_none")}</Empty>
      ) : (
        <ol className="mb-4 max-h-96 space-y-2 overflow-y-auto" aria-live="polite">
          {list.data.map((m) => {
            const mine = m.sender_role === side;
            return (
              <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg border px-3 py-2 text-sm ${mine ? "bg-lavender" : "bg-card"}`}>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {mine ? t("msg_you") : m.sender_role === "staff" ? t("msg_caseworker") : t("msg_applicant")} · {fInstant(m.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate({ _case: caseId, _body: body }, { onSuccess: () => setBody("") });
        }}
      >
        <label htmlFor={`msg-${caseId}`} className="sr-only">{t("msg_placeholder")}</label>
        <Textarea id={`msg-${caseId}`} placeholder={t("msg_placeholder")} value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} />
        <Button type="submit" disabled={!body.trim() || send.isPending}>{t("msg_send")}</Button>
      </form>
    </Section>
  );
}
