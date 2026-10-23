import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { errorKey } from "@/lib/session";

/** Calls a backend operation; success toast only after the server confirms the save. */
export function useRpc(fn: string, invalidate: string[][] = []) {
  const qc = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: async (args: Record<string, unknown>) => {
      const { data, error } = await (
        supabase.rpc as unknown as (
          f: string,
          a: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: Error | null }>
      )(fn, args);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(t("saved"));
      for (const k of invalidate) qc.invalidateQueries({ queryKey: k });
      qc.invalidateQueries({ queryKey: ["ctx"] });
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });
}

export function pageHead(title: string) {
  return () => ({
    meta: [
      { title: `${title} — Protege` },
      {
        name: "description",
        content: `${title} in Protege, your asylum case companion in Portugal.`,
      },
      { property: "og:title", content: `${title} — Protege` },
      { property: "og:description", content: `${title} in Protege, your asylum case companion in Portugal.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  });
}

export async function q<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw error;
  return (data ?? []) as NonNullable<T>;
}

export async function qMaybe<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T | null> {
  const { data, error } = await p;
  if (error) throw error;
  return data ?? null;
}
