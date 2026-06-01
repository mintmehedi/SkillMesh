import { describe, expect, it } from "vitest";
import {
  humanizeFieldErrorMessage,
  parseApiValidationErrors,
  parseIndexedListFieldErrors,
} from "./apiErrors";

describe("humanizeFieldErrorMessage", () => {
  it("normalizes blank/required messages", () => {
    expect(humanizeFieldErrorMessage("This field may not be blank.")).toBe("This field is required.");
    expect(humanizeFieldErrorMessage("This field is required.")).toBe("This field is required.");
  });

  it("returns original text for other messages", () => {
    expect(humanizeFieldErrorMessage("End date cannot be before start date.")).toBe(
      "End date cannot be before start date.",
    );
  });
});

describe("parseIndexedListFieldErrors", () => {
  it("parses per-row field errors from DRF list serializer output", () => {
    const raw = [
      { job_title: ["This field may not be blank."] },
      null,
      { company_name: ["This field may not be blank."] },
    ];
    expect(parseIndexedListFieldErrors(raw)).toEqual({
      0: { job_title: "This field is required." },
      2: { company_name: "This field is required." },
    });
  });

  it("maps non_field_errors to _row for inline date validation", () => {
    const raw = [{ non_field_errors: ["End date cannot be before start date."] }];
    expect(parseIndexedListFieldErrors(raw)).toEqual({
      0: { _row: "End date cannot be before start date." },
    });
  });
});

describe("parseApiValidationErrors", () => {
  it("extracts employer job field errors from api() JSON message", () => {
    const err = {
      message: JSON.stringify({
        title: ["This field may not be blank."],
        jd_text: ["This field may not be blank."],
      }),
    };
    const { fieldErrors, generalMessage } = parseApiValidationErrors(err);
    expect(fieldErrors).toEqual({
      title: "This field is required.",
      jd_text: "This field is required.",
    });
    expect(generalMessage).toBe("");
  });

  it("collects detail and non_field_errors into generalMessage", () => {
    const err = {
      message: JSON.stringify({
        detail: "Authentication credentials were not provided.",
        non_field_errors: ["Invalid payload."],
      }),
    };
    const { fieldErrors, generalMessage } = parseApiValidationErrors(err);
    expect(fieldErrors).toEqual({});
    expect(generalMessage).toContain("Authentication credentials were not provided.");
    expect(generalMessage).toContain("Invalid payload.");
  });
});
