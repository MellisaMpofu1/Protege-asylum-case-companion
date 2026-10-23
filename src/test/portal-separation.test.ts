import { describe, expect, it } from "vitest";
import { canOpen, homeFor, portalOf, type AppCtx } from "@/lib/session";

const base = { user_id: "u", profile: null, unread: 0, onboarded: true, consents: {} };
const applicant = { ...base, memberships: [], case: { id: "c", org_id: "o", label: "x", is_demo: true, org_name: "n" } } as AppCtx;
const admin = { ...base, case: null, memberships: [{ org_id: "o", role: "admin", org_name: "n", is_demo: true }] } as AppCtx;
const prac = { ...base, case: null, memberships: [{ org_id: "o", role: "practitioner", org_name: "n", is_demo: true }] } as AppCtx;

describe("portal separation", () => {
  it("applicant cannot open staff pages", () => {
    for (const p of ["/work", "/work/abc", "/admin", "/admin/monitoring"]) expect(canOpen(applicant, p)).toBe(false);
    expect(canOpen(applicant, "/documents")).toBe(true);
  });
  it("staff cannot open applicant pages", () => {
    expect(canOpen(admin, "/home")).toBe(false);
    expect(canOpen(prac, "/documents")).toBe(false);
  });
  it("practitioner cannot open admin; admin-only cannot open caseload", () => {
    expect(canOpen(prac, "/admin")).toBe(false);
    expect(canOpen(admin, "/work")).toBe(false);
  });
  it("staff membership wins over a stray case link", () => {
    expect(portalOf({ ...admin, case: applicant.case })).toBe("staff");
  });
  it("unknown context fails closed", () => {
    expect(canOpen(undefined, "/home")).toBe(false);
    expect(homeFor(applicant)).toBe("/home");
    expect(homeFor(prac)).toBe("/work");
  });
});
