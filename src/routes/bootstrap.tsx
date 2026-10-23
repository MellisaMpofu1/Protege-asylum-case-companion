import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard } from "./auth";

// One-time first-admin setup. Requires a single-use code created by the project owner.
export const Route = createFileRoute("/bootstrap")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "First administrator setup — Protege" },
      { name: "description", content: "One-time setup of the first Protege administrator." },
      { property: "og:title", content: "First administrator setup — Protege" },
      { property: "og:description", content: "One-time Protege setup." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Bootstrap,
});

function Bootstrap() {
  const navigate = useNavigate();
  const [user, setUser] = useState<string | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [org, setOrg] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user?.email ?? null));
  }, []);

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pw,
      options: { emailRedirectTo: `${window.location.origin}/bootstrap` },
    });
    setBusy(false);
    if (error) return setMsg("Could not create the account.");
    if (data.session) setUser(email);
    else setMsg("Check your email to confirm the account, then return to this page.");
  }
  async function claim(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("bootstrap_first_admin", {
      _code: code.trim(),
      _org_name: org.trim(),
    });
    setBusy(false);
    if (error) return setMsg("This code is not valid or has already been used.");
    navigate({ to: "/admin" });
  }

  if (user === undefined) return null;
  return (
    <AuthCard title="First administrator setup">
      {!user ? (
        <form onSubmit={createAccount} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="e">Email</Label>
            <Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p">Password</Label>
            <Input id="p" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Create account
          </Button>
        </form>
      ) : (
        <form onSubmit={claim} className="space-y-3">
          <p className="text-sm text-muted-foreground">Signed in as {user}</p>
          <div className="space-y-1.5">
            <Label htmlFor="o">Organisation name</Label>
            <Input id="o" value={org} onChange={(e) => setOrg(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c">One-time setup code</Label>
            <Input id="c" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy || !code || !org}>
            Create organisation
          </Button>
        </form>
      )}
      {msg && (
        <p role="status" className="mt-3 text-sm">
          {msg}
        </p>
      )}
    </AuthCard>
  );
}
