import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { roles, type AppCtx } from "@/lib/session";

const applicant: AppCtx = {
  user_id: "applicant", profile: null, memberships: [],
  case: { id: "case", org_id: "org", label: "Assigned case", is_demo: true, org_name: "Demo" },
  unread: 0, onboarded: true, consents: {},
};

describe("role separation across viewport changes", () => {
  it("never grants staff roles to an applicant at 360, 390, 768, 1024 or 1440px", () => {
    for (const width of [360, 390, 768, 1024, 1440]) {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      expect(roles(applicant)).toMatchObject({ isApplicant: true, isPractitioner: false, isAdmin: false });
    }
  });
  it("never grants applicant or administrator access to a practitioner on resize", () => {
    const staff: AppCtx = { ...applicant, case: null, memberships: [{ org_id: "org", role: "practitioner", org_name: "Demo", is_demo: true }] };
    for (const width of [360, 390, 768, 1024, 1440]) {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      expect(roles(staff)).toMatchObject({ isApplicant: false, isPractitioner: true, isAdmin: false });
    }
  });
});