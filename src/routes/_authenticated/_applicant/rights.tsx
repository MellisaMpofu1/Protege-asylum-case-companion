import { createFileRoute } from "@tanstack/react-router";
import { WithMyCase } from "@/components/protege/useMyCase";
import { ResourcePillar } from "@/components/protege/ResourcePillar";
import { pageHead } from "@/lib/mutate";

export const Route = createFileRoute("/_authenticated/_applicant/rights")({
  head: pageHead("My Rights"),
  component: () => (
    <WithMyCase>{(_id, org) => <ResourcePillar orgId={org} category="rights" title="nav_rights" intro="rights_intro" />}</WithMyCase>
  ),
});
