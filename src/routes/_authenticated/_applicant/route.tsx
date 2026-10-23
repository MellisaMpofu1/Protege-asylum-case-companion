import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ctxQuery, homeFor, portalOf } from "@/lib/session";

/** Applicant-only area. Staff are redirected before any applicant data is requested. */
export const Route = createFileRoute("/_authenticated/_applicant")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const ctx = await context.queryClient.ensureQueryData(ctxQuery);
    if (ctx.onboarded !== false && portalOf(ctx) !== "applicant") throw redirect({ to: homeFor(ctx), replace: true });
  },
  component: Outlet,
});
