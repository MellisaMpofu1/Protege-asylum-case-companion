import { createFileRoute } from "@tanstack/react-router";
import { LegalDoc } from "@/components/protege/Legal";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — Protege" },
      { name: "description", content: "Draft Privacy Notice for Protege, your asylum case companion in Portugal." },
      { property: "og:title", content: "Privacy Notice — Protege" },
      { property: "og:description", content: "Draft Privacy Notice for Protege." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LegalDoc kind="privacy" />,
});
