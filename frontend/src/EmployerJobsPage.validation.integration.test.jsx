import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmployerJobsPage } from "./EmployerJobsPage.jsx";
import { renderWithProviders } from "./test/renderWithProviders.jsx";

vi.mock("./auth", () => ({
  useAuth: () => ({
    user: {
      role: "employer",
      email: "owner@example.com",
    },
    logout: vi.fn(),
    refreshMe: vi.fn(),
  }),
  getRoleHomePath: () => "/employer",
  isPremiumCompany: () => false,
  isPremiumCandidate: () => false,
}));

vi.mock("./api", () => ({
  api: vi.fn(),
}));

import { api } from "./api";

describe("EmployerJobsPage validation UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.mockImplementation((url) => {
      if (url === "/api/employers/jobs") return Promise.resolve([]);
      if (url === "/api/candidates/job-categories/") {
        return Promise.resolve([{ id: 1, name: "Engineering", slug: "engineering" }]);
      }
      return Promise.resolve([]);
    });
  });

  it("shows inline title error without top banner when posting invalid job", async () => {
    const user = userEvent.setup();
    api.mockImplementation((url, opts) => {
      if (url === "/api/employers/jobs" && opts?.method === "POST") {
        return Promise.reject(
          new Error(
            JSON.stringify({
              title: ["This field may not be blank."],
              jd_text: ["This field may not be blank."],
            }),
          ),
        );
      }
      if (url === "/api/employers/jobs") return Promise.resolve([]);
      if (url === "/api/candidates/job-categories/") {
        return Promise.resolve([{ id: 1, name: "Engineering", slug: "engineering" }]);
      }
      return Promise.resolve([]);
    });

    renderWithProviders(<EmployerJobsPage />);

    await waitFor(() => {
      expect(document.querySelector(".employerJobsNewBtn")).toBeInTheDocument();
    });
    await user.click(document.querySelector(".employerJobsNewBtn"));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /publish job/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /publish job/i }));

    await waitFor(() => {
      expect(screen.getByText("This field is required.", { selector: "#ej-title-err" })).toBeInTheDocument();
    });

    expect(document.querySelector(".employerJobsError")).not.toBeInTheDocument();
    expect(document.getElementById("ej-title")).toHaveClass("authInputHasError");
    expect(document.getElementById("ej-jd")).toHaveClass("authInputHasError");
  });
});
