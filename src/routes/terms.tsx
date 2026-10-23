import { createFileRoute } from "@tanstack/react-router";
import { LegalDoc } from "@/components/protege/Legal";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms and Conditions — Protege" },
      { name: "description", content: "Draft Terms and Conditions for Protege, your asylum case companion in Portugal." },
      { property: "og:title", content: "Terms and Conditions — Protege" },
      { property: "og:description", content: "Draft Terms and Conditions for Protege." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LegalDoc kind="terms" />,
});
