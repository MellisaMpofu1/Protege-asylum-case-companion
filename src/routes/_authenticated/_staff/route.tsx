import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ctxQuery, homeFor, portalOf } from "@/lib/session";

/** Staff-only area. Applicants are redirected before any staff data is requested. */
export const Route = createFileRoute("/_authenticated/_staff")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const ctx = await context.queryClient.ensureQueryData(ctxQuery);
    if (ctx.onboarded !== false && portalOf(ctx) !== "staff") throw redirect({ to: homeFor(ctx), replace: true });
  },
  component: Outlet,
});
