import { describe, expect, it } from "vitest";
import { allowedOrigin } from "@/lib/invitations.functions";
import { notificationText, safeLink } from "@/lib/notifications";
import { canOpen, type AppCtx } from "@/lib/session";

const base = { user_id: "u", profile: null, unread: 0, onboarded: true, consents: {} };
const applicant = { ...base, memberships: [], case: { id: "c", org_id: "o", label: "x", is_demo: true, org_name: "n" } } as AppCtx;
const prac = { ...base, case: null, memberships: [{ org_id: "o", role: "practitioner", org_name: "n", is_demo: true }] } as AppCtx;

describe("invitation callback origins", () => {
  it("only allows the app's own hosts", () => {
    expect(allowedOrigin("https://id-preview--x.lovable.app")).toBe("https://id-preview--x.lovable.app");
    expect(allowedOrigin("https://evil.example.com")).toBeNull();
    expect(allowedOrigin("http://x.lovable.app")).toBeNull();
    expect(allowedOrigin(undefined)).toBeNull();
  });
});

describe("notification links", () => {
  it("follows only relative in-app paths", () => {
    expect(safeLink("/appointments#appt-1")).toBe("/appointments#appt-1");
    expect(safeLink("//evil.com")).toBe("/notifications");
    expect(safeLink("https://evil.com")).toBe("/notifications");
  });
  it("unknown types use the generic text", () => {
    expect(notificationText("weird")).toBe("notif_generic");
    expect(notificationText("new_message")).toBe("n_new_message");
  });
});

describe("pillar pages are applicant-only", () => {
  it("staff cannot open My Rights / My Life", () => {
    expect(canOpen(prac, "/rights")).toBe(false);
    expect(canOpen(prac, "/life")).toBe(false);
    expect(canOpen(applicant, "/rights")).toBe(true);
  });
});
