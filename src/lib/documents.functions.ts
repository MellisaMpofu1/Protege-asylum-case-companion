import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkUpload, safeFileName } from "@/lib/files";

const BUCKET = "case-documents";
const SIGNED_URL_SECONDS = 60;

export const uploadDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    if (!(input instanceof FormData)) throw new Error("invalid_input");
    const file = input.get("file");
    const caseId = String(input.get("caseId") ?? "");
    if (!(file instanceof File) || !/^[0-9a-f-]{36}$/.test(caseId))
      throw new Error("invalid_input");
    const expiry = String(input.get("expiry") ?? "");
    const actionId = String(input.get("actionId") ?? "");
    return {
      file,
      caseId,
      docType: String(input.get("docType") ?? "Other").slice(0, 80),
      expiry: /^\d{4}-\d{2}-\d{2}$/.test(expiry) ? expiry : null,
      actionId: /^[0-9a-f-]{36}$/.test(actionId) ? actionId : null,
    };
  })
  .handler(async ({ data, context }) => {
    const bytes = new Uint8Array(await data.file.arrayBuffer());
    const check = checkUpload(bytes);
    if (!check.ok) return { ok: false as const, error: check.error };
    // Access + metadata through the caller's own permissions (RLS / security-definer checks).
    const { data: reg, error } = await context.supabase.rpc("register_document", {
      _case: data.caseId,
      _doc_type: data.docType,
      _safe_name: safeFileName(data.file.name, check.mime),
      _mime: check.mime,
      _size: bytes.length,
      _expiry: data.expiry as string,
      _action: data.actionId as string,
    });
    if (error || !reg)
      return {
        ok: false as const,
        error: error?.message.includes("forbidden") ? "forbidden" : "save_failed",
      };
    const { id, path } = reg as { id: string; path: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const up = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: check.mime, upsert: false });
    if (up.error) {
      await supabaseAdmin.from("documents").delete().eq("id", id);
      return { ok: false as const, error: "save_failed" };
    }
    return { ok: true as const, id };
  });

export const getDocumentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!/^[0-9a-f-]{36}$/.test(input?.id ?? "")) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    // RLS decides visibility: if the caller cannot select the row, they get not_found.
    const { data: doc } = await context.supabase
      .from("documents")
      .select("id, case_id, storage_path, is_sample, mime")
      .eq("id", data.id)
      .maybeSingle();
    if (!doc || !doc.storage_path || doc.is_sample)
      return { ok: false as const, error: "not_found" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_path, SIGNED_URL_SECONDS, {
        download: doc.mime === "application/pdf",
      });
    if (error || !signed) return { ok: false as const, error: "not_found" };
    await supabaseAdmin.from("audit_log").insert({
      case_id: doc.case_id,
      actor_id: context.userId,
      action: "access",
      record_type: "documents",
      record_id: doc.id,
      org_id: null,
    });
    return { ok: true as const, url: signed.signedUrl };
  });

export const removeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!/^[0-9a-f-]{36}$/.test(input?.id ?? "")) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("documents")
      .select("id, case_id, storage_path, removal_requested")
      .eq("id", data.id)
      .maybeSingle();
    if (!doc) return { ok: false as const, error: "not_found" };
    const { data: isStaff } = await context.supabase.rpc("has_case_grant", { _case: doc.case_id });
    if (!isStaff || !doc.removal_requested) return { ok: false as const, error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (doc.storage_path) await supabaseAdmin.storage.from(BUCKET).remove([doc.storage_path]);
    await supabaseAdmin.from("documents").delete().eq("id", doc.id);
    return { ok: true as const };
  });
