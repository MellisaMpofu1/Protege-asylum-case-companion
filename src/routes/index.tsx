import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, FileText, ListChecks, LifeBuoy } from "lucide-react";
import { Wordmark } from "@/components/protege/ui";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { LegalLinks } from "@/components/protege/Legal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Protege — Your asylum case companion in Portugal" },
      {
        name: "description",
        content:
          "Protege helps international protection applicants in Portugal and their support organisations keep track of recorded updates, next actions, documents and appointments.",
      },
      { property: "og:title", content: "Protege — Your asylum case companion in Portugal" },
      {
        property: "og:description",
        content:
          "A calm companion for applicants and NGO practitioners: recorded updates, reviewed next actions, documents and appointments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t, locale, setLocale } = useI18n();
  const features = [
    {
      icon: ListChecks,
      key: "welcome_actions" as const,
    },
    {
      icon: FileText,
      key: "welcome_documents" as const,
    },
    {
      icon: CalendarCheck,
      key: "welcome_appointments" as const,
    },
    {
      icon: LifeBuoy,
      key: "welcome_contacts" as const,
    },
  ];
  return (
    <div className="min-h-screen">
      <header className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-5 sm:flex sm:justify-between sm:px-6">
        <Wordmark />
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="px-2"
            onClick={() => setLocale(locale === "en" ? "pt-PT" : "en")}
          >
            {locale === "en" ? "Português" : "English"}
          </Button>
          <Button asChild><Link to="/auth">
            {t("sign_in")}
          </Link></Button>
        </div>
      </header>
      <main className="protege-content mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 md:pt-16">
        <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-primary md:text-5xl">
          Protege
        </h1>
        <p className="mt-3 max-w-2xl text-2xl font-head font-medium">{t("tagline")}</p>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{t("not_official")}</p>
        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {features.map((f) => (
            <li key={f.key} className="flex min-w-0 items-start gap-3 rounded-lg border bg-card p-4">
              <f.icon className="mt-0.5 size-5 text-violet" aria-hidden />
              <span className="min-w-0">{t(f.key)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-sm text-muted-foreground">
          {t("invite_only")} {t("have_invite")}
        </p>
        <Button asChild variant="link" className="mt-2 px-0"><Link to="/access">{t("account_access")}</Link></Button>
        <div className="mt-8 border-t pt-5"><LegalLinks /></div>
      </main>
    </div>
  );
}
