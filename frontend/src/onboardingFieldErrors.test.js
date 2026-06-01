import { describe, expect, it } from "vitest";
import { onboardListFieldErr } from "./onboardingFieldErrors";

describe("onboardListFieldErr", () => {
  it("returns field-specific error when present", () => {
    const rowMap = { 0: { job_title: "This field is required." } };
    expect(onboardListFieldErr(rowMap, 0, "job_title")).toBe("This field is required.");
  });

  it("returns empty string when row or field has no error", () => {
    expect(onboardListFieldErr({}, 0, "job_title")).toBe("");
    expect(onboardListFieldErr({ 0: {} }, 0, "company_name")).toBe("");
  });

  it("maps row-level date errors onto start_date and end_date", () => {
    const rowMap = { 1: { _row: "End date cannot be before start date." } };
    expect(onboardListFieldErr(rowMap, 1, "start_date")).toBe("End date cannot be before start date.");
    expect(onboardListFieldErr(rowMap, 1, "end_date")).toBe("End date cannot be before start date.");
    expect(onboardListFieldErr(rowMap, 1, "job_title")).toBe("");
  });

  it("prefers field-specific error over row-level date error", () => {
    const rowMap = {
      0: {
        start_date: "Start date is required.",
        _row: "End date cannot be before start date.",
      },
    };
    expect(onboardListFieldErr(rowMap, 0, "start_date")).toBe("Start date is required.");
    expect(onboardListFieldErr(rowMap, 0, "end_date")).toBe("End date cannot be before start date.");
  });
});
