import { createFileRoute } from "@tanstack/react-router";
import { WithMyCase } from "@/components/protege/useMyCase";
import { ResourcePillar } from "@/components/protege/ResourcePillar";
import { DemoLife } from "@/components/protege/DemoHistory";
import { pageHead } from "@/lib/mutate";

export const Route = createFileRoute("/_authenticated/_applicant/life")({
  head: pageHead("My Life in Portugal"),
  component: () => (
    <WithMyCase>{(_id, org) => <><ResourcePillar orgId={org} category="life" title="nav_life" intro="life_intro" /><DemoLife /></>}</WithMyCase>
  ),
});
