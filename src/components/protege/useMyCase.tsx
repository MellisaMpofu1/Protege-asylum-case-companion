import type { ReactNode } from "react";
import { useAppCtx } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { Empty, Loading } from "./ui";

/** Renders children only when the signed-in user owns a case workspace. */
export function WithMyCase({
  children,
}: {
  children: (caseId: string, orgId: string) => ReactNode;
}) {
  const ctx = useAppCtx();
  const { t } = useI18n();
  if (ctx.isLoading) return <Loading />;
  const c = ctx.data?.case;
  if (!c) return <Empty>{t("no_access")}</Empty>;
  return <>{children(c.id, c.org_id)}</>;
}
