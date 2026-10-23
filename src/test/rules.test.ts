import { describe, expect, it } from "vitest";
import { formatDateOnly, isOverdue, lisbonLocalToUtcIso, utcIsoToLisbonLocal } from "@/lib/dates";
import { meetsTarget, ratioPercent, safeCell } from "@/lib/metrics";
import { checkUpload, safeFileName } from "@/lib/files";

describe("date-only and Lisbon time", () => {
  it("keeps a date-only deadline on the same calendar day", () => {
    expect(formatDateOnly("2026-03-29", "en")).toBe("29 March 2026");
    expect(formatDateOnly("2026-01-01", "pt-PT")).toBe("1 de janeiro de 2026");
  });
  it("converts Lisbon wall time to UTC across DST", () => {
    expect(lisbonLocalToUtcIso("2026-01-15T10:00")).toBe("2026-01-15T10:00:00.000Z"); // WET = UTC
    expect(lisbonLocalToUtcIso("2026-07-15T10:00")).toBe("2026-07-15T09:00:00.000Z"); // WEST = UTC+1
    expect(utcIsoToLisbonLocal("2026-07-15T09:00:00.000Z")).toBe("2026-07-15T10:00");
  });
  it("is overdue only for confirmed, pending, past dates", () => {
    expect(isOverdue({ due_date: "2026-10-01", due_confirmed: true, status: "pending" }, "2026-10-02")).toBe(true);
    expect(isOverdue({ due_date: "2026-10-01", due_confirmed: false, status: "pending" }, "2026-10-02")).toBe(false);
    expect(isOverdue({ due_date: "2026-10-01", due_confirmed: true, status: "reported_complete" }, "2026-10-02")).toBe(false);
  });
});

describe("metrics", () => {
  it("shows not enough data for an empty denominator", () => {
    expect(ratioPercent({ num: 0, den: 0 })).toBeNull();
    expect(meetsTarget({ num: 0, den: 0 }, 80)).toBeNull();
  });
  it("computes 80% understanding target", () => {
    expect(ratioPercent({ num: 8, den: 10 })).toBe(80);
    expect(meetsTarget({ num: 79, den: 100 }, 80)).toBe(false);
  });
  it("escapes formula injection in exports", () => {
    expect(safeCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(safeCell("Wave 1")).toBe("Wave 1");
  });
});

describe("uploads", () => {
  const pdf = new TextEncoder().encode("%PDF-1.4 hello");
  it("accepts PDF by signature and rejects disguised files", () => {
    expect(checkUpload(pdf)).toEqual({ ok: true, mime: "application/pdf" });
    expect(checkUpload(new TextEncoder().encode("MZ executable"))).toEqual({ ok: false, error: "invalid_type" });
  });
  it("rejects PDFs with JavaScript and files over 10 MB", () => {
    expect(checkUpload(new TextEncoder().encode("%PDF-1.4 /JavaScript x"))).toEqual({ ok: false, error: "active_content" });
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(pdf);
    expect(checkUpload(big)).toEqual({ ok: false, error: "too_large" });
  });
  it("creates safe filenames", () => {
    expect(safeFileName("../../etc/<script>.exe.pdf", "application/pdf")).toBe("etcscriptexe.pdf");
  });
});
