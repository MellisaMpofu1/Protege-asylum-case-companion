import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { AuthCard } from "./auth";

export const Route = createFileRoute("/access")({
  head: () => ({ meta: [
    { title: "Invitation & account access — Protege" },
    { name: "description", content: "Open your Protege invitation or sign in to an existing account." },
    { property: "og:title", content: "Invitation & account access — Protege" },
    { property: "og:description", content: "Access Protege through an invitation from your support organisation." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AccessPage,
});

function AccessPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [link, setLink] = useState("");
  const [invalid, setInvalid] = useState(false);
  return <AuthCard title={t("account_access")}>
    <p className="mb-5 text-sm text-muted-foreground">{t("invite_only")} {t("have_invite")}</p>
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      try {
        const url = new URL(link.trim(), window.location.origin);
        const match = url.pathname.match(/^\/invite\/([A-Za-z0-9_-]+)\/?$/);
        if (!match?.[1] || !["https:", "http:"].includes(url.protocol)) { setInvalid(true); return; }
        navigate({ to: "/invite/$token", params: { token: match[1] } });
      } catch { setInvalid(true); }
    }}>
      <Label htmlFor="invitation-link">{t("invitation_link")}</Label>
      <Input id="invitation-link" value={link} onChange={(e) => { setLink(e.target.value); setInvalid(false); }} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={invalid} aria-describedby={invalid ? "invitation-error" : undefined} required />
      {invalid && <p id="invitation-error" role="alert" className="text-sm text-destructive">{t("invitation_link_invalid")}</p>}
      <Button type="submit" className="w-full">{t("open_invitation")}</Button>
    </form>
    <Button asChild variant="link" className="mt-4 px-0"><Link to="/auth">{t("sign_in")}</Link></Button>
  </AuthCard>;
}