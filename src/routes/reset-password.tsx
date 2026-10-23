import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { AuthCard } from "./auth";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Protege" },
      { name: "description", content: "Set a new password for your Protege account." },
      { property: "og:title", content: "Reset password — Protege" },
      { property: "og:description", content: "Set a new password for Protege." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setErr("Use at least 8 characters.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(t("error_generic"));
    navigate({ to: "/auth" });
  }
  return (
    <AuthCard title={t("set_password")}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="np">{t("new_password")}</Label>
          <Input
            id="np"
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </div>
        {err && (
          <p role="alert" className="text-sm text-destructive">
            {err}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {t("save")}
        </Button>
      </form>
    </AuthCard>
  );
}
