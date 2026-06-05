import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CandidateOnboardingWorkExperience } from "./App.jsx";
import { renderWithProviders } from "./test/renderWithProviders.jsx";

const mockRefreshMe = vi.fn();
const mockNavigate = vi.fn();

vi.mock("./auth", () => ({
  useAuth: () => ({
    user: {
      role: "candidate",
      email: "candidate@example.com",
    },
    refreshMe: mockRefreshMe,
    logout: vi.fn(),
  }),
  getRoleHomePath: () => "/",
  isPremiumCandidate: () => false,
  isPremiumCompany: () => false,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("./api", () => ({
  api: vi.fn(),
}));

import { api } from "./api";

describe("CandidateOnboardingWorkExperience validation UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.mockImplementation((url) => {
      if (url === "/api/candidates/work-experience/") return Promise.resolve([]);
      if (url === "/api/candidates/education/") return Promise.resolve([]);
      return Promise.resolve({});
    });
  });

  it("shows resume error inline under upload instead of top banner", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CandidateOnboardingWorkExperience />);

    await user.click(screen.getByRole("button", { name: /auto-fill from resume/i }));

    expect(screen.queryByText(/please upload a resume first/i)).toBeInTheDocument();
    expect(document.querySelector(".onboardingCard > .error")).not.toBeInTheDocument();
    expect(document.querySelector(".onboardResumeError")).toBeInTheDocument();
  });

  it("shows work experience field errors inline after save validation fails", async () => {
    const user = userEvent.setup();
    api.mockImplementation((url, opts) => {
      if (url === "/api/candidates/work-experience/") return Promise.resolve([]);
      if (url === "/api/candidates/education/") return Promise.resolve([]);
      if (url === "/api/candidates/profile/bundle/" && opts?.method === "PUT") {
        return Promise.reject(
          new Error(
            JSON.stringify({
              work_experiences: [{ job_title: ["This field may not be blank."] }],
            }),
          ),
        );
      }
      return Promise.resolve({});
    });

    renderWithProviders(<CandidateOnboardingWorkExperience />);

    const jobRoleInputs = await screen.findAllByPlaceholderText("Job role");
    await user.type(jobRoleInputs[0], "Software Engineer");
    await user.click(screen.getByRole("button", { name: /save and continue/i }));

    await waitFor(() => {
      expect(screen.getByText("This field is required.")).toBeInTheDocument();
    });

    expect(document.querySelector(".onboardingCard > .error")).not.toBeInTheDocument();
    expect(document.querySelector(".experienceCard .authInputHasError")).toBeInTheDocument();
  });

  it("maps row-level date errors onto date pickers without top banner", async () => {
    const user = userEvent.setup();
    api.mockImplementation((url, opts) => {
      if (url === "/api/candidates/work-experience/") return Promise.resolve([]);
      if (url === "/api/candidates/education/") return Promise.resolve([]);
      if (url === "/api/candidates/profile/bundle/" && opts?.method === "PUT") {
        return Promise.reject(
          new Error(
            JSON.stringify({
              work_experiences: [{ non_field_errors: ["End date cannot be before start date."] }],
            }),
          ),
        );
      }
      return Promise.resolve({});
    });

    renderWithProviders(<CandidateOnboardingWorkExperience />);

    const jobRoleInputs = await screen.findAllByPlaceholderText("Job role");
    await user.type(jobRoleInputs[0], "Analyst");
    await user.click(screen.getByRole("button", { name: /save and continue/i }));

    await waitFor(() => {
      expect(screen.getAllByText("End date cannot be before start date.").length).toBeGreaterThan(0);
    });

    expect(document.querySelector(".onboardingCard > .error")).not.toBeInTheDocument();
    expect(document.querySelector(".experienceCard .Mui-error")).toBeInTheDocument();
  });
});
