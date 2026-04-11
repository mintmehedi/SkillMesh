import { Navigate, Route, Routes, Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth";
import { SiteDatePicker } from "./SiteDatePicker";
import { api, apiBlob } from "./api";
import { BackButton } from "./BackButton";
import { SiteBrandBar } from "./SiteBrandBar";
import { CandidateMemberHeader } from "./CandidateMemberHeader";
import { EmployerMemberHeader } from "./EmployerMemberHeader";
import { JobPostingDetailPanel } from "./JobPostingDetailPanel";
import { JobDetailPage } from "./JobDetailPage";
import { JobApplyPage } from "./JobApplyPage";
import { CandidateSavedJobsPage } from "./CandidateSavedJobsPage";
import { CandidateAppliedJobsPage } from "./CandidateAppliedJobsPage";
import { EmployerJobsPage } from "./EmployerJobsPage";
import { EmployerHomePage } from "./EmployerHomePage";
import { EmployerApplicationsPage } from "./EmployerApplicationsPage";
import {
  companyAvatarLetter,
  formatCompensationSummary,
  formatPostedShort,
  formatWorkModeLabel,
  matchScorePercent,
} from "./jobFormatters";
import ldLogo from "./assets/ld.png";
import "./App.css";
import {
  formatApiError,
  parseApiValidationErrors,
  parseIndexedListFieldErrors,
} from "./apiErrors";
import { LS_SAVED_JOBS, loadSavedJobIds, persistSavedJobIds } from "./savedJobs";

const EMPLOYER_COMPANY_SIZE_OPTIONS = [
  ["", "Select company size"],
  ["1-10", "1–10 employees"],
  ["11-50", "11–50 employees"],
  ["51-200", "51–200 employees"],
  ["201-500", "201–500 employees"],
  ["501-1000", "501–1,000 employees"],
  ["1000+", "1,000+ employees"],
];

const EMPLOYER_INDUSTRY_SUGGESTIONS = [
  "Technology",
  "Software",
  "Information technology",
  "Healthcare",
  "Finance & banking",
  "Retail",
  "Manufacturing",
  "Construction",
  "Education",
  "Professional services",
  "Hospitality",
  "Transport & logistics",
  "Energy & utilities",
  "Government",
  "Non-profit",
  "Media & marketing",
  "Real estate",
  "Agriculture",
];

const EMPLOYER_INDUSTRY_OPTIONS = [...EMPLOYER_INDUSTRY_SUGGESTIONS].sort((a, b) => a.localeCompare(b));

const EMPTY_EMPLOYER_COMPANY = {
  company_name: "",
  description: "",
  website: "",
  location: "",
  industry: "",
  company_size: "",
  founded_year: "",
  phone: "",
  contact_email: "",
  country: "",
  country_code: "",
  state_region: "",
  city: "",
  suburb: "",
  street_address: "",
  postcode: "",
  business_registration_number: "",
  linkedin_url: "",
};

function buildEmployerCompanyPayload(form) {
  const fy = form.founded_year;
  const n = fy === "" || fy == null ? NaN : parseInt(String(fy), 10);
  return {
    company_name: form.company_name,
    description: form.description,
    website: (form.website || "").trim(),
    location: (form.location || "").trim(),
    industry: form.industry,
    company_size: form.company_size,
    founded_year: Number.isFinite(n) ? n : null,
    phone: form.phone,
    contact_email: form.contact_email,
    country: form.country,
    country_code: (form.country_code || "").trim().toUpperCase(),
    state_region: form.state_region,
    city: form.city,
    suburb: (form.suburb || "").trim(),
    street_address: (form.street_address || "").trim(),
    postcode: (form.postcode || "").trim(),
    business_registration_number: (form.business_registration_number || "").trim(),
    linkedin_url: (form.linkedin_url || "").trim(),
  };
}

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Zm10 3.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M3.5 2.5 21.5 20.5l-1.4 1.4-3.2-3.2A12.9 12.9 0 0 1 12 20c-6.5 0-10-6-10-6a19 19 0 0 1 4.4-4.8L2.1 3.9 3.5 2.5Zm5.7 8.5a3.2 3.2 0 0 0 4.3 4.3L9.2 11Zm2.8-7c6.5 0 10 6 10 6a18.4 18.4 0 0 1-3.8 4.4l-1.5-1.5a16.2 16.2 0 0 0 1.9-1.9s-3-4-8.6-4c-1 0-1.9.1-2.7.4L6 5.8c1.7-.8 3.8-1.3 6-1.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function AuthBrand() {
  return (
    <Link
      to="/"
      className="authBrand authBrandLink"
      aria-label="SkillMesh — go to homepage"
      title="Go to homepage"
    >
      <img src={ldLogo} alt="" />
      <div>
        <strong>SkillMesh</strong>
        <small>Intelligent Talent Matching</small>
      </div>
    </Link>
  );
}

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEmployerLogin = searchParams.get("role") === "employer";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className={`card authCard fadeInUp ${isEmployerLogin ? "authCardEmployerLogin" : "registerShell"}`}
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          await login(email, password);
          navigate("/", { replace: true });
        } catch (err) {
          setError(String(err.message || err));
        }
      }}
    >
      <div className="authLoginHeaderRow">
        <div className="authLoginHeaderStart">
          <BackButton className="homeHeaderBack" />
        </div>
        <div className="authLoginHeaderBrand">
          <AuthBrand />
        </div>
        <div className="authLoginHeaderEnd" aria-hidden="true" />
      </div>
      <h2 className={isEmployerLogin ? "authEmployerLoginTitle" : "authCandidateLoginTitle"}>
        {isEmployerLogin ? "Employer sign in" : "Login"}
      </h2>
      {error && <p className="error">{error}</p>}
      <input
        className={`authInput ${isEmployerLogin ? "authInputLg" : ""}`}
        placeholder="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="passwordFieldWrap">
        <input
          className={`authInput authInputWithToggle ${isEmployerLogin ? "authInputLg" : ""}`}
          placeholder="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          className="passwordToggleBtn"
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          <EyeIcon open={showPassword} />
        </button>
      </div>
      <button className={`modernBtn ${isEmployerLogin ? "authEmployerLoginSubmit" : ""}`} type="submit">
        {isEmployerLogin ? "Sign in" : "Login"}
      </button>
      {isEmployerLogin && (
        <p className="muted authEmployerLoginFooter">
          New here?{" "}
          <Link to="/register?role=employer">Create an employer account</Link>
        </p>
      )}
    </form>
  );
}

function focusFirstRegisterFieldError(fieldErrors, role) {
  function tryFocus(id) {
    const el = document.getElementById(id);
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (typeof el.focus === "function") el.focus();
    return true;
  }
  if (role === "employer") {
    const order = [
      ["email", "employer-register-email"],
      ["username", "employer-register-username"],
      ["password", "employer-reg-password"],
      ["password_confirm", "employer-reg-password2"],
    ];
    for (const [key, id] of order) {
      if (fieldErrors[key] && tryFocus(id)) return;
    }
    return;
  }
  const order = [
    ["email", "reg-cand-email"],
    ["username", "reg-cand-username"],
    ["password", "reg-cand-password"],
    ["password_confirm", "reg-cand-password2"],
    ["first_name", "reg-cand-first"],
    ["last_name", "reg-cand-last"],
    ["date_of_birth", "reg-cand-dob"],
    ["mobile_number", "reg-cand-mobile"],
    ["country", "reg-cand-country"],
  ];
  for (const [key, id] of order) {
    if (fieldErrors[key] && tryFocus(id)) return;
  }
  if (fieldErrors.suburb || fieldErrors.postcode) tryFocus("reg-cand-location");
}

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roleFromUrl = searchParams.get("role") === "employer" ? "employer" : "candidate";
  const [form, setForm] = useState({
    role: roleFromUrl,
    email: "",
    username: "",
    password: "",
    password_confirm: "",
    employer_invite_token: "",
    first_name: "",
    last_name: "",
    date_of_birth: "",
    postcode: "",
    suburb: "",
    location_query: "",
    country: "",
    country_code: "",
    mobile_number: "",
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [countrySuggestions, setCountrySuggestions] = useState([]);
  const [postcodeSuggestions, setPostcodeSuggestions] = useState([]);
  const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState({ state: "idle", message: "" });
  const [manualUsernameEdit, setManualUsernameEdit] = useState(false);
  const [employerInvitePreview, setEmployerInvitePreview] = useState(null);
  const [employerInviteLoadError, setEmployerInviteLoadError] = useState("");
  const inviteFromUrl = searchParams.get("invite");

  useEffect(() => {
    setForm((prev) =>
      prev.role === roleFromUrl ? prev : { ...prev, role: roleFromUrl, employer_invite_token: "" },
    );
    setUsernameStatus({ state: "idle", message: "" });
    setError("");
    setFieldErrors({});
    setEmployerInvitePreview(null);
    setEmployerInviteLoadError("");
  }, [roleFromUrl]);

  useEffect(() => {
    if (roleFromUrl !== "employer") {
      return;
    }
    if (!inviteFromUrl?.trim()) {
      setForm((prev) => (prev.employer_invite_token ? { ...prev, employer_invite_token: "" } : prev));
      setEmployerInvitePreview(null);
      setEmployerInviteLoadError("");
      return;
    }
    let cancelled = false;
    setEmployerInviteLoadError("");
    (async () => {
      try {
        const data = await api(`/api/employers/team/invite/${encodeURIComponent(inviteFromUrl.trim())}`, {
          withAuth: false,
        });
        if (cancelled) return;
        setEmployerInvitePreview(data);
        setForm((prev) => ({ ...prev, email: (data.email || "").trim(), employer_invite_token: inviteFromUrl.trim() }));
      } catch (err) {
        if (cancelled) return;
        setEmployerInvitePreview(null);
        setEmployerInviteLoadError(formatApiError(err));
        setForm((prev) => ({ ...prev, employer_invite_token: "" }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteFromUrl, roleFromUrl]);

  function clearRegisterFieldErr(...keys) {
    setFieldErrors((prev) => {
      let next = prev;
      for (const k of keys) {
        if (!next[k]) continue;
        if (next === prev) next = { ...prev };
        delete next[k];
      }
      return next;
    });
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const passwordRules = {
    minLength: form.password.length >= 8,
    specialChar: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(form.password),
  };
  const passwordValid = passwordRules.minLength && passwordRules.specialChar;
  const usernameValidFormat = /^[A-Za-z0-9_]{3,20}$/.test(form.username.trim());
  const confirmMatches = form.password_confirm.length > 0 && form.password === form.password_confirm;
  const dobValid = Boolean(form.date_of_birth);

  useEffect(() => {
    if (form.role !== "candidate") {
      return;
    }
    if (manualUsernameEdit) {
      return;
    }
    const localPart = form.email.split("@")[0] || "";
    const suggested = localPart
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 20);
    setForm((prev) => ({ ...prev, username: suggested }));
  }, [form.email, form.role, manualUsernameEdit]);

  useEffect(() => {
    if (form.role !== "candidate" && form.role !== "employer") {
      return;
    }
    const username = form.username.trim();
    if (!username) {
      setUsernameStatus({ state: "idle", message: "" });
      return;
    }
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      setUsernameStatus({
        state: "invalid",
        message: "Use 3-20 chars: letters, numbers, underscore.",
      });
      return;
    }
    setUsernameStatus({ state: "checking", message: "Checking availability..." });
    const t = setTimeout(async () => {
      try {
        const res = await api(
          `/api/auth/meta/username-availability?username=${encodeURIComponent(username)}`,
          { withAuth: false },
        );
        if (res.available) {
          setUsernameStatus({ state: "available", message: "Username is available." });
          return;
        }
        let reasonText = res.reason === "taken" ? "Username is already taken." : "Invalid username format.";
        if (res.reason === "taken" && res.existing_role === "candidate" && form.role === "employer") {
          reasonText =
            "This username is registered as a candidate. Sign in as a candidate or choose a different username.";
        }
        if (res.reason === "taken" && res.existing_role === "employer" && form.role === "candidate") {
          reasonText =
            "This username is registered as an employer. Sign in as an employer or choose a different username.";
        }
        setUsernameStatus({ state: "taken", message: reasonText });
      } catch {
        setUsernameStatus({ state: "error", message: "Could not verify username right now." });
      }
    }, 320);
    return () => clearTimeout(t);
  }, [form.username, form.role]);

  useEffect(() => {
    const q = form.country.trim();
    if (form.role !== "candidate" || q.length < 1 || (form.country_code && q.length > 0)) {
      setCountrySuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const rows = await api(`/api/auth/meta/countries?q=${encodeURIComponent(q)}`, { withAuth: false });
        setCountrySuggestions(rows);
      } catch {
        setCountrySuggestions([]);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [form.country, form.role, form.country_code]);

  useEffect(() => {
    const q = form.location_query.trim();
    if (
      form.role !== "candidate" ||
      q.length < 1 ||
      (form.suburb && (form.location_query === `${form.suburb} - ${form.postcode}` || form.location_query === form.suburb))
    ) {
      setPostcodeSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const rows = await api(
          `/api/auth/meta/au-postcodes?q=${encodeURIComponent(q)}&country_code=${encodeURIComponent(form.country_code || "")}`,
          { withAuth: false },
        );
        setPostcodeSuggestions(rows);
      } catch {
        setPostcodeSuggestions([]);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [form.location_query, form.country_code, form.role]);

  const candidateFormValid =
    emailValid &&
    usernameValidFormat &&
    usernameStatus.state === "available" &&
    passwordValid &&
    confirmMatches &&
    dobValid &&
    form.first_name.trim() &&
    form.last_name.trim() &&
    form.country.trim() &&
    form.suburb.trim() &&
    form.postcode.trim() &&
    form.mobile_number.trim();

  const employerFormValid =
    emailValid &&
    usernameValidFormat &&
    usernameStatus.state === "available" &&
    passwordValid &&
    confirmMatches;

  return (
    <form
      className="card authCard registerShell fadeInUp"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setFieldErrors({});
        try {
          await register(form);
          if (form.role === "candidate") {
            navigate("/onboarding/work-experience");
          } else if (form.employer_invite_token) {
            navigate("/employer");
          } else {
            navigate("/employer/onboarding/company");
          }
        } catch (err) {
          const { fieldErrors: fe, generalMessage } = parseApiValidationErrors(err);
          setFieldErrors(fe);
          const hasFields = Object.keys(fe).length > 0;
          setError(hasFields ? generalMessage : generalMessage || formatApiError(err));
          if (hasFields) {
            requestAnimationFrame(() => focusFirstRegisterFieldError(fe, form.role));
          }
        }
      }}
    >
      <div className="authLoginHeaderRow authRegisterHeaderRow">
        <div className="authLoginHeaderStart">
          <BackButton className="homeHeaderBack" />
        </div>
        <div className="authLoginHeaderBrand">
          <AuthBrand />
        </div>
        <div className="authLoginHeaderEnd" aria-hidden="true" />
      </div>
      <h2>{form.role === "candidate" ? "Create Candidate Account" : "Create Employer Account"}</h2>
      <p className="muted registerIntro">
        {form.role === "candidate"
          ? "Tell us a bit about yourself so we can personalize your job matches."
          : "Set up your employer account to post jobs and find talent."}
      </p>
      {error && <p className="error">{error}</p>}
      {form.role === "candidate" ? (
        <>
          <h4 className="registerSectionTitle">Account details</h4>
          <input
            id="reg-cand-email"
            className={`authInput authInputLg ${fieldErrors.email || (form.email && !emailValid) ? "authInputHasError" : ""}`}
            placeholder="Email address"
            value={form.email}
            aria-invalid={!!fieldErrors.email || !!(form.email && !emailValid)}
            aria-describedby={
              fieldErrors.email ? "reg-cand-email-err" : form.email && !emailValid ? "reg-cand-email-hint" : undefined
            }
            onChange={(e) => {
              clearRegisterFieldErr("email");
              setForm({ ...form, email: e.target.value });
            }}
          />
          {fieldErrors.email ? (
            <p className="fieldErrorHint" id="reg-cand-email-err" role="alert">
              {fieldErrors.email}
            </p>
          ) : null}
          {form.email && !emailValid && !fieldErrors.email ? (
            <p className="fieldHelp fieldHelpError" id="reg-cand-email-hint">
              Enter a valid email (example@domain.com).
            </p>
          ) : null}
          <input
            id="reg-cand-username"
            className={`authInput authInputLg ${fieldErrors.username || (form.username && !usernameValidFormat) ? "authInputHasError" : ""}`}
            placeholder="Username"
            value={form.username}
            aria-invalid={!!fieldErrors.username || !!(form.username && !usernameValidFormat)}
            aria-describedby={fieldErrors.username ? "reg-cand-username-err" : undefined}
            onChange={(e) => {
              clearRegisterFieldErr("username");
              setManualUsernameEdit(true);
              setForm({ ...form, username: e.target.value });
            }}
          />
          {fieldErrors.username ? (
            <p className="fieldErrorHint" id="reg-cand-username-err" role="alert">
              {fieldErrors.username}
            </p>
          ) : null}
          {usernameStatus.message && !fieldErrors.username ? (
            <p
              className={`fieldHelp ${
                usernameStatus.state === "available"
                  ? "fieldHelpSuccess"
                  : usernameStatus.state === "checking"
                    ? "fieldHelpMuted"
                    : "fieldHelpError"
              }`}
            >
              {usernameStatus.message}
            </p>
          ) : null}
          <div className="grid">
            <div className="passwordFieldWrap">
              <input
                id="reg-cand-password"
                className={fieldErrors.password ? "authInput authInputWithToggle authInputHasError" : "authInput authInputWithToggle"}
                placeholder="Password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? "reg-cand-password-err" : undefined}
                onChange={(e) => {
                  clearRegisterFieldErr("password");
                  setForm({ ...form, password: e.target.value });
                }}
              />
              <button
                className="passwordToggleBtn"
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
            <div className="passwordFieldWrap">
              <input
                id="reg-cand-password2"
                className={
                  fieldErrors.password_confirm ? "authInput authInputWithToggle authInputHasError" : "authInput authInputWithToggle"
                }
                placeholder="Confirm password"
                type={showPasswordConfirm ? "text" : "password"}
                value={form.password_confirm}
                aria-invalid={!!fieldErrors.password_confirm}
                aria-describedby={fieldErrors.password_confirm ? "reg-cand-password2-err" : undefined}
                onChange={(e) => {
                  clearRegisterFieldErr("password_confirm");
                  setForm({ ...form, password_confirm: e.target.value });
                }}
              />
              <button
                className="passwordToggleBtn"
                type="button"
                onClick={() => setShowPasswordConfirm((prev) => !prev)}
                aria-label={showPasswordConfirm ? "Hide confirm password" : "Show confirm password"}
              >
                <EyeIcon open={showPasswordConfirm} />
              </button>
            </div>
          </div>
          {(fieldErrors.password || fieldErrors.password_confirm) && (
            <div className="registerPasswordApiErrors">
              {fieldErrors.password ? (
                <p className="fieldErrorHint" id="reg-cand-password-err" role="alert">
                  {fieldErrors.password}
                </p>
              ) : null}
              {fieldErrors.password_confirm ? (
                <p className="fieldErrorHint" id="reg-cand-password2-err" role="alert">
                  {fieldErrors.password_confirm}
                </p>
              ) : null}
            </div>
          )}
          <div className="passwordRules">
            <span className={passwordRules.minLength ? "ruleOk" : "rulePending"}>At least 8 characters</span>
            <span className={passwordRules.specialChar ? "ruleOk" : "rulePending"}>At least 1 special character</span>
            <span className={confirmMatches ? "ruleOk" : "rulePending"}>Passwords match</span>
          </div>

          <h4 className="registerSectionTitle">Personal details</h4>
          <div className="grid">
            <input
              id="reg-cand-first"
              className={fieldErrors.first_name ? "authInput authInputHasError" : "authInput"}
              placeholder="First name"
              value={form.first_name}
              aria-invalid={!!fieldErrors.first_name}
              aria-describedby={fieldErrors.first_name ? "reg-cand-first-err" : undefined}
              onChange={(e) => {
                clearRegisterFieldErr("first_name");
                setForm({ ...form, first_name: e.target.value });
              }}
            />
            <input
              id="reg-cand-last"
              className={fieldErrors.last_name ? "authInput authInputHasError" : "authInput"}
              placeholder="Last name"
              value={form.last_name}
              aria-invalid={!!fieldErrors.last_name}
              aria-describedby={fieldErrors.last_name ? "reg-cand-last-err" : undefined}
              onChange={(e) => {
                clearRegisterFieldErr("last_name");
                setForm({ ...form, last_name: e.target.value });
              }}
            />
          </div>
          {(fieldErrors.first_name || fieldErrors.last_name) && (
            <div className="registerNameRowErrors">
              {fieldErrors.first_name ? (
                <p className="fieldErrorHint" id="reg-cand-first-err" role="alert">
                  {fieldErrors.first_name}
                </p>
              ) : null}
              {fieldErrors.last_name ? (
                <p className="fieldErrorHint" id="reg-cand-last-err" role="alert">
                  {fieldErrors.last_name}
                </p>
              ) : null}
            </div>
          )}
          <div className="grid registerDobGrid">
            <SiteDatePicker
              variant="dob"
              label="Date of birth"
              value={form.date_of_birth || ""}
              onChange={(v) => {
                clearRegisterFieldErr("date_of_birth");
                setForm({ ...form, date_of_birth: v });
              }}
              slotProps={{
                textField: {
                  id: "reg-cand-dob",
                  error: !!fieldErrors.date_of_birth,
                  helperText: fieldErrors.date_of_birth || undefined,
                },
              }}
            />
            <input
              id="reg-cand-mobile"
              className={fieldErrors.mobile_number ? "authInput authInputHasError" : "authInput"}
              placeholder="Mobile number"
              value={form.mobile_number}
              aria-invalid={!!fieldErrors.mobile_number}
              aria-describedby={fieldErrors.mobile_number ? "reg-cand-mobile-err" : undefined}
              onChange={(e) => {
                clearRegisterFieldErr("mobile_number");
                setForm({ ...form, mobile_number: e.target.value });
              }}
            />
          </div>
          {fieldErrors.mobile_number ? (
            <p className="fieldErrorHint" id="reg-cand-mobile-err" role="alert">
              {fieldErrors.mobile_number}
            </p>
          ) : null}

          <h4 className="registerSectionTitle">Location details</h4>
          <input
            id="reg-cand-country"
            className={fieldErrors.country ? "authInput authInputLg authInputHasError" : "authInput authInputLg"}
            placeholder="Country (start typing)"
            value={form.country}
            aria-invalid={!!fieldErrors.country}
            aria-describedby={fieldErrors.country ? "reg-cand-country-err" : undefined}
            onChange={(e) => {
              clearRegisterFieldErr("country");
              setForm({ ...form, country: e.target.value, country_code: "", location_query: "", suburb: "", postcode: "" });
            }}
            onFocus={() => setShowCountrySuggestions(true)}
            onBlur={() => setTimeout(() => setShowCountrySuggestions(false), 140)}
          />
          {fieldErrors.country ? (
            <p className="fieldErrorHint" id="reg-cand-country-err" role="alert">
              {fieldErrors.country}
            </p>
          ) : null}
          {showCountrySuggestions && countrySuggestions.length > 0 && (
            <div className="suggestionBox">
              {countrySuggestions.map((c) => (
                <button
                  key={`${c.name}-${c.code}`}
                  type="button"
                  onClick={() => {
                    clearRegisterFieldErr("country");
                    setForm({
                      ...form,
                      country: c.name,
                      country_code: c.code,
                      location_query: "",
                      suburb: "",
                      postcode: "",
                    });
                    setCountrySuggestions([]);
                    setShowCountrySuggestions(false);
                  }}
                >
                  {c.name} ({c.code})
                </button>
              ))}
            </div>
          )}

          <input
            id="reg-cand-location"
            className={
              fieldErrors.suburb || fieldErrors.postcode ? "authInput authInputLg authInputHasError" : "authInput authInputLg"
            }
            placeholder="Suburb or postcode (e.g. Auburn or 2144)"
            value={form.location_query}
            aria-invalid={!!fieldErrors.suburb || !!fieldErrors.postcode}
            aria-describedby={
              fieldErrors.suburb || fieldErrors.postcode ? "reg-cand-location-err" : undefined
            }
            onChange={(e) => {
              clearRegisterFieldErr("suburb", "postcode");
              setForm({ ...form, location_query: e.target.value, suburb: "", postcode: "" });
            }}
            onFocus={() => setShowLocationSuggestions(true)}
            onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 140)}
          />
          {fieldErrors.suburb || fieldErrors.postcode ? (
            <p className="fieldErrorHint" id="reg-cand-location-err" role="alert">
              {[fieldErrors.suburb, fieldErrors.postcode].filter(Boolean).join(" ")}
            </p>
          ) : null}

          {showLocationSuggestions && postcodeSuggestions.length > 0 && (
            <div className="suggestionBox">
              {postcodeSuggestions.map((s) => (
                <button
                  key={`${s.postcode}-${s.suburb}`}
                  type="button"
                  onClick={() => {
                    clearRegisterFieldErr("suburb", "postcode");
                    const label = s.postcode ? `${s.suburb} - ${s.postcode}` : s.suburb;
                    setForm({
                      ...form,
                      location_query: label,
                      postcode: s.postcode || "",
                      suburb: s.suburb || "",
                    });
                    setPostcodeSuggestions([]);
                    setShowLocationSuggestions(false);
                  }}
                >
                  {(s.postcode || "N/A")} - {s.suburb}{s.state ? `, ${s.state}` : ""}{s.country_code ? ` (${s.country_code})` : ""}
                </button>
              ))}
            </div>
          )}

          <button className="modernBtn authSubmitBtn" type="submit" disabled={!candidateFormValid || usernameStatus.state === "checking"}>
            {usernameStatus.state === "checking" ? "Checking username..." : "Create candidate account"}
          </button>
        </>
      ) : (
        <div className="registerEmployerLayout">
          {employerInvitePreview ? (
            <div className="registerEmployerInviteBanner" role="status">
              <strong>Team invite</strong>
              <p>
                You&apos;re joining{" "}
                <strong>{employerInvitePreview.company_name?.trim() || "your organisation"}</strong> as an employer
                teammate. Use the invited email and choose a username and password to access the shared dashboard.
              </p>
            </div>
          ) : null}
          {employerInviteLoadError ? <p className="error registerEmployerGridFull">{employerInviteLoadError}</p> : null}
          <aside className="registerEmployerAside" aria-label="Employer benefits">
            <h3 className="registerEmployerAsideTitle">Built for hiring teams</h3>
            <p className="registerEmployerAsideLead">
              Employer accounts are separate from candidate profiles. Use a work email you check often.
            </p>
            <ul className="registerEmployerBullets">
              <li>Publish open roles and edit listings anytime</li>
              <li>Review applicants in one employer workspace</li>
              <li>Same secure password rules as candidate sign-up</li>
            </ul>
          </aside>
          <div className="registerEmployerMain">
            <h4 className="registerSectionTitle">Sign-in details</h4>
            <label className="registerFieldLabel" htmlFor="employer-register-email">
              Work email
            </label>
            <input
              id="employer-register-email"
              className={`authInput authInputLg ${fieldErrors.email || (form.email && !emailValid) ? "authInputHasError" : ""}`}
              placeholder="you@company.com"
              autoComplete="email"
              value={form.email}
              readOnly={Boolean(form.employer_invite_token)}
              aria-invalid={!!fieldErrors.email || !!(form.email && !emailValid)}
              aria-describedby={
                fieldErrors.email ? "employer-reg-email-err" : form.email && !emailValid ? "employer-reg-email-hint" : undefined
              }
              onChange={(e) => {
                if (form.employer_invite_token) return;
                clearRegisterFieldErr("email");
                setForm({ ...form, email: e.target.value });
              }}
            />
            {fieldErrors.email ? (
              <p className="fieldErrorHint" id="employer-reg-email-err" role="alert">
                {fieldErrors.email}
              </p>
            ) : null}
            {form.email && !emailValid && !fieldErrors.email ? (
              <p className="fieldHelp fieldHelpError" id="employer-reg-email-hint">
                Enter a valid email (example@domain.com).
              </p>
            ) : null}
            <label className="registerFieldLabel" htmlFor="employer-register-username">
              Username
            </label>
            <input
              id="employer-register-username"
              className={`authInput authInputLg ${fieldErrors.username || (form.username && !usernameValidFormat) ? "authInputHasError" : ""}`}
              placeholder="3–20 characters: letters, numbers, underscore"
              autoComplete="username"
              value={form.username}
              aria-invalid={!!fieldErrors.username || !!(form.username && !usernameValidFormat)}
              aria-describedby={fieldErrors.username ? "employer-reg-username-err" : undefined}
              onChange={(e) => {
                clearRegisterFieldErr("username");
                setForm({ ...form, username: e.target.value });
              }}
            />
            {fieldErrors.username ? (
              <p className="fieldErrorHint" id="employer-reg-username-err" role="alert">
                {fieldErrors.username}
              </p>
            ) : null}
            {usernameStatus.message && !fieldErrors.username ? (
              <p
                className={`fieldHelp ${
                  usernameStatus.state === "available"
                    ? "fieldHelpSuccess"
                    : usernameStatus.state === "checking"
                      ? "fieldHelpMuted"
                      : "fieldHelpError"
                }`}
              >
                {usernameStatus.message}
              </p>
            ) : null}
            <h4 className="registerSectionTitle">Password</h4>
            <div className="grid">
              <div className="passwordFieldWrap">
                <input
                  id="employer-reg-password"
                  className={fieldErrors.password ? "authInput authInputWithToggle authInputHasError" : "authInput authInputWithToggle"}
                  placeholder="Password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? "employer-reg-password-err" : undefined}
                  onChange={(e) => {
                    clearRegisterFieldErr("password");
                    setForm({ ...form, password: e.target.value });
                  }}
                />
                <button
                  className="passwordToggleBtn"
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              <div className="passwordFieldWrap">
                <input
                  id="employer-reg-password2"
                  className={
                    fieldErrors.password_confirm ? "authInput authInputWithToggle authInputHasError" : "authInput authInputWithToggle"
                  }
                  placeholder="Confirm password"
                  type={showPasswordConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password_confirm}
                  aria-invalid={!!fieldErrors.password_confirm}
                  aria-describedby={fieldErrors.password_confirm ? "employer-reg-password2-err" : undefined}
                  onChange={(e) => {
                    clearRegisterFieldErr("password_confirm");
                    setForm({ ...form, password_confirm: e.target.value });
                  }}
                />
                <button
                  className="passwordToggleBtn"
                  type="button"
                  onClick={() => setShowPasswordConfirm((prev) => !prev)}
                  aria-label={showPasswordConfirm ? "Hide confirm password" : "Show confirm password"}
                >
                  <EyeIcon open={showPasswordConfirm} />
                </button>
              </div>
            </div>
            {(fieldErrors.password || fieldErrors.password_confirm) && (
              <div className="registerPasswordApiErrors">
                {fieldErrors.password ? (
                  <p className="fieldErrorHint" id="employer-reg-password-err" role="alert">
                    {fieldErrors.password}
                  </p>
                ) : null}
                {fieldErrors.password_confirm ? (
                  <p className="fieldErrorHint" id="employer-reg-password2-err" role="alert">
                    {fieldErrors.password_confirm}
                  </p>
                ) : null}
              </div>
            )}
            <div className="passwordRules">
              <span className={passwordRules.minLength ? "ruleOk" : "rulePending"}>At least 8 characters</span>
              <span className={passwordRules.specialChar ? "ruleOk" : "rulePending"}>At least 1 special character</span>
              <span className={confirmMatches ? "ruleOk" : "rulePending"}>Passwords match</span>
            </div>
            <button
              className="modernBtn authSubmitBtn"
              type="submit"
              disabled={!employerFormValid || usernameStatus.state === "checking"}
            >
              {usernameStatus.state === "checking" ? "Checking username…" : "Create employer account"}
            </button>
            <p className="registerEmployerFooter muted">
              Already have an account? <Link to="/login?role=employer">Sign in</Link>
              <span className="registerEmployerFooterSep">·</span>
              Looking for jobs? <Link to="/register?role=candidate">Create a candidate account</Link>
            </p>
          </div>
        </div>
      )}
    </form>
  );
}

function CandidateOnboardingRoute({ page, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "candidate") return <Navigate to="/" replace />;
  const step = user?.candidate_onboarding?.onboarding_step;

  if (page === "dashboard" || page === "saved_jobs" || page === "applied_jobs") {
    if (step === "resume") return <Navigate to="/onboarding/work-experience" replace />;
    if (step === "categories") return <Navigate to="/onboarding/categories" replace />;
    return children;
  }
  if (page === "work_experience") {
    if (step === "categories") return <Navigate to="/onboarding/categories" replace />;
    if (step === "done") return <Navigate to="/" replace />;
    return children;
  }
  if (page === "categories") {
    if (step === "resume") return <Navigate to="/onboarding/work-experience" replace />;
    if (step === "done") return <Navigate to="/" replace />;
    return children;
  }
  return children;
}

function CandidateOnboardingWorkExperience() {
  const navigate = useNavigate();
  const { refreshMe } = useAuth();
  const [resumeFile, setResumeFile] = useState(null);
  /** True once the current resumeFile has been POSTed to the server (auto-fill or save). */
  const [resumeSynced, setResumeSynced] = useState(false);
  const [resumePreviewUrl, setResumePreviewUrl] = useState("");
  const [showLargePreview, setShowLargePreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [workRowErrors, setWorkRowErrors] = useState({});
  const [eduRowErrors, setEduRowErrors] = useState({});
  const [workRows, setWorkRows] = useState([
    { job_title: "", company_name: "", description: "", start_date: "", end_date: "", is_current: false, sort_order: 0 },
    { job_title: "", company_name: "", description: "", start_date: "", end_date: "", is_current: false, sort_order: 1 },
    { job_title: "", company_name: "", description: "", start_date: "", end_date: "", is_current: false, sort_order: 2 },
  ]);
  const emptyRows = [
    { job_title: "", company_name: "", description: "", start_date: "", end_date: "", is_current: false, sort_order: 0 },
    { job_title: "", company_name: "", description: "", start_date: "", end_date: "", is_current: false, sort_order: 1 },
    { job_title: "", company_name: "", description: "", start_date: "", end_date: "", is_current: false, sort_order: 2 },
  ];
  const [educationRows, setEducationRows] = useState([
    { institution: "", degree: "", field_of_study: "", major: "", description: "", start_date: "", end_date: "", is_current: false, sort_order: 0 },
    { institution: "", degree: "", field_of_study: "", major: "", description: "", start_date: "", end_date: "", is_current: false, sort_order: 1 },
  ]);
  const emptyEduRows = [
    { institution: "", degree: "", field_of_study: "", major: "", description: "", start_date: "", end_date: "", is_current: false, sort_order: 0 },
    { institution: "", degree: "", field_of_study: "", major: "", description: "", start_date: "", end_date: "", is_current: false, sort_order: 1 },
  ];

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await api("/api/candidates/work-experience/");
        if (!alive) return;
        if (Array.isArray(rows) && rows.length > 0) {
          setWorkRows(rows.map((r, idx) => ({ ...r, sort_order: idx })));
        }
      } catch {
        // keep initial form state
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await api("/api/candidates/education/");
        if (!alive) return;
        if (Array.isArray(rows) && rows.length > 0) {
          setEducationRows(rows.map((r, idx) => ({ ...r, sort_order: idx })));
        }
      } catch {
        // keep initial form state
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (resumePreviewUrl) URL.revokeObjectURL(resumePreviewUrl);
    };
  }, [resumePreviewUrl]);

  function onResumeSelected(file) {
    setResumeFile(file || null);
    setResumeSynced(false);
    setStatus("");
    setError("");
    if (resumePreviewUrl) URL.revokeObjectURL(resumePreviewUrl);
    const fileName = (file?.name || "").toLowerCase();
    const isPreviewable =
      !!file && (
        file.type.startsWith("image/")
        || file.type === "application/pdf"
        || fileName.endsWith(".pdf")
        || fileName.endsWith(".png")
        || fileName.endsWith(".jpg")
        || fileName.endsWith(".jpeg")
      );
    if (isPreviewable) {
      setResumePreviewUrl(URL.createObjectURL(file));
    } else {
      setResumePreviewUrl("");
    }
  }

  function updateRow(index, patch) {
    setWorkRowErrors((prev) => {
      if (!prev[index]) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setWorkRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setWorkRows((prev) => [
      ...prev,
      { job_title: "", company_name: "", description: "", start_date: "", end_date: "", is_current: false, sort_order: prev.length },
    ]);
  }

  function removeRow(index) {
    setWorkRows((prev) => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, sort_order: i })));
  }

  function updateEduRow(index, patch) {
    setEduRowErrors((prev) => {
      if (!prev[index]) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setEducationRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addEduRow() {
    setEducationRows((prev) => [
      ...prev,
      { institution: "", degree: "", field_of_study: "", major: "", description: "", start_date: "", end_date: "", is_current: false, sort_order: prev.length },
    ]);
  }

  function removeEduRow(index) {
    setEducationRows((prev) => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, sort_order: i })));
  }

  async function autoFillFromResume() {
    if (!resumeFile) {
      // #region agent log
      fetch("http://127.0.0.1:7880/ingest/bd22d204-09ad-4811-98c6-6dcf9f5fcce8", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9c37a0" },
        body: JSON.stringify({
          sessionId: "9c37a0",
          location: "App.jsx:autoFillFromResume",
          message: "blocked no file",
          data: { hypothesisId: "A" },
          timestamp: Date.now(),
          hypothesisId: "A",
        }),
      }).catch(() => {});
      // #endregion
      setError("Please upload a resume first.");
      return;
    }
    // #region agent log
    const _fn = (resumeFile.name || "").toLowerCase();
    const _ext = _fn.includes(".") ? _fn.split(".").pop() : "";
    fetch("http://127.0.0.1:7880/ingest/bd22d204-09ad-4811-98c6-6dcf9f5fcce8", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9c37a0" },
      body: JSON.stringify({
        sessionId: "9c37a0",
        location: "App.jsx:autoFillFromResume",
        message: "upload start",
        data: { hypothesisId: "B", ext: _ext, size: resumeFile.size, mime: resumeFile.type || "" },
        timestamp: Date.now(),
        hypothesisId: "B",
      }),
    }).catch(() => {});
    // #endregion
    setUploading(true);
    setError("");
    setStatus("");
    try {
      const fd = new FormData();
      fd.append("file", resumeFile);
      const resume = await api("/api/candidates/resume/upload", { method: "POST", body: fd });
      setResumeSynced(true);
      const parsedRows = resume?.parsed_json?.work_experiences || [];
      const studyRows = resume?.parsed_json?.studies || [];
      const confidence = resume?.parsed_json?.experience_parse_confidence;
      const eduConfidence = resume?.parsed_json?.education_parse_confidence;
      const llmSource = resume?.parsed_json?._parse_meta?.work_experience_source === "llm";
      const eduLlmSource = resume?.parsed_json?._parse_meta?.studies_source === "llm";
      // Always show extracted rows when present; low confidence only affects messaging (not blanking the form).
      const willFill = parsedRows.length > 0;
      const willFillEdu = studyRows.length > 0;
      const warnLowConfidence = parsedRows.length > 0 && !llmSource && typeof confidence === "number" && confidence < 0.5;
      const warnLowEdu =
        studyRows.length > 0 && !eduLlmSource && typeof eduConfidence === "number" && eduConfidence < 0.5;
      // #region agent log
      fetch("http://127.0.0.1:7880/ingest/bd22d204-09ad-4811-98c6-6dcf9f5fcce8", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9c37a0" },
        body: JSON.stringify({
          sessionId: "9c37a0",
          location: "App.jsx:autoFillFromResume",
          message: "upload response",
          data: {
            hypothesisId: "C",
            parsedCount: parsedRows.length,
            confidence,
            willFill,
            warnLowConfidence,
            hasParsedJson: !!resume?.parsed_json,
          },
          timestamp: Date.now(),
          hypothesisId: "C",
        }),
      }).catch(() => {});
      // #endregion
      if (willFill) {
        setWorkRows(parsedRows.map((r, idx) => ({ ...r, sort_order: idx })));
      } else {
        setWorkRows(emptyRows);
      }
      if (willFillEdu) {
        setEducationRows(studyRows.map((r, idx) => ({ ...r, sort_order: idx })));
      } else {
        setEducationRows(emptyEduRows);
      }

      const workPart = (() => {
        if (!willFill) {
          return "No work experience was extracted (image-only or scanned PDFs often lack text—try a text-based PDF or DOCX, or enter roles manually).";
        }
        const confidenceText = typeof confidence === "number" ? ` (confidence: ${Math.round(confidence * 100)}%)` : "";
        if (warnLowConfidence) {
          return `Work experiences were filled${confidenceText}; please review—match quality may be low.`;
        }
        return `Work experiences were auto-filled${confidenceText}.`;
      })();
      const eduPart = (() => {
        if (!willFillEdu) {
          return "No education section was extracted—add study below if needed.";
        }
        const t = typeof eduConfidence === "number" ? ` (confidence: ${Math.round(eduConfidence * 100)}%)` : "";
        if (warnLowEdu) {
          return `Education was filled${t}; please review—match quality may be low.`;
        }
        return `Education was auto-filled${t}.`;
      })();
      setStatus(`Resume parsed. ${workPart} ${eduPart}`);
    } catch (err) {
      // #region agent log
      fetch("http://127.0.0.1:7880/ingest/bd22d204-09ad-4811-98c6-6dcf9f5fcce8", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9c37a0" },
        body: JSON.stringify({
          sessionId: "9c37a0",
          location: "App.jsx:autoFillFromResume",
          message: "upload error",
          data: { hypothesisId: "B", err: String(err?.message || err) },
          timestamp: Date.now(),
          hypothesisId: "B",
        }),
      }).catch(() => {});
      // #endregion
      setError(String(err.message || err));
    } finally {
      setUploading(false);
    }
  }

  async function saveAndContinue() {
    setSaving(true);
    setError("");
    setStatus("");
    setWorkRowErrors({});
    setEduRowErrors({});
    try {
      if (resumeFile && !resumeSynced) {
        const fd = new FormData();
        fd.append("file", resumeFile);
        await api("/api/candidates/resume/upload", { method: "POST", body: fd });
        setResumeSynced(true);
      }
      const eduPayload = educationRows
        .filter((r) => {
          const parts = [r.institution, r.degree, r.field_of_study, r.major, r.description].map((x) => String(x || "").trim());
          return parts.some(Boolean);
        })
        .map((r, idx) => ({
          institution: String(r.institution || "").trim(),
          degree: String(r.degree || "").trim(),
          field_of_study: String(r.field_of_study || "").trim(),
          major: String(r.major || "").trim(),
          description: String(r.description || "").trim(),
          start_date: r.start_date || null,
          end_date: r.is_current ? null : (r.end_date || null),
          is_current: !!r.is_current,
          sort_order: idx,
        }));
      const workPayload = workRows
        .filter((r) => r.job_title.trim())
        .map((r, idx) => ({
          job_title: r.job_title.trim(),
          company_name: String(r.company_name || "").trim(),
          description: String(r.description || "").trim(),
          start_date: r.start_date || null,
          end_date: r.is_current ? null : (r.end_date || null),
          is_current: !!r.is_current,
          sort_order: idx,
        }));
      await api("/api/candidates/profile/bundle/", {
        method: "PUT",
        body: JSON.stringify({
          education_entries: eduPayload,
          work_experiences: workPayload,
        }),
      });
      await refreshMe();
      navigate("/onboarding/categories");
    } catch (err) {
      const raw = String(err?.message || err || "");
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        setError(raw || "Something went wrong.");
        return;
      }
      const rawWorkErr = parseIndexedListFieldErrors(data.work_experiences);
      const rawEduErr = parseIndexedListFieldErrors(data.education_entries);
      const workUiByPayload = [];
      workRows.forEach((r, i) => {
        if (r.job_title.trim()) workUiByPayload.push(i);
      });
      const eduUiByPayload = [];
      educationRows.forEach((r, i) => {
        const parts = [r.institution, r.degree, r.field_of_study, r.major, r.description].map((x) => String(x || "").trim());
        if (parts.some(Boolean)) eduUiByPayload.push(i);
      });
      const wErr = {};
      for (const [payloadIdx, rowErr] of Object.entries(rawWorkErr)) {
        const ui = workUiByPayload[Number(payloadIdx)];
        if (ui !== undefined) wErr[ui] = rowErr;
      }
      const eErr = {};
      for (const [payloadIdx, rowErr] of Object.entries(rawEduErr)) {
        const ui = eduUiByPayload[Number(payloadIdx)];
        if (ui !== undefined) eErr[ui] = rowErr;
      }
      setWorkRowErrors(wErr);
      setEduRowErrors(eErr);
      const filtered = { ...data };
      delete filtered.work_experiences;
      delete filtered.education_entries;
      const { generalMessage } = parseApiValidationErrors({ message: JSON.stringify(filtered) });
      const hasRowErr = Object.keys(wErr).length > 0 || Object.keys(eErr).length > 0;
      setError(
        generalMessage || (hasRowErr ? "Fix the highlighted fields below." : raw || "Something went wrong."),
      );
      if (hasRowErr) {
        requestAnimationFrame(() => {
          const el = document.querySelector(".experienceCard .authInputHasError, .experienceCard .Mui-error");
          el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function skipStep() {
    setError("");
    setStatus("");
    try {
      await api("/api/candidates/onboarding/advance", {
        method: "POST",
        body: JSON.stringify({ action: "skip_resume_experience" }),
      });
      await refreshMe();
      navigate("/onboarding/categories");
    } catch (err) {
      setError(String(err.message || err));
    }
  }

  function listRowFieldErr(rowMap, index, field) {
    const row = rowMap[index];
    if (!row) return "";
    return row[field] || "";
  }
  function listRowGeneralErr(rowMap, index) {
    return rowMap[index]?._row || "";
  }

  return (
    <section className="card authCard onboardingCard fadeInUp">
      <div className="onboardTop onboardTopBarRow">
        <SiteBrandBar />
        <div className="onboardTopEnd">
          <button type="button" className="btnGhost" onClick={skipStep}>Skip</button>
        </div>
      </div>
      <h2>Resume, education &amp; work experience</h2>
      <p className="muted">Upload a resume (PDF/JPG/PNG/DOCX) and add study and roles. We can auto-fill both from your file.</p>
      {status && <p className="success">{status}</p>}
      {error && <p className="error">{error}</p>}

      <div className="onboardResumeRow">
        <input
          className="authInput"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.docx"
          onChange={(e) => onResumeSelected(e.target.files?.[0] || null)}
        />
        <button type="button" className="modernBtn" onClick={autoFillFromResume} disabled={uploading}>
          {uploading ? "Parsing resume..." : "Auto-fill from resume"}
        </button>
      </div>

      {resumeFile && (
        <div className="resumePreviewMini">
          <div>
            <strong>{resumeFile.name}</strong>
            <small>{Math.round(resumeFile.size / 1024)} KB</small>
          </div>
          {!!resumePreviewUrl && (
            <button type="button" className="btnGhost" onClick={() => setShowLargePreview(true)}>Preview</button>
          )}
        </div>
      )}

      <h4 className="registerSectionTitle">Education</h4>
      {educationRows.map((row, index) => (
        <div className="experienceCard" key={`edu-${index}`}>
          {listRowGeneralErr(eduRowErrors, index) ? (
            <p className="fieldErrorHint" role="alert">
              {listRowGeneralErr(eduRowErrors, index)}
            </p>
          ) : null}
          <div className="onboardGrid">
            <input
              className={listRowFieldErr(eduRowErrors, index, "institution") ? "authInput authInputHasError" : "authInput"}
              placeholder="Institution"
              value={row.institution || ""}
              onChange={(e) => updateEduRow(index, { institution: e.target.value })}
            />
            <input
              className={listRowFieldErr(eduRowErrors, index, "degree") ? "authInput authInputHasError" : "authInput"}
              placeholder="Degree (e.g. Bachelor of Science)"
              value={row.degree || ""}
              onChange={(e) => updateEduRow(index, { degree: e.target.value })}
            />
          </div>
          <div className="onboardGrid">
            <input
              className={listRowFieldErr(eduRowErrors, index, "field_of_study") ? "authInput authInputHasError" : "authInput"}
              placeholder="Field of study"
              value={row.field_of_study || ""}
              onChange={(e) => updateEduRow(index, { field_of_study: e.target.value })}
            />
            <input
              className={listRowFieldErr(eduRowErrors, index, "major") ? "authInput authInputHasError" : "authInput"}
              placeholder="Major"
              value={row.major || ""}
              onChange={(e) => updateEduRow(index, { major: e.target.value })}
            />
          </div>
          <textarea
            className={listRowFieldErr(eduRowErrors, index, "description") ? "authInput authInputHasError" : "authInput"}
            placeholder="Honours, coursework, or other details"
            value={row.description || ""}
            onChange={(e) => updateEduRow(index, { description: e.target.value })}
          />
          <div className="onboardGrid">
            <SiteDatePicker
              label="Start"
              value={row.start_date || ""}
              onChange={(v) => updateEduRow(index, { start_date: v })}
              slotProps={{
                textField: {
                  error: !!listRowFieldErr(eduRowErrors, index, "start_date"),
                  helperText: listRowFieldErr(eduRowErrors, index, "start_date") || undefined,
                },
              }}
            />
            {!row.is_current ? (
              <SiteDatePicker
                label="End"
                value={row.end_date || ""}
                onChange={(v) => updateEduRow(index, { end_date: v })}
                slotProps={{
                  textField: {
                    error: !!listRowFieldErr(eduRowErrors, index, "end_date"),
                    helperText: listRowFieldErr(eduRowErrors, index, "end_date") || undefined,
                  },
                }}
              />
            ) : (
              <div className="presentNowTag">Currently studying</div>
            )}
          </div>
          <div className="onboardActions">
            <label className="checkLine">
              <input
                type="checkbox"
                checked={!!row.is_current}
                onChange={(e) => updateEduRow(index, { is_current: e.target.checked, end_date: e.target.checked ? "" : row.end_date })}
              />
              I am currently enrolled
            </label>
            {educationRows.length > 1 && (
              <button type="button" className="btnGhost" onClick={() => removeEduRow(index)}>Remove</button>
            )}
          </div>
        </div>
      ))}
      <button type="button" className="addExpBtn" onClick={addEduRow}>+ Add more education</button>

      <h4 className="registerSectionTitle">Work experiences</h4>
      {workRows.map((row, index) => (
        <div className="experienceCard" key={`exp-${index}`}>
          {listRowGeneralErr(workRowErrors, index) ? (
            <p className="fieldErrorHint" role="alert">
              {listRowGeneralErr(workRowErrors, index)}
            </p>
          ) : null}
          <div className="onboardGrid">
            <input
              className={listRowFieldErr(workRowErrors, index, "job_title") ? "authInput authInputHasError" : "authInput"}
              placeholder="Job role"
              value={row.job_title || ""}
              onChange={(e) => updateRow(index, { job_title: e.target.value })}
            />
            <input
              className={listRowFieldErr(workRowErrors, index, "company_name") ? "authInput authInputHasError" : "authInput"}
              placeholder="Company name"
              value={row.company_name || ""}
              onChange={(e) => updateRow(index, { company_name: e.target.value })}
            />
          </div>
          <textarea
            className={listRowFieldErr(workRowErrors, index, "description") ? "authInput authInputHasError" : "authInput"}
            placeholder="Job description"
            value={row.description || ""}
            onChange={(e) => updateRow(index, { description: e.target.value })}
          />
          <div className="onboardGrid">
            <SiteDatePicker
              label="Start date"
              value={row.start_date || ""}
              onChange={(v) => updateRow(index, { start_date: v })}
              slotProps={{
                textField: {
                  error: !!listRowFieldErr(workRowErrors, index, "start_date"),
                  helperText: listRowFieldErr(workRowErrors, index, "start_date") || undefined,
                },
              }}
            />
            {!row.is_current ? (
              <SiteDatePicker
                label="End date"
                value={row.end_date || ""}
                onChange={(v) => updateRow(index, { end_date: v })}
                slotProps={{
                  textField: {
                    error: !!listRowFieldErr(workRowErrors, index, "end_date"),
                    helperText: listRowFieldErr(workRowErrors, index, "end_date") || undefined,
                  },
                }}
              />
            ) : (
              <div className="presentNowTag">Present role</div>
            )}
          </div>
          <div className="onboardActions">
            <label className="checkLine">
              <input
                type="checkbox"
                checked={!!row.is_current}
                onChange={(e) => updateRow(index, { is_current: e.target.checked, end_date: e.target.checked ? "" : row.end_date })}
              />
              I currently work here
            </label>
            {workRows.length > 1 && (
              <button type="button" className="btnGhost" onClick={() => removeRow(index)}>Remove</button>
            )}
          </div>
        </div>
      ))}
      <button type="button" className="addExpBtn" onClick={addRow}>+ Add more work experience</button>
      <button type="button" className="modernBtn authSubmitBtn" onClick={saveAndContinue} disabled={saving}>
        {saving ? "Saving..." : "Save and continue"}
      </button>

      {showLargePreview && (
        <div className="resumeOverlay" onClick={() => setShowLargePreview(false)}>
          <div className="resumePreviewModal" onClick={(e) => e.stopPropagation()}>
            <div className="resumePreviewToolbar">
              <span className="resumePreviewName">{resumeFile?.name || "Resume"}</span>
              <button type="button" className="resumePreviewClose" onClick={() => setShowLargePreview(false)}>
                Close
              </button>
            </div>
            <div className="resumePreviewBody">
              {resumeFile?.type.startsWith("image/") || /\.(png|jpg|jpeg)$/i.test(resumeFile?.name || "") ? (
                <img src={resumePreviewUrl} alt="Resume preview" />
              ) : (
                <iframe src={resumePreviewUrl} title="Resume preview" />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function CandidateCategoryOnboarding() {
  const navigate = useNavigate();
  const { refreshMe } = useAuth();
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const rows = await api("/api/candidates/job-categories/", { withAuth: false });
        setCategories(rows || []);
      } catch {
        setCategories([]);
      }
    })();
  }, []);

  function toggleCategory(id) {
    setFieldErrors((prev) => {
      if (!prev.preferred_job_category_ids) return prev;
      const next = { ...prev };
      delete next.preferred_job_category_ids;
      return next;
    });
    setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  async function completeCategories() {
    setSaving(true);
    setError("");
    setFieldErrors({});
    try {
      await api("/api/candidates/profile", {
        method: "PATCH",
        body: JSON.stringify({
          preferred_job_category_ids: selected,
          onboarding_step: "done",
        }),
      });
      await api("/api/candidates/onboarding/advance", {
        method: "POST",
        body: JSON.stringify({ action: "complete_categories" }),
      });
      await refreshMe();
      navigate("/", { replace: true });
    } catch (err) {
      const { fieldErrors: fe, generalMessage } = parseApiValidationErrors(err);
      setFieldErrors(fe);
      const hasFields = Object.keys(fe).length > 0;
      setError(hasFields ? generalMessage : generalMessage || formatApiError(err));
      if (fe.preferred_job_category_ids) {
        requestAnimationFrame(() => {
          document.querySelector(".categoryGrid")?.scrollIntoView?.({ behavior: "smooth", block: "center" });
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card authCard onboardingCard fadeInUp">
      <div className="onboardTop onboardTopBarRow">
        <SiteBrandBar />
        <div className="onboardTopEnd">
          <span className="onboardTopSpacer" aria-hidden="true" />
        </div>
      </div>
      <h2>Select preferred job categories</h2>
      <p className="muted">Choose categories so matching jobs surface first on your feed and for future recommendations.</p>
      {error && <p className="error">{error}</p>}
      {fieldErrors.preferred_job_category_ids ? (
        <p className="fieldErrorHint" id="onb-categories-err" role="alert">
          {fieldErrors.preferred_job_category_ids}
        </p>
      ) : null}
      <div
        className={`categoryGrid${fieldErrors.preferred_job_category_ids ? " categoryGridHasError" : ""}`}
        aria-invalid={!!fieldErrors.preferred_job_category_ids}
        aria-describedby={fieldErrors.preferred_job_category_ids ? "onb-categories-err" : undefined}
      >
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`categoryPill ${selected.includes(c.id) ? "categoryPillActive" : ""}`}
            onClick={() => toggleCategory(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>
      <button className="modernBtn authSubmitBtn" type="button" onClick={completeCategories} disabled={saving}>
        {saving ? "Saving..." : "Finish onboarding"}
      </button>
    </section>
  );
}

const LS_RECENT_SEARCHES = "skillmesh_recent_searches";

function saveIdSet(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

function loadRecentSearches() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_RECENT_SEARCHES) || "[]");
    return Array.isArray(raw) ? raw.filter((s) => typeof s === "string").slice(0, 10) : [];
  } catch {
    return [];
  }
}

function pushRecentSearch(q) {
  const t = q.trim();
  if (!t) return loadRecentSearches();
  const prev = loadRecentSearches().filter((x) => x.toLowerCase() !== t.toLowerCase());
  const next = [t, ...prev].slice(0, 10);
  localStorage.setItem(LS_RECENT_SEARCHES, JSON.stringify(next));
  return next;
}

function isRecentlyPosted(iso) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 4 * 86400000;
}

/** Rough salary range in thousands (AUD), from description text — used only for client-side filter. */
function parseSalaryRangeK(jd) {
  if (!jd || typeof jd !== "string") return null;
  const text = jd.replace(/,/g, " ").toLowerCase();
  const rangeM = text.match(/(\d{2,3})\s*[-–]\s*(\d{2,3})\s*k\b/);
  if (rangeM) {
    return { minK: Number(rangeM[1]), maxK: Number(rangeM[2]) };
  }
  const kMatches = [...text.matchAll(/\$\s*(\d{2,3})\s*k\b/g)].map((m) => Number(m[1]));
  if (kMatches.length >= 2) {
    return { minK: Math.min(...kMatches), maxK: Math.max(...kMatches) };
  }
  if (kMatches.length === 1) return { minK: kMatches[0], maxK: kMatches[0] };
  const dMatches = [...text.matchAll(/\$\s*(\d{4,6})\b/g)].map((m) => Math.round(Number(m[1]) / 1000));
  if (dMatches.length >= 1) {
    const a = Math.min(...dMatches);
    const b = Math.max(...dMatches);
    return { minK: a, maxK: b };
  }
  return null;
}

function salaryRangeMatchesUser(pr, userMinK, userMaxK) {
  const cap = userMaxK >= 350 ? 1e6 : userMaxK;
  return pr.maxK >= userMinK && pr.minK <= cap;
}

function matchesWorkTypeFilter(jd, workTypeFilter) {
  if (!workTypeFilter) return true;
  const t = (jd || "").toLowerCase();
  if (workTypeFilter === "fulltime") {
    return /\b(full[-\s]?time|permanent|f\.?\s*t\.?)\b/i.test(t) || t.includes("full time");
  }
  if (workTypeFilter === "parttime") {
    return /\b(part[-\s]?time|p\.?\s*t\.?)\b/i.test(t) || t.includes("part time");
  }
  if (workTypeFilter === "casual") return /\bcasual\b/i.test(t);
  if (workTypeFilter === "contract") return /\b(contract|contractor|fixed[-\s]?term)\b/i.test(t);
  return true;
}

function matchesListedFilter(createdAt, listedDays) {
  if (!listedDays) return true;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return true;
  const maxAgeDays = Number(listedDays);
  return (Date.now() - t) / 86400000 <= maxAgeDays;
}

const SALARY_STEPS_K = [0, 30, 50, 80, 100, 120, 150, 200, 250, 300, 350];

function formatSalaryPillLabel(k) {
  if (k <= 0) return "$0";
  if (k >= 350) return "$350K+";
  return `$${k}K`;
}

function JobFilterPill({ pillId, summary, isOpen, onToggle, children }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onToggle(null);
    };
    const t = window.setTimeout(() => document.addEventListener("mousedown", h, true), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", h, true);
    };
  }, [isOpen, onToggle]);

  return (
    <div className="jobsSeekPillWrap" ref={ref}>
      <button
        type="button"
        className={`jobsSeekFilterPill ${isOpen ? "jobsSeekFilterPillOpen" : ""}`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => onToggle(isOpen ? null : pillId)}
      >
        <span className="jobsSeekFilterPillText">{summary}</span>
        <span className="jobsSeekFilterPillChev" aria-hidden />
      </button>
      <div
        className={`jobsSeekPillDropdown ${isOpen ? "jobsSeekPillDropdownOpen" : ""}`}
        aria-hidden={!isOpen}
      >
        <div className="jobsSeekPillDropdownInner" role="listbox">
          {children}
        </div>
      </div>
    </div>
  );
}

function JobFilterMenuOption({ label, selected, onPick }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`jobsSeekPillOption ${selected ? "jobsSeekPillOptionOn" : ""}`}
      onClick={onPick}
    >
      {label}
    </button>
  );
}

function candidateJobSearchBlobLower(j) {
  const joinBullets = (arr) =>
    (Array.isArray(arr) ? arr : [])
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .join(" ");
  return [
    j.title,
    j.location,
    j.company_info,
    j.jd_text,
    j.how_to_apply,
    j.licenses_certifications,
    formatCompensationSummary(j),
    joinBullets(j.whats_on_offer),
    joinBullets(j.looking_for_people_bullets),
    joinBullets(j.looking_for_additional_bullets),
    joinBullets(j.role_bullets),
    joinBullets(j.why_choose_us_bullets),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function candidateJobMatchesWhere(j, locationFilter, locationSearchTerms) {
  const blob = candidateJobSearchBlobLower(j);
  const raw = (locationFilter || "").trim();
  const structured = Array.isArray(locationSearchTerms) && locationSearchTerms.length > 0;
  if (!raw && !structured) return true;
  if (structured) {
    return locationSearchTerms.every(
      (t) => String(t || "").trim().length >= 2 && blob.includes(String(t).trim().toLowerCase()),
    );
  }
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 2);
  if (parts.length) return parts.every((p) => blob.includes(p));
  const single = raw.toLowerCase();
  return single.length >= 2 && blob.includes(single);
}

function CandidateHomePage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [jobCategories, setJobCategories] = useState([]);
  const [feedJobs, setFeedJobs] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [jobsError, setJobsError] = useState("");
  const [recommended, setRecommended] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  /** When true, main list shows search API results; otherwise ranked recommendations (then feed fallback). */
  const [showingSearchResults, setShowingSearchResults] = useState(false);
  const [locationFilter, setLocationFilter] = useState("");
  const [locationSearchTerms, setLocationSearchTerms] = useState([]);
  const [whereSuggestions, setWhereSuggestions] = useState([]);
  const [whereSuggestOpen, setWhereSuggestOpen] = useState(false);
  const [whereSuggestLoading, setWhereSuggestLoading] = useState(false);
  const whereSuggestDebounceRef = useRef(null);
  const [workModeFilter, setWorkModeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [applications, setApplications] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [openPill, setOpenPill] = useState(null);
  const [workTypeFilter, setWorkTypeFilter] = useState("");
  const [salaryMinK, setSalaryMinK] = useState(0);
  const [salaryMaxK, setSalaryMaxK] = useState(350);
  const [listedFilter, setListedFilter] = useState("");
  const [hiddenJobIds, setHiddenJobIds] = useState(() => new Set());
  const [savedJobIds, setSavedJobIds] = useState(() => loadSavedJobIds());
  const [recentSearches, setRecentSearches] = useState(() => loadRecentSearches());

  const appliedJobIds = useMemo(() => new Set(applications.map((a) => a.job)), [applications]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === LS_SAVED_JOBS || e.key === null) setSavedJobIds(loadSavedJobIds());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    if (!id) return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [location.pathname, location.hash]);

  const loadFeed = useCallback(async () => {
    setJobsError("");
    setLoadingFeed(true);
    try {
      const feed = await api("/api/jobs/feed", { withAuth: false });
      setFeedJobs(Array.isArray(feed) ? feed : []);
    } catch {
      setJobsError("Could not load jobs right now. Please try again.");
      setFeedJobs([]);
    } finally {
      setLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cats = await api("/api/candidates/job-categories/", { withAuth: false });
        if (alive && Array.isArray(cats)) setJobCategories(cats);
      } catch {
        if (alive) setJobCategories([]);
      }
      try {
        const recs = await api("/api/recommendations/jobs-for-candidate");
        if (alive) setRecommended(Array.isArray(recs) ? recs : []);
      } catch {
        if (alive) setRecommended([]);
      } finally {
        if (alive) setLoadingRecs(false);
      }
      try {
        const apps = await api("/api/applications/");
        if (alive) setApplications(Array.isArray(apps) ? apps : []);
      } catch {
        if (alive) setApplications([]);
      }
      await loadFeed();
    })();
    return () => {
      alive = false;
    };
  }, [loadFeed]);

  const jobById = useMemo(() => {
    const m = new Map();
    for (const j of feedJobs) m.set(j.id, j);
    for (const j of searchResults) m.set(j.id, j);
    return m;
  }, [feedJobs, searchResults]);

  const recommendedJobs = useMemo(() => {
    if (!recommended.length) return [];
    return recommended
      .map((r) => {
        const j = jobById.get(r.job_id);
        if (!j) return null;
        return { ...j, _match: r };
      })
      .filter(Boolean)
      .sort((a, b) => (Number(b._match?.score) || 0) - (Number(a._match?.score) || 0));
  }, [recommended, jobById]);

  const salaryFilterActive = salaryMinK > 0 || salaryMaxK < 350;

  useEffect(() => {
    const q = locationFilter.trim();
    if (whereSuggestDebounceRef.current) window.clearTimeout(whereSuggestDebounceRef.current);
    if (q.length < 3) {
      setWhereSuggestions([]);
      setWhereSuggestLoading(false);
      return undefined;
    }
    whereSuggestDebounceRef.current = window.setTimeout(async () => {
      setWhereSuggestLoading(true);
      try {
        const rows = await api(`/api/auth/meta/places?q=${encodeURIComponent(q)}`, { withAuth: false });
        const list = Array.isArray(rows) ? rows : [];
        setWhereSuggestions(list);
        setWhereSuggestOpen(list.length > 0);
      } catch {
        setWhereSuggestions([]);
      } finally {
        setWhereSuggestLoading(false);
      }
    }, 420);
    return () => {
      if (whereSuggestDebounceRef.current) window.clearTimeout(whereSuggestDebounceRef.current);
    };
  }, [locationFilter]);

  const filterJobs = useCallback(
    (jobs) => {
      const wm = workModeFilter;
      const cat = categoryFilter;
      return jobs.filter((j) => {
        if (hiddenJobIds.has(j.id)) return false;
        if (cat && String(j.job_category?.id ?? "") !== cat) return false;
        if (wm && j.work_mode !== wm) return false;
        if (!matchesWorkTypeFilter(j.jd_text, workTypeFilter)) return false;
        if (!matchesListedFilter(j.created_at, listedFilter)) return false;
        if (salaryFilterActive) {
          const pr = parseSalaryRangeK(j.jd_text);
          if (pr && !salaryRangeMatchesUser(pr, salaryMinK, salaryMaxK)) return false;
        }
        return candidateJobMatchesWhere(j, locationFilter, locationSearchTerms);
      });
    },
    [
      locationFilter,
      locationSearchTerms,
      workModeFilter,
      categoryFilter,
      hiddenJobIds,
      workTypeFilter,
      listedFilter,
      salaryFilterActive,
      salaryMinK,
      salaryMaxK,
    ],
  );

  const togglePill = useCallback((id) => {
    setOpenPill(id);
  }, []);

  useEffect(() => {
    if (!openPill) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpenPill(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPill]);

  const displayJobs = useMemo(() => {
    if (showingSearchResults) return filterJobs(searchResults);
    const rec = filterJobs(recommendedJobs);
    if (rec.length > 0) return rec;
    return filterJobs(feedJobs);
  }, [showingSearchResults, searchResults, recommendedJobs, feedJobs, filterJobs]);

  useEffect(() => {
    if (!displayJobs.length) {
      setSelectedJobId(null);
      return;
    }
    if (selectedJobId == null || !displayJobs.some((j) => j.id === selectedJobId)) {
      setSelectedJobId(displayJobs[0].id);
    }
  }, [displayJobs, selectedJobId]);

  const selectedJob = useMemo(
    () => displayJobs.find((j) => j.id === selectedJobId) ?? null,
    [displayJobs, selectedJobId],
  );

  async function runJobSearch() {
    setError("");
    const q = keyword.trim();
    const loc = locationFilter.trim();
    if (!q && !loc && !locationSearchTerms.length) {
      setShowingSearchResults(false);
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("keyword", q);
      if (categoryFilter) params.set("category", categoryFilter);
      if (workModeFilter) params.set("work_mode", workModeFilter);
      if (locationSearchTerms.length) params.set("loc_terms", locationSearchTerms.join(","));
      else if (loc) params.set("location", loc);
      const rows = await api(`/api/jobs/search?${params.toString()}`);
      const list = Array.isArray(rows) ? rows : [];
      setSearchResults(list);
      setShowingSearchResults(true);
      setSelectedJobId(list[0]?.id ?? null);
      if (q) setRecentSearches(pushRecentSearch(q));
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setSearchLoading(false);
    }
  }

  function resetBrowse() {
    setKeyword("");
    setSearchResults([]);
    setShowingSearchResults(false);
    setLocationSearchTerms([]);
    setWhereSuggestions([]);
    setWhereSuggestOpen(false);
    setWorkTypeFilter("");
    setWorkModeFilter("");
    setSalaryMinK(0);
    setSalaryMaxK(350);
    setListedFilter("");
    setOpenPill(null);
    const rec = recommendedJobs.filter((j) => !hiddenJobIds.has(j.id));
    setSelectedJobId(
      rec[0]?.id ?? feedJobs.filter((j) => !hiddenJobIds.has(j.id))[0]?.id ?? null,
    );
  }

  function applyRecentChip(q) {
    setKeyword(q);
    setSearchLoading(true);
    setError("");
    (async () => {
      try {
        const params = new URLSearchParams();
        params.set("keyword", q);
        if (categoryFilter) params.set("category", categoryFilter);
        if (workModeFilter) params.set("work_mode", workModeFilter);
        if (locationSearchTerms.length) params.set("loc_terms", locationSearchTerms.join(","));
        else if (locationFilter.trim()) params.set("location", locationFilter.trim());
        const rows = await api(`/api/jobs/search?${params.toString()}`);
        const list = Array.isArray(rows) ? rows : [];
        setSearchResults(list);
        setShowingSearchResults(true);
        setSelectedJobId(list[0]?.id ?? null);
      } catch (err) {
        setError(String(err.message || err));
      } finally {
        setSearchLoading(false);
      }
    })();
  }

  function toggleSavedJob(jobId) {
    setSavedJobIds((prev) => {
      const id = Number(jobId);
      if (!Number.isInteger(id) || id <= 0) return prev;
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistSavedJobIds(next);
      return next;
    });
  }

  function hideJob(jobId) {
    setHiddenJobIds((prev) => new Set([...prev, jobId]));
  }

  function goApplyToJob(jobId) {
    setError("");
    setStatus("");
    navigate(`/jobs/${jobId}/apply`);
  }

  return (
    <main className="homePage jobsSeekPage">
      <CandidateMemberHeader />

      <section className="jobsSeekHero" aria-label="Job search">
        <div className="heroGlow heroGlowA" />
        <div className="heroGlow heroGlowB" />
        <div className="heroMesh" />
        <div className="jobsSeekHeroInner">
          <p className="heroKicker jobsSeekHeroKicker">Browse roles</p>
          <div className="jobsSeekSearchGrid">
            <div className="jobsSeekFieldBlock">
              <span className="jobsSeekFieldLabel">What</span>
              <div className="jobsSeekWhatRow">
                <input
                  className="jobsSeekInput"
                  placeholder="Job title, skill, or keyword"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runJobSearch()}
                />
                <select
                  className="jobsSeekSelect"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Classification"
                >
                  <option value="">Any classification</option>
                  {jobCategories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="jobsSeekFieldBlock jobsSeekWhereBlock">
              <span className="jobsSeekFieldLabel">Where</span>
              <div className="jobsSeekWhereWrap">
                <input
                  className="jobsSeekInput"
                  id="jobs-seek-where"
                  placeholder="Start typing for place suggestions"
                  value={locationFilter}
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-expanded={whereSuggestOpen}
                  aria-controls={whereSuggestOpen ? "jobs-where-suggest" : undefined}
                  onChange={(e) => {
                    setLocationFilter(e.target.value);
                    setLocationSearchTerms([]);
                  }}
                  onFocus={() => {
                    if (whereSuggestions.length) setWhereSuggestOpen(true);
                  }}
                  onBlur={() => {
                    window.setTimeout(() => setWhereSuggestOpen(false), 160);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runJobSearch();
                  }}
                />
                {whereSuggestLoading ? <span className="jobsSeekWhereSpinner" aria-label="Loading places" /> : null}
                {whereSuggestOpen && whereSuggestions.length > 0 ? (
                  <div
                    id="jobs-where-suggest"
                    className="suggestionBox suggestionBoxElevated jobsSeekWhereSuggest"
                    role="listbox"
                    aria-label="Place suggestions"
                  >
                    {whereSuggestions.map((s, idx) => (
                      <button
                        key={`${s.label}-${idx}`}
                        type="button"
                        role="option"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          const label = s.label || "";
                          const terms =
                            Array.isArray(s.terms) && s.terms.length
                              ? s.terms.map((t) => String(t).toLowerCase())
                              : label
                                  .split(",")
                                  .map((x) => x.trim().toLowerCase())
                                  .filter((x) => x.length >= 2);
                          setLocationFilter(label);
                          setLocationSearchTerms(terms);
                          setWhereSuggestOpen(false);
                          setWhereSuggestions([]);
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="jobsSeekCtaWrap">
              <button type="button" className="jobsSeekCta" onClick={runJobSearch} disabled={searchLoading}>
                {searchLoading ? "…" : "Search"}
              </button>
            </div>
          </div>
          <button
            type="button"
            className={`jobsSeekMoreToggle ${showMoreOptions ? "jobsSeekMoreToggleOpen" : ""}`}
            aria-expanded={showMoreOptions}
            onClick={() => {
              setShowMoreOptions((v) => !v);
              setOpenPill(null);
            }}
          >
            <span>More options</span>
            <span className="jobsSeekMoreChev" aria-hidden />
          </button>
          <div className={`jobsSeekMoreShell ${showMoreOptions ? "jobsSeekMoreShellOpen" : ""}`}>
            <div className="jobsSeekMoreOverflow">
              <div className="jobsSeekMorePanel">
                <div className="jobsSeekFilterPillRow">
                  <JobFilterPill
                    pillId="workType"
                    summary={
                      workTypeFilter === ""
                        ? "All work types"
                        : {
                            fulltime: "Full-time",
                            parttime: "Part-time",
                            casual: "Casual",
                            contract: "Contract",
                          }[workTypeFilter] || "All work types"
                    }
                    isOpen={openPill === "workType"}
                    onToggle={togglePill}
                  >
                    {[
                      { value: "", label: "All work types" },
                      { value: "fulltime", label: "Full-time" },
                      { value: "parttime", label: "Part-time" },
                      { value: "casual", label: "Casual" },
                      { value: "contract", label: "Contract" },
                    ].map((o) => (
                      <JobFilterMenuOption
                        key={o.value || "all"}
                        label={o.label}
                        selected={workTypeFilter === o.value}
                        onPick={() => {
                          setWorkTypeFilter(o.value);
                          setOpenPill(null);
                        }}
                      />
                    ))}
                  </JobFilterPill>
                  <JobFilterPill
                    pillId="remote"
                    summary={
                      workModeFilter === ""
                        ? "All remote options"
                        : {
                            remote: "Fully remote",
                            hybrid: "Hybrid",
                            onsite: "In office",
                          }[workModeFilter] || "All remote options"
                    }
                    isOpen={openPill === "remote"}
                    onToggle={togglePill}
                  >
                    {[
                      { value: "", label: "All remote options" },
                      { value: "remote", label: "Fully remote" },
                      { value: "hybrid", label: "Hybrid" },
                      { value: "onsite", label: "In office" },
                    ].map((o) => (
                      <JobFilterMenuOption
                        key={o.value || "all"}
                        label={o.label}
                        selected={workModeFilter === o.value}
                        onPick={() => {
                          setWorkModeFilter(o.value);
                          setOpenPill(null);
                        }}
                      />
                    ))}
                  </JobFilterPill>
                  <JobFilterPill
                    pillId="salaryMin"
                    summary={`Paying ${formatSalaryPillLabel(salaryMinK)}`}
                    isOpen={openPill === "salaryMin"}
                    onToggle={togglePill}
                  >
                    {SALARY_STEPS_K.filter((k) => k < 350).map((k) => (
                      <JobFilterMenuOption
                        key={k}
                        label={`From ${formatSalaryPillLabel(k)}`}
                        selected={salaryMinK === k}
                        onPick={() => {
                          setSalaryMinK(k);
                          if (k > salaryMaxK) setSalaryMaxK(Math.min(350, k));
                          setOpenPill(null);
                        }}
                      />
                    ))}
                  </JobFilterPill>
                  <JobFilterPill
                    pillId="salaryMax"
                    summary={
                      salaryMaxK >= 350 ? "To $350K+" : `To ${formatSalaryPillLabel(salaryMaxK)}`
                    }
                    isOpen={openPill === "salaryMax"}
                    onToggle={togglePill}
                  >
                    {SALARY_STEPS_K.filter((k) => k > 0).map((k) => (
                      <JobFilterMenuOption
                        key={k}
                        label={k >= 350 ? "Up to $350K+" : `Up to ${formatSalaryPillLabel(k)}`}
                        selected={salaryMaxK === k}
                        onPick={() => {
                          setSalaryMaxK(k);
                          if (k < salaryMinK) setSalaryMinK(Math.max(0, k));
                          setOpenPill(null);
                        }}
                      />
                    ))}
                  </JobFilterPill>
                  <JobFilterPill
                    pillId="listed"
                    summary={
                      listedFilter === ""
                        ? "Listed any time"
                        : {
                            "1": "Listed: 24 hours",
                            "3": "Listed: 3 days",
                            "7": "Listed: 7 days",
                            "14": "Listed: 14 days",
                            "30": "Listed: 30 days",
                          }[listedFilter] || "Listed any time"
                    }
                    isOpen={openPill === "listed"}
                    onToggle={togglePill}
                  >
                    {[
                      { value: "", label: "Listed any time" },
                      { value: "1", label: "Last 24 hours" },
                      { value: "3", label: "Last 3 days" },
                      { value: "7", label: "Last 7 days" },
                      { value: "14", label: "Last 14 days" },
                      { value: "30", label: "Last 30 days" },
                    ].map((o) => (
                      <JobFilterMenuOption
                        key={o.value || "any"}
                        label={o.label}
                        selected={listedFilter === o.value}
                        onPick={() => {
                          setListedFilter(o.value);
                          setOpenPill(null);
                        }}
                      />
                    ))}
                  </JobFilterPill>
                </div>
                <p className="jobsSeekFilterHint">
                  Pay filters use numbers mentioned in the listing text when we can detect them.
                </p>
                <button type="button" className="jobsSeekLinkBtn jobsSeekMoreRefresh" onClick={loadFeed} disabled={loadingFeed}>
                  {loadingFeed ? "Refreshing…" : "Refresh list"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {recentSearches.length > 0 && (
        <div id="saved-searches" className="jobsSeekRecentBar candidateScrollAnchor" tabIndex={-1}>
          <div className="jobsSeekRecentInner">
            {recentSearches.map((q) => (
              <button key={q} type="button" className="jobsSeekRecentChip" onClick={() => applyRecentChip(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {status && <p className="success jobsSeekFlash">{status}</p>}
      {error && <p className="error jobsSeekFlash">{error}</p>}
      {jobsError && <p className="error jobsSeekFlash">{jobsError}</p>}

      <div className="jobsSeekBody">
        <div className="jobsSeekMain">
          <div className="jobsSeekListHeaderRow">
            <p className="jobsSeekListMeta">
              {loadingFeed && !showingSearchResults && !recommendedJobs.length
                ? "Loading…"
                : showingSearchResults
                  ? `${displayJobs.length} search result${displayJobs.length === 1 ? "" : "s"}`
                  : `${displayJobs.length} role${displayJobs.length === 1 ? "" : "s"} ranked for you`}
              {!showingSearchResults && loadingRecs ? " · Updating match scores" : ""}
            </p>
            {showingSearchResults ? (
              <button type="button" className="jobsSeekLinkBtn jobsSeekListClearBtn" onClick={resetBrowse}>
                Back to recommendations
              </button>
            ) : null}
          </div>

          <ul className="jobsSeekCardList">
            {!loadingFeed && displayJobs.length === 0 && (
              <li className="jobsSeekEmpty">
                {showingSearchResults
                  ? "No jobs match that search. Try different keywords or filters."
                  : "No ranked roles yet. Add skills on your profile to improve matches — or check back when more employers post."}
              </li>
            )}
            {displayJobs.map((j) => {
              const active = j.id === selectedJobId;
              const pct = j._match ? matchScorePercent(j._match.score) : null;
              const saved = savedJobIds.has(j.id);
              const paySummary = formatCompensationSummary(j);
              return (
                <li key={j.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    className={`jobsSeekCard ${active ? "jobsSeekCardActive" : ""}`}
                    onClick={() => setSelectedJobId(j.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedJobId(j.id);
                      }
                    }}
                  >
                    <div className="jobsSeekCardTop">
                      <div className="jobsSeekCardText">
                        <h3 className="jobsSeekCardTitle">
                          <Link
                            className="jobsSeekCardTitleLink"
                            to={`/jobs/${j.id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {j.title}
                          </Link>
                        </h3>
                        <p className="jobsSeekCardCompany">{j.company_info || "Employer"}</p>
                        <div className="jobsSeekCardBadges">
                          {j._match && <span className="jobsSeekBadge jobsSeekBadgeRec">For you</span>}
                          {!j._match && isRecentlyPosted(j.created_at) && (
                            <span className="jobsSeekBadge jobsSeekBadgeNew">New</span>
                          )}
                          {appliedJobIds.has(j.id) && <span className="jobsSeekBadge jobsSeekBadgeApp">Applied</span>}
                        </div>
                        <ul className="jobsSeekCardFacts">
                          <li>{formatWorkModeLabel(j.work_mode)}</li>
                          <li>{j.location || "Location in description"}</li>
                          <li>
                            {j.required_experience != null && Number(j.required_experience) > 0
                              ? `Often ~${j.required_experience} yrs experience`
                              : "Experience in listing"}
                          </li>
                          {paySummary ? <li>{paySummary}</li> : null}
                          {pct != null && <li>{pct}% profile alignment</li>}
                        </ul>
                      </div>
                      <div className="jobsSeekCardLogo" aria-hidden="true">
                        {companyAvatarLetter(j.company_info, j.title)}
                      </div>
                    </div>
                    <div className="jobsSeekCardBottom">
                      <span className="jobsSeekCardPosted">{j.created_at ? formatPostedShort(j.created_at) : ""}</span>
                      <div className="jobsSeekCardActions">
                        <button
                          type="button"
                          className={`jobsSeekBookmarkBtn jobsSeekBookmarkBtn--compact ${saved ? "jobsSeekBookmarkBtn--saved" : ""}`}
                          title={saved ? "Remove from saved" : "Save job"}
                          aria-label={saved ? "Remove from saved" : "Save job"}
                          aria-pressed={saved}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSavedJob(j.id);
                          }}
                        >
                          <svg className="jobsSeekBookmarkSvg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                            {saved ? (
                              <path
                                d="M6 2.75h12c.55 0 1 .45 1 1v17.45c0 .72-.78 1.17-1.4.8L12 16.35l-5.6 4.65c-.62.37-1.4-.08-1.4-.8V3.75c0-.55.45-1 1-1Z"
                                fill="currentColor"
                              />
                            ) : (
                              <path
                                d="M6 2.75h12c.55 0 1 .45 1 1v17.45c0 .72-.78 1.17-1.4.8L12 16.35l-5.6 4.65c-.62.37-1.4-.08-1.4-.8V3.75c0-.55.45-1 1-1Z"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.65"
                                strokeLinejoin="round"
                              />
                            )}
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="jobsSeekIconBtn"
                          title="Hide this job"
                          aria-label="Hide this job"
                          onClick={(e) => {
                            e.stopPropagation();
                            hideJob(j.id);
                          }}
                        >
                          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                            <path
                              d="M6.3 5.7 18.2 17.6l-1.1 1.1L14 15.6c-1.2.7-2.5 1-4 1-4 0-7.2-3-8.5-4.5a1 1 0 0 1 0-1.3c.5-.6 1.3-1.4 2.2-2.1L5.2 6.8 6.3 5.7Zm3.4 3.4-1.9 1.9c-.7.5-1.3 1-1.7 1.4.9.8 2.8 2.3 5 2.3 1 0 1.9-.2 2.7-.5l-2-2c-.3.1-.6.2-1 .2a2.5 2.5 0 0 1-2.1-3.3Zm4.5-.5 2 2c.2-.5.3-1 .3-1.5a2.5 2.5 0 0 0-2.3-2.5Zm6.5 4.9c.5.4.9.8 1.2 1.1a1 1 0 0 1 0 1.3C19.2 17.4 16 20 12 20c-1.5 0-2.8-.3-4-.9l-1.6 1.6-1.1-1.1L17.9 6.8l1.1 1.1ZM13.5 12l-1.5 1.5c.2.1.4.2.7.2.8 0 1.5-.7 1.5-1.5 0-.3-.1-.5-.2-.7Z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="jobsSeekAside jobsSeekAsideJobsOnly">
          {selectedJob ? (
            <JobPostingDetailPanel
              job={selectedJob}
              matchInfo={selectedJob._match}
              hasApplied={appliedJobIds.has(selectedJob.id)}
              onApply={() => goApplyToJob(selectedJob.id)}
              showFullPageLink
              bookmarkSaved={savedJobIds.has(selectedJob.id)}
              onBookmarkToggle={() => toggleSavedJob(selectedJob.id)}
            />
          ) : (
            <div className="jobsSeekAsideCard jobsSeekAsideMuted">
              <p className="jobsSeekAsideText">Select a job from the list to see the full description and apply.</p>
            </div>
          )}
        </aside>
      </div>

      <footer className="jobsSeekFooter">
        © {new Date().getFullYear()} SkillMesh · {user?.email}
      </footer>
    </main>
  );
}

function CandidateDashboard() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const skillSuggestRef = useRef(null);

  const emptyEduRow = () => ({
    institution: "",
    degree: "",
    field_of_study: "",
    major: "",
    description: "",
    start_date: "",
    end_date: "",
    is_current: false,
    sort_order: 0,
  });
  const emptyWorkRow = () => ({
    job_title: "",
    company_name: "",
    description: "",
    start_date: "",
    end_date: "",
    is_current: false,
    sort_order: 0,
  });

  const [profile, setProfile] = useState({
    full_name: "",
    contact: "",
    date_of_birth: "",
    postcode: "",
    country: "",
    mobile_number: "",
    education_level: "",
    major: "",
    headline: "",
    linkedin_url: "",
    portfolio_url: "",
    availability: "",
    location: "",
    preferred_mode: "",
    summary: "",
    skills: [],
  });
  const [categoryIds, setCategoryIds] = useState([]);
  const [jobCategories, setJobCategories] = useState([]);
  const [eduRows, setEduRows] = useState([emptyEduRow()]);
  const [workRows, setWorkRows] = useState([emptyWorkRow(), emptyWorkRow()]);

  const [skillInput, setSkillInput] = useState("");
  const [skillSuggestions, setSkillSuggestions] = useState([]);
  const [resumeList, setResumeList] = useState([]);
  const [renameDraft, setRenameDraft] = useState({});
  const [dragActive, setDragActive] = useState(false);

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumePreview, setResumePreview] = useState(null);
  const [savedJobsCount, setSavedJobsCount] = useState(() => loadSavedJobIds().size);

  useEffect(() => {
    const bump = () => setSavedJobsCount(loadSavedJobIds().size);
    const onStorage = (e) => {
      if (e.key === LS_SAVED_JOBS || e.key === null) bump();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    return () => {
      if (resumePreview?.blobUrl) {
        URL.revokeObjectURL(resumePreview.blobUrl);
      }
    };
  }, [resumePreview]);

  function hydrateFromProfile(data) {
    if (!data?.id) return;
    setProfile(data);
    setCategoryIds((data.preferred_job_categories || []).map((c) => c.id));
    const edu = data.education_entries;
    if (Array.isArray(edu) && edu.length > 0) {
      setEduRows(
        edu.map((r, idx) => ({
          ...r,
          is_current: !!r.is_current,
          start_date: r.start_date ? String(r.start_date).slice(0, 10) : "",
          end_date: r.end_date ? String(r.end_date).slice(0, 10) : "",
          sort_order: idx,
        })),
      );
    } else {
      setEduRows([{ ...emptyEduRow(), sort_order: 0 }]);
    }
    const wx = data.work_experiences;
    if (Array.isArray(wx) && wx.length > 0) {
      setWorkRows(
        wx.map((r, idx) => ({
          ...r,
          is_current: !!r.is_current,
          start_date: r.start_date ? String(r.start_date).slice(0, 10) : "",
          end_date: r.end_date ? String(r.end_date).slice(0, 10) : "",
          sort_order: idx,
        })),
      );
    } else {
      setWorkRows([
        { ...emptyWorkRow(), sort_order: 0 },
        { ...emptyWorkRow(), sort_order: 1 },
      ]);
    }
  }

  const profileStrength = useMemo(() => {
    const p = profile;
    let n = 0;
    const checks = [
      (p.full_name || "").trim(),
      (p.headline || "").trim() || (p.major || "").trim(),
      (p.contact || "").trim() || (p.mobile_number || "").trim(),
      (p.location || "").trim(),
      (p.summary || "").trim().length > 24,
      (p.skills || []).length > 0,
      (p.preferred_mode || "").trim(),
      categoryIds.length > 0,
    ];
    for (const c of checks) if (c) n += 1;
    return Math.round((n / checks.length) * 100);
  }, [profile, categoryIds]);

  async function fetchResumes() {
    try {
      const rows = await api("/api/candidates/resume/");
      const list = Array.isArray(rows) ? rows : [];
      setResumeList(list);
      const d = {};
      list.forEach((r) => {
        d[r.id] = r.display_name || "";
      });
      setRenameDraft(d);
    } catch {
      setResumeList([]);
      setRenameDraft({});
    }
  }

  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    (async () => {
      try {
        const data = await api("/api/candidates/profile");
        if (alive && data?.id) hydrateFromProfile(data);
      } catch {
        /* no profile yet */
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cats = await api("/api/candidates/job-categories/", { withAuth: false });
        if (alive) setJobCategories(Array.isArray(cats) ? cats : []);
      } catch {
        if (alive) setJobCategories([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchResumes();
  }, [user]);

  useEffect(() => {
    const t = skillInput.trim();
    if (t.length < 2) {
      setSkillSuggestions([]);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const rows = await api(`/api/candidates/skills/suggest/?q=${encodeURIComponent(t)}`);
        setSkillSuggestions(Array.isArray(rows) ? rows : []);
      } catch {
        setSkillSuggestions([]);
      }
    }, 200);
    return () => clearTimeout(id);
  }, [skillInput]);

  useEffect(() => {
    function onDocDown(e) {
      if (!skillSuggestRef.current?.contains(e.target)) setSkillSuggestions([]);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  async function flushResumeRenames() {
    let any = false;
    for (const r of resumeList) {
      const next = (renameDraft[r.id] ?? "").trim();
      const prevName = (r.display_name || "").trim();
      if (next === prevName) continue;
      any = true;
      const stem = (r.stored_filename || "resume").replace(/\.[^.]+$/, "");
      await api(`/api/candidates/resume/${r.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ display_name: next || stem || "Resume" }),
      });
    }
    if (any) await fetchResumes();
  }

  async function saveProfile() {
    setError("");
    setStatus("");
    setSavingProfile(true);
    try {
      await flushResumeRenames();

      const profilePayload = {
        full_name: profile.full_name,
        contact: profile.contact,
        date_of_birth: profile.date_of_birth || null,
        postcode: profile.postcode,
        country: profile.country,
        mobile_number: profile.mobile_number,
        education_level: profile.education_level,
        major: profile.major,
        headline: profile.headline,
        linkedin_url: profile.linkedin_url,
        portfolio_url: profile.portfolio_url,
        availability: profile.availability,
        location: profile.location,
        preferred_mode: profile.preferred_mode,
        summary: profile.summary,
        onboarding_step: profile.onboarding_step,
        skills: profile.skills || [],
        preferred_job_category_ids: categoryIds,
      };

      const eduPayload = eduRows
        .filter((r) => {
          const parts = [r.institution, r.degree, r.field_of_study, r.major, r.description].map((x) => String(x || "").trim());
          return parts.some(Boolean);
        })
        .map((r, idx) => ({
          institution: String(r.institution || "").trim(),
          degree: String(r.degree || "").trim(),
          field_of_study: String(r.field_of_study || "").trim(),
          major: String(r.major || "").trim(),
          description: String(r.description || "").trim(),
          start_date: r.start_date || null,
          end_date: r.is_current ? null : (r.end_date || null),
          is_current: !!r.is_current,
          sort_order: idx,
        }));

      const workPayload = workRows
        .filter((r) => r.job_title.trim())
        .map((r, idx) => ({
          job_title: r.job_title.trim(),
          company_name: String(r.company_name || "").trim(),
          description: String(r.description || "").trim(),
          start_date: r.start_date || null,
          end_date: r.is_current ? null : (r.end_date || null),
          is_current: !!r.is_current,
          sort_order: idx,
        }));

      const refreshed = await api("/api/candidates/profile/bundle/", {
        method: "PUT",
        body: JSON.stringify({
          profile: profilePayload,
          education_entries: eduPayload,
          work_experiences: workPayload,
        }),
      });
      hydrateFromProfile(refreshed);
      await fetchResumes();
      setStatus("Changes saved.");
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadResumeBatch(fileList) {
    const files = Array.from(fileList || []).filter((f) => f && f.size > 0);
    if (!files.length) return;
    setError("");
    setStatus("");
    setUploadingResume(true);
    try {
      for (let i = 0; i < files.length; i += 1) {
        const f = files[i];
        const fd = new FormData();
        fd.append("file", f);
        const stem = f.name.replace(/\.[^.]+$/, "") || "Resume";
        fd.append("display_name", stem.slice(0, 255));
        await api("/api/candidates/resume/upload", { method: "POST", body: fd });
      }
      setStatus(files.length > 1 ? `${files.length} resumes uploaded and parsed.` : "Resume uploaded and parsed.");
      await fetchResumes();
      const refreshed = await api("/api/candidates/profile");
      hydrateFromProfile(refreshed);
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setUploadingResume(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function onDropZoneDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    uploadResumeBatch(e.dataTransfer?.files);
  }

  function addSkill(value) {
    const v = (value || "").trim();
    if (!v) return;
    const lower = v.toLowerCase();
    setProfile((prev) => {
      if ((prev.skills || []).some((s) => (s.skill_name || "").toLowerCase() === lower)) return prev;
      return { ...prev, skills: [...(prev.skills || []), { skill_name: v, level: 1 }] };
    });
    setSkillInput("");
    setSkillSuggestions([]);
  }

  function removeSkill(index) {
    setProfile((prev) => ({
      ...prev,
      skills: (prev.skills || []).filter((_, i) => i !== index),
    }));
  }

  function toggleCategory(id) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function updateEduRow(index, patch) {
    setEduRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addEduRow() {
    setEduRows((prev) => [...prev, { ...emptyEduRow(), sort_order: prev.length }]);
  }

  function removeEduRow(index) {
    setEduRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, sort_order: i }))));
  }

  function updateWorkRow(index, patch) {
    setWorkRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addWorkRow() {
    setWorkRows((prev) => [...prev, { ...emptyWorkRow(), sort_order: prev.length }]);
  }

  function removeWorkRow(index) {
    setWorkRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, sort_order: i }))));
  }

  async function deleteResume(id) {
    if (!window.confirm("Remove this resume from your profile?")) return;
    try {
      await api(`/api/candidates/resume/${id}/`, { method: "DELETE" });
      setStatus("Resume removed.");
      await fetchResumes();
    } catch (err) {
      setError(String(err.message || err));
    }
  }

  function closeResumePreview() {
    setResumePreview(null);
  }

  async function openResumePreviewModal(resumeId, titleHint, storedFilename) {
    setError("");
    try {
      const blob = await apiBlob(`/api/candidates/resume/${resumeId}/download/`);
      const blobUrl = URL.createObjectURL(blob);
      const name = (titleHint || "").trim() || storedFilename || "Resume";
      const isImage =
        blob.type.startsWith("image/")
        || /\.(png|jpg|jpeg|webp)$/i.test(storedFilename || "");
      setResumePreview({ name, blobUrl, isImage });
    } catch (err) {
      setError(String(err.message || err) || "Could not open resume.");
    }
  }

  const greetingName = ((user?.first_name || "").trim()
    || (profile.full_name || "").trim().split(/\s+/)[0]
    || "there");

  return (
    <main className="homePage jobsSeekPage candidateDashboardPage">
      <CandidateMemberHeader />

      <section className="jobsSeekHero candidateDashHero" aria-label="Dashboard">
        <div className="heroGlow heroGlowA" />
        <div className="heroGlow heroGlowB" />
        <div className="heroMesh" />
        <div className="jobsSeekHeroInner candidateDashHeroInner">
          <div className="candidateDashHeroText">
            <p className="heroKicker jobsSeekHeroKicker">Your profile</p>
            <h1 className="candidateDashTitle">Hi, {greetingName}</h1>
            <p className="candidateDashLead muted">
              Keep details, skills, and resumes current so employers and SkillMesh can match you accurately.
            </p>
          </div>
          <div className="candidateDashHeroActions">
            <Link className="jobsSeekCta candidateDashBrowseCta" to="/">
              Browse jobs
            </Link>
            <Link className="candidateDashSavedJobsBtn" to="/candidate/saved-jobs">
              <span className="candidateDashSavedJobsBtnLabel">Saved jobs</span>
              {savedJobsCount > 0 ? (
                <span className="candidateDashSavedJobsCount" aria-label={`${savedJobsCount} saved`}>
                  {savedJobsCount}
                </span>
              ) : null}
            </Link>
          </div>
        </div>
      </section>

      <div className="candidateDashFlash">
        {status && <p className="candidateDashBanner candidateDashBannerSuccess">{status}</p>}
        {error && <p className="candidateDashBanner candidateDashBannerError">{error}</p>}
      </div>

      <div className="candidateDashLayout candidateDashLayoutSolo">
        <div className="candidateDashMain">
          <article className="candidateDashCard candidateDashCardProfile" aria-labelledby="dash-profile-heading">
            <div className="candidateDashProfileHead">
              <div>
                <h2 id="dash-profile-heading" className="candidateDashCardTitle">
                  Profile
                </h2>
                <p className="candidateDashCardHint candidateDashCardHintTight">
                  Information employers see in search and when you apply.
                </p>
              </div>
              <div className="candidateDashStrengthMini" aria-label={`Profile ${profileStrength} percent complete`}>
                <div className="candidateDashStrengthRing" style={{ "--p": profileStrength }}>
                  <span>{profileStrength}%</span>
                </div>
              </div>
            </div>

            <div className="candidateDashFormGrid">
              <div className="jobsSeekFieldBlock candidateDashSpan2">
                <span className="jobsSeekFieldLabel">Headline</span>
                <input
                  className="jobsSeekInput"
                  placeholder="e.g. Final-year CS student · Seeking graduate software role"
                  value={profile.headline || ""}
                  onChange={(e) => setProfile({ ...profile, headline: e.target.value })}
                />
              </div>
              <div className="jobsSeekFieldBlock">
                <span className="jobsSeekFieldLabel">Full name</span>
                <input
                  className="jobsSeekInput"
                  placeholder="Your name"
                  value={profile.full_name || ""}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                />
              </div>
              <div className="jobsSeekFieldBlock candidateDashDobField">
                <SiteDatePicker
                  variant="dob"
                  label="Date of birth"
                  value={profile.date_of_birth || ""}
                  onChange={(v) => setProfile({ ...profile, date_of_birth: v })}
                />
              </div>
              <div className="jobsSeekFieldBlock">
                <span className="jobsSeekFieldLabel">Mobile</span>
                <input
                  className="jobsSeekInput"
                  placeholder="Phone"
                  value={profile.mobile_number || ""}
                  onChange={(e) => setProfile({ ...profile, mobile_number: e.target.value })}
                />
              </div>
              <div className="jobsSeekFieldBlock">
                <span className="jobsSeekFieldLabel">Contact / email alt</span>
                <input
                  className="jobsSeekInput"
                  placeholder="Other contact"
                  value={profile.contact || ""}
                  onChange={(e) => setProfile({ ...profile, contact: e.target.value })}
                />
              </div>
              <div className="jobsSeekFieldBlock">
                <span className="jobsSeekFieldLabel">Location</span>
                <input
                  className="jobsSeekInput"
                  placeholder="City or region"
                  value={profile.location || ""}
                  onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                />
              </div>
              <div className="jobsSeekFieldBlock">
                <span className="jobsSeekFieldLabel">Availability</span>
                <select
                  className="jobsSeekSelect"
                  value={profile.availability || ""}
                  onChange={(e) => setProfile({ ...profile, availability: e.target.value })}
                >
                  <option value="">Select…</option>
                  <option value="immediate">Immediately</option>
                  <option value="2_weeks">Within 2 weeks</option>
                  <option value="1_month">Within 1 month</option>
                  <option value="internship">Internship period only</option>
                  <option value="not_looking">Not actively looking</option>
                </select>
              </div>
              <div className="jobsSeekFieldBlock">
                <span className="jobsSeekFieldLabel">Postcode</span>
                <input
                  className="jobsSeekInput"
                  value={profile.postcode || ""}
                  onChange={(e) => setProfile({ ...profile, postcode: e.target.value })}
                />
              </div>
              <div className="jobsSeekFieldBlock">
                <span className="jobsSeekFieldLabel">Country</span>
                <input
                  className="jobsSeekInput"
                  value={profile.country || ""}
                  onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                />
              </div>
              <div className="jobsSeekFieldBlock">
                <span className="jobsSeekFieldLabel">Education level</span>
                <input
                  className="jobsSeekInput"
                  placeholder="e.g. Bachelor"
                  value={profile.education_level || ""}
                  onChange={(e) => setProfile({ ...profile, education_level: e.target.value })}
                />
              </div>
              <div className="jobsSeekFieldBlock">
                <span className="jobsSeekFieldLabel">Major / field</span>
                <input
                  className="jobsSeekInput"
                  placeholder="e.g. Computer Science"
                  value={profile.major || ""}
                  onChange={(e) => setProfile({ ...profile, major: e.target.value })}
                />
              </div>
              <div className="jobsSeekFieldBlock">
                <span className="jobsSeekFieldLabel">LinkedIn</span>
                <input
                  className="jobsSeekInput"
                  type="url"
                  placeholder="https://linkedin.com/in/…"
                  value={profile.linkedin_url || ""}
                  onChange={(e) => setProfile({ ...profile, linkedin_url: e.target.value })}
                />
              </div>
              <div className="jobsSeekFieldBlock">
                <span className="jobsSeekFieldLabel">Portfolio / GitHub</span>
                <input
                  className="jobsSeekInput"
                  type="url"
                  placeholder="https://…"
                  value={profile.portfolio_url || ""}
                  onChange={(e) => setProfile({ ...profile, portfolio_url: e.target.value })}
                />
              </div>
              <div className="jobsSeekFieldBlock candidateDashSpan2">
                <span className="jobsSeekFieldLabel">Preferred work mode</span>
                <select
                  className="jobsSeekSelect"
                  value={profile.preferred_mode || ""}
                  onChange={(e) => setProfile({ ...profile, preferred_mode: e.target.value })}
                >
                  <option value="">Select…</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                </select>
              </div>
              <div className="jobsSeekFieldBlock candidateDashSpan2">
                <span className="jobsSeekFieldLabel">Professional summary</span>
                <textarea
                  className="jobsSeekInput candidateDashTextarea"
                  rows={4}
                  placeholder="Short overview for employers…"
                  value={profile.summary || ""}
                  onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
                />
              </div>
            </div>

            <h3 className="candidateDashSubheading">Preferred job categories</h3>
            <p className="candidateDashCardHint candidateDashCardHintTight">
              Matching jobs appear first on your home feed; we also use this for future recommendations.
            </p>
            <div className="candidateDashCategoryGrid">
              {jobCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`candidateDashCatPill ${categoryIds.includes(c.id) ? "candidateDashCatPillOn" : ""}`}
                  onClick={() => toggleCategory(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <h3 className="candidateDashSubheading">Skills</h3>
            <p className="candidateDashCardHint candidateDashCardHintTight">Suggestions combine job data, the ESCO skill API, and common tags.</p>
            <div className="candidateDashSkillWrap" ref={skillSuggestRef}>
              <div className="candidateDashSkillRow">
                <input
                  className="jobsSeekInput"
                  placeholder="Start typing a skill…"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill(skillInput);
                    }
                  }}
                  autoComplete="off"
                />
                <button type="button" className="modernBtn candidateDashSkillAdd" onClick={() => addSkill(skillInput)}>
                  Add
                </button>
              </div>
              {skillSuggestions.length > 0 && (
                <ul className="candidateDashSuggestList" role="listbox">
                  {skillSuggestions.map((s) => (
                    <li key={s.skill_name}>
                      <button type="button" className="candidateDashSuggestItem" onClick={() => addSkill(s.skill_name)}>
                        {s.skill_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="jobsSeekChipRow candidateDashChipRow">
              {(profile.skills || []).map((s, i) => (
                <span className="candidateDashSkillChip" key={`${s.skill_name}-${i}`}>
                  {s.skill_name}
                  <button type="button" className="candidateDashSkillRemove" onClick={() => removeSkill(i)} aria-label={`Remove ${s.skill_name}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>

            <h3 className="candidateDashSubheading">Education</h3>
            <p className="candidateDashCardHint candidateDashCardHintTight">Same fields as onboarding — edits here update the same record.</p>
            {eduRows.map((row, index) => (
              <div className="candidateDashMiniCard" key={`dash-edu-${index}`}>
                <div className="candidateDashFormGrid">
                  <div className="jobsSeekFieldBlock">
                    <span className="jobsSeekFieldLabel">Institution</span>
                    <input className="jobsSeekInput" placeholder="Institution" value={row.institution || ""} onChange={(e) => updateEduRow(index, { institution: e.target.value })} />
                  </div>
                  <div className="jobsSeekFieldBlock">
                    <span className="jobsSeekFieldLabel">Degree</span>
                    <input className="jobsSeekInput" placeholder="e.g. Bachelor of Science" value={row.degree || ""} onChange={(e) => updateEduRow(index, { degree: e.target.value })} />
                  </div>
                  <div className="jobsSeekFieldBlock">
                    <span className="jobsSeekFieldLabel">Field of study</span>
                    <input className="jobsSeekInput" value={row.field_of_study || ""} onChange={(e) => updateEduRow(index, { field_of_study: e.target.value })} />
                  </div>
                  <div className="jobsSeekFieldBlock">
                    <span className="jobsSeekFieldLabel">Major</span>
                    <input className="jobsSeekInput" value={row.major || ""} onChange={(e) => updateEduRow(index, { major: e.target.value })} />
                  </div>
                </div>
                <textarea
                  className="jobsSeekInput candidateDashTextarea candidateDashTextareaSm"
                  rows={2}
                  placeholder="Honours, coursework, or other details"
                  value={row.description || ""}
                  onChange={(e) => updateEduRow(index, { description: e.target.value })}
                />
                <div className="candidateDashFormGrid">
                  <div className="jobsSeekFieldBlock">
                    <SiteDatePicker label="Start" value={row.start_date || ""} onChange={(v) => updateEduRow(index, { start_date: v })} />
                  </div>
                  <div className="jobsSeekFieldBlock">
                    {!row.is_current ? (
                      <SiteDatePicker label="End" value={row.end_date || ""} onChange={(v) => updateEduRow(index, { end_date: v })} />
                    ) : (
                      <div className="presentNowTag">Currently studying</div>
                    )}
                  </div>
                </div>
                <div className="candidateDashMiniActions candidateDashMiniActionsRow">
                  <label className="checkLine">
                    <input
                      type="checkbox"
                      checked={!!row.is_current}
                      onChange={(e) => updateEduRow(index, { is_current: e.target.checked, end_date: e.target.checked ? "" : row.end_date })}
                    />
                    I am currently enrolled
                  </label>
                  {eduRows.length > 1 && (
                    <button type="button" className="btnGhost candidateDashMiniBtn" onClick={() => removeEduRow(index)}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button type="button" className="candidateDashTextBtn" onClick={addEduRow}>
              + Add education
            </button>

            <h3 className="candidateDashSubheading">Work experience</h3>
            <p className="candidateDashCardHint candidateDashCardHintTight">Same fields as onboarding — include dates for a complete profile.</p>
            {workRows.map((row, index) => (
              <div className="candidateDashMiniCard" key={`dash-work-${index}`}>
                <div className="candidateDashFormGrid">
                  <div className="jobsSeekFieldBlock">
                    <span className="jobsSeekFieldLabel">Role</span>
                    <input className="jobsSeekInput" placeholder="Job role" value={row.job_title || ""} onChange={(e) => updateWorkRow(index, { job_title: e.target.value })} />
                  </div>
                  <div className="jobsSeekFieldBlock">
                    <span className="jobsSeekFieldLabel">Company</span>
                    <input className="jobsSeekInput" placeholder="Company name" value={row.company_name || ""} onChange={(e) => updateWorkRow(index, { company_name: e.target.value })} />
                  </div>
                </div>
                <textarea
                  className="jobsSeekInput candidateDashTextarea candidateDashTextareaSm"
                  rows={3}
                  placeholder="Job description"
                  value={row.description || ""}
                  onChange={(e) => updateWorkRow(index, { description: e.target.value })}
                />
                <div className="candidateDashFormGrid">
                  <div className="jobsSeekFieldBlock">
                    <SiteDatePicker label="Start date" value={row.start_date || ""} onChange={(v) => updateWorkRow(index, { start_date: v })} />
                  </div>
                  <div className="jobsSeekFieldBlock">
                    {!row.is_current ? (
                      <SiteDatePicker label="End date" value={row.end_date || ""} onChange={(v) => updateWorkRow(index, { end_date: v })} />
                    ) : (
                      <div className="presentNowTag">Present role</div>
                    )}
                  </div>
                </div>
                <div className="candidateDashMiniActions candidateDashMiniActionsRow">
                  <label className="checkLine">
                    <input
                      type="checkbox"
                      checked={!!row.is_current}
                      onChange={(e) => updateWorkRow(index, { is_current: e.target.checked, end_date: e.target.checked ? "" : row.end_date })}
                    />
                    I currently work here
                  </label>
                  {workRows.length > 1 && (
                    <button type="button" className="btnGhost candidateDashMiniBtn" onClick={() => removeWorkRow(index)}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="candidateDashSaveRow">
              <button type="button" className="candidateDashTextBtn candidateDashTextBtnInline" onClick={addWorkRow}>
                + Add role
              </button>
            </div>
          </article>

          <article className="candidateDashCard" aria-labelledby="dash-resume-heading">
            <h2 id="dash-resume-heading" className="candidateDashCardTitle">
              Resumes
            </h2>
            <p className="candidateDashCardHint">
              Use <strong>Save changes</strong> below to save your profile, experience, and resume display names together. After each upload, set the name in the list. Uploads are parsed to refresh skills—drag files in or click to upload.
            </p>
            <div
              className={`candidateDashDropzone ${dragActive ? "candidateDashDropzoneActive" : ""}`}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDropZoneDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="candidateDashDropInput"
                accept=".pdf,.docx,.jpg,.jpeg,.png"
                multiple
                onChange={(e) => uploadResumeBatch(e.target.files)}
              />
              <div className="candidateDashDropzoneInner">
                <span className="candidateDashDropTitle">{uploadingResume ? "Uploading…" : "Drop files here or click to upload"}</span>
                <span className="candidateDashDropMeta">PDF, DOCX, or images · multiple files OK</span>
              </div>
            </div>

            {resumeList.length > 0 && (
              <ul className="candidateDashResumeList">
                {resumeList.map((r) => (
                  <li key={r.id} className="candidateDashResumeItem">
                    <div className="candidateDashResumeMain">
                      <input
                        className="jobsSeekInput candidateDashResumeNameInput"
                        value={renameDraft[r.id] ?? ""}
                        onChange={(e) => setRenameDraft((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        aria-label="Resume display name"
                      />
                      <span className="candidateDashResumeFile">{r.stored_filename}</span>
                      <span className="candidateDashResumeDate">{r.created_at ? String(r.created_at).slice(0, 10) : ""}</span>
                    </div>
                    <div className="candidateDashResumeActions">
                      <button
                        type="button"
                        className="candidateDashResumeOpenBtn"
                        onClick={() => openResumePreviewModal(r.id, renameDraft[r.id] ?? r.display_name, r.stored_filename)}
                      >
                        Open
                      </button>
                      <button type="button" className="candidateDashResumeDanger" onClick={() => deleteResume(r.id)}>
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="candidateDashSaveRow candidateDashSaveRowAfterResume">
              <button type="button" className="modernBtn jobsSeekCta candidateDashSave" onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save changes"}
              </button>
            </div>
          </article>
        </div>
      </div>

      {resumePreview && (
        <div className="resumeOverlay" onClick={closeResumePreview}>
          <div className="resumePreviewModal" onClick={(e) => e.stopPropagation()}>
            <div className="resumePreviewToolbar">
              <span className="resumePreviewName">{resumePreview.name}</span>
              <button type="button" className="resumePreviewClose" onClick={closeResumePreview}>
                Close
              </button>
            </div>
            <div className="resumePreviewBody">
              {resumePreview.isImage ? (
                <img src={resumePreview.blobUrl} alt="Resume preview" />
              ) : (
                <iframe src={resumePreview.blobUrl} title="Resume preview" />
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="jobsSeekFooter">
        © {new Date().getFullYear()} SkillMesh · {user?.email}
      </footer>
    </main>
  );
}

function EmployerAddressSection({ form, setForm, idPrefix = "emp-co", fieldErrors = {}, onAddressFieldEdited }) {
  const [countrySuggestions, setCountrySuggestions] = useState([]);
  const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);
  const [stateSuggestions, setStateSuggestions] = useState([]);
  const [showStateSuggestions, setShowStateSuggestions] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [placeSuggestions, setPlaceSuggestions] = useState([]);
  const [showPlaceSuggestions, setShowPlaceSuggestions] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const hydratedPlaceRef = useRef(false);

  const idCountry = `${idPrefix}-country`;
  const idState = `${idPrefix}-state`;
  const idCity = `${idPrefix}-city`;
  const idPlace = `${idPrefix}-place`;
  const idStreet = `${idPrefix}-street`;
  const idLoc = `${idPrefix}-locline`;

  function touchAddressField(name) {
    onAddressFieldEdited?.(name);
  }

  useEffect(() => {
    if (form?.id && !hydratedPlaceRef.current) {
      hydratedPlaceRef.current = true;
      if (form.suburb && form.postcode) {
        setPlaceQuery(`${form.suburb} - ${form.postcode}`);
      } else if (form.suburb) {
        setPlaceQuery(form.suburb);
      } else if (form.postcode) {
        setPlaceQuery(form.postcode);
      }
    }
  }, [form?.id, form?.postcode, form?.suburb]);

  useEffect(() => {
    const q = (form.country || "").trim();
    if (q.length < 1) {
      setCountrySuggestions([]);
      return undefined;
    }
    const t = setTimeout(async () => {
      try {
        const rows = await api(`/api/auth/meta/countries?q=${encodeURIComponent(q)}`, { withAuth: false });
        setCountrySuggestions(rows || []);
      } catch {
        setCountrySuggestions([]);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [form.country]);

  useEffect(() => {
    if (!(form.country_code || "").trim()) {
      setStateSuggestions([]);
      return undefined;
    }
    const q = (form.state_region || "").trim();
    if (q.length < 1) {
      setStateSuggestions([]);
      return undefined;
    }
    const t = setTimeout(async () => {
      try {
        const rows = await api(
          `/api/auth/meta/states?country_code=${encodeURIComponent(form.country_code)}&q=${encodeURIComponent(q)}`,
          { withAuth: false },
        );
        setStateSuggestions(rows || []);
      } catch {
        setStateSuggestions([]);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [form.state_region, form.country_code]);

  useEffect(() => {
    if (!(form.country_code || "").trim()) {
      setCitySuggestions([]);
      return undefined;
    }
    const q = (form.city || "").trim();
    if (q.length < 2) {
      setCitySuggestions([]);
      return undefined;
    }
    const t = setTimeout(async () => {
      try {
        const st = (form.state_region || "").trim();
        const stateParam = st ? `&state=${encodeURIComponent(st)}` : "";
        const rows = await api(
          `/api/auth/meta/cities?country_code=${encodeURIComponent(form.country_code)}&q=${encodeURIComponent(q)}${stateParam}`,
          { withAuth: false },
        );
        setCitySuggestions(rows || []);
      } catch {
        setCitySuggestions([]);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [form.city, form.country_code, form.state_region]);

  useEffect(() => {
    const q = placeQuery.trim();
    if (q.length < 1 || !(form.country_code || "").trim()) {
      setPlaceSuggestions([]);
      return undefined;
    }
    const t = setTimeout(async () => {
      try {
        const rows = await api(
          `/api/auth/meta/au-postcodes?q=${encodeURIComponent(q)}&country_code=${encodeURIComponent(form.country_code)}`,
          { withAuth: false },
        );
        setPlaceSuggestions(rows || []);
      } catch {
        setPlaceSuggestions([]);
      }
    }, 240);
    return () => clearTimeout(t);
  }, [placeQuery, form.country_code]);

  const stateLocked = !(form.country_code || "").trim();
  const cityLocked = !(form.state_region || "").trim();
  const placeLocked = !(form.state_region || "").trim() || !(form.country_code || "").trim();

  return (
    <div className="employerAddressBlock">
      <div className="employerOnboardingField">
        <label className="registerFieldLabel" htmlFor={idCountry}>Country *</label>
        <div className="suggestWrap">
          <input
            id={idCountry}
            className={`authInput authInputLg ${fieldErrors.country ? "authInputHasError" : ""} ${!form.country_code && (form.country || "").trim() && !fieldErrors.country ? "inputSoftWarn" : ""}`}
            placeholder="Type to search countries…"
            value={form.country}
            aria-invalid={!!fieldErrors.country}
            aria-describedby={fieldErrors.country ? `${idCountry}-err` : undefined}
            onChange={(e) => {
              touchAddressField("country");
              const v = e.target.value;
              setForm((prev) => ({
                ...prev,
                country: v,
                country_code: "",
                state_region: "",
                city: "",
                suburb: "",
                postcode: "",
              }));
              setPlaceQuery("");
              hydratedPlaceRef.current = false;
            }}
            onFocus={() => setShowCountrySuggestions(true)}
            onBlur={() => setTimeout(() => setShowCountrySuggestions(false), 160)}
            autoComplete="country-name"
          />
          {showCountrySuggestions && countrySuggestions.length > 0 && (
            <div className="suggestionBox suggestionBoxElevated">
              {countrySuggestions.map((c) => (
                <button
                  key={`${c.name}-${c.code}`}
                  type="button"
                  onClick={() => {
                    touchAddressField("country");
                    setForm((prev) => ({
                      ...prev,
                      country: c.name,
                      country_code: c.code,
                      state_region: "",
                      city: "",
                      suburb: "",
                      postcode: "",
                    }));
                    setPlaceQuery("");
                    setCountrySuggestions([]);
                    setShowCountrySuggestions(false);
                  }}
                >
                  {c.name} ({c.code})
                </button>
              ))}
            </div>
          )}
        </div>
        {!(form.country_code || "").trim() && (form.country || "").trim() ? (
          <p className="fieldHelp fieldHelpMuted">Pick a country from the list to unlock state, city, and suburb lookup.</p>
        ) : null}
        {fieldErrors.country ? (
          <p className="fieldErrorHint" id={`${idCountry}-err`} role="alert">
            {fieldErrors.country}
          </p>
        ) : null}
      </div>

      <div className="employerOnboardingField">
        <label className="registerFieldLabel" htmlFor={idState}>State / region *</label>
        <div className="suggestWrap">
          <input
            id={idState}
            className={fieldErrors.state_region ? "authInput authInputLg authInputHasError" : "authInput authInputLg"}
            placeholder={stateLocked ? "Select country first" : "Type or choose state / province"}
            disabled={stateLocked}
            value={form.state_region}
            aria-invalid={!!fieldErrors.state_region}
            aria-describedby={fieldErrors.state_region ? `${idState}-err` : undefined}
            onChange={(e) => {
              touchAddressField("state_region");
              setForm((prev) => ({
                ...prev,
                state_region: e.target.value,
                city: "",
                suburb: "",
                postcode: "",
              }));
            }}
            onFocus={() => setShowStateSuggestions(true)}
            onBlur={() => setTimeout(() => setShowStateSuggestions(false), 160)}
          />
          {showStateSuggestions && !stateLocked && stateSuggestions.length > 0 && (
            <div className="suggestionBox suggestionBoxElevated">
              {stateSuggestions.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => {
                    touchAddressField("state_region");
                    setForm((prev) => ({
                      ...prev,
                      state_region: s.name,
                      city: "",
                      suburb: "",
                      postcode: "",
                    }));
                    setPlaceQuery("");
                    setShowStateSuggestions(false);
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {!stateLocked && stateSuggestions.length === 0 && (form.state_region || "").trim().length >= 1 ? (
          <p className="fieldHelp fieldHelpMuted">No preset list for this country — enter your state or region manually.</p>
        ) : null}
        {fieldErrors.state_region ? (
          <p className="fieldErrorHint" id={`${idState}-err`} role="alert">
            {fieldErrors.state_region}
          </p>
        ) : null}
      </div>

      <div className="employerOnboardingField">
        <label className="registerFieldLabel" htmlFor={idCity}>City or town *</label>
        <p className="fieldHelp fieldHelpMuted employerAddressFieldHint">
          Main city / local government area — not the same as suburb.
        </p>
        <div className="suggestWrap">
          <input
            id={idCity}
            className={fieldErrors.city ? "authInput authInputLg authInputHasError" : "authInput authInputLg"}
            placeholder={cityLocked ? "Enter state / region first" : "Type to search cities…"}
            disabled={cityLocked}
            value={form.city}
            aria-invalid={!!fieldErrors.city}
            aria-describedby={fieldErrors.city ? `${idCity}-err` : undefined}
            onChange={(e) => {
              touchAddressField("city");
              setForm((prev) => ({ ...prev, city: e.target.value }));
            }}
            onFocus={() => setShowCitySuggestions(true)}
            onBlur={() => setTimeout(() => setShowCitySuggestions(false), 160)}
          />
          {showCitySuggestions && !cityLocked && citySuggestions.length > 0 && (
            <div className="suggestionBox suggestionBoxElevated">
              {citySuggestions.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => {
                    touchAddressField("city");
                    setForm((prev) => ({ ...prev, city: s.name }));
                    setShowCitySuggestions(false);
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {fieldErrors.city ? (
          <p className="fieldErrorHint" id={`${idCity}-err`} role="alert">
            {fieldErrors.city}
          </p>
        ) : null}
      </div>

      <div className="employerOnboardingField">
        <label className="registerFieldLabel" htmlFor={idPlace}>Look up suburb &amp; postcode</label>
        <p className="fieldHelp fieldHelpMuted employerAddressFieldHint">
          Search does not change your city. Pick a result to fill suburb and postcode, or type them below.
        </p>
        <div className="suggestWrap">
          <input
            id={idPlace}
            className="authInput authInputLg"
            placeholder={placeLocked ? "Enter state / region first" : "e.g. Parramatta or 2150"}
            disabled={placeLocked}
            value={placeQuery}
            onChange={(e) => {
              touchAddressField("suburb");
              touchAddressField("postcode");
              setPlaceQuery(e.target.value);
              setForm((prev) => ({ ...prev, postcode: "", suburb: "" }));
            }}
            onFocus={() => setShowPlaceSuggestions(true)}
            onBlur={() => setTimeout(() => setShowPlaceSuggestions(false), 160)}
          />
          {showPlaceSuggestions && !placeLocked && placeSuggestions.length > 0 && (
            <div className="suggestionBox suggestionBoxElevated">
              {placeSuggestions.map((s) => (
                <button
                  key={`${s.postcode}-${s.suburb}-${s.state}`}
                  type="button"
                  onClick={() => {
                    touchAddressField("suburb");
                    touchAddressField("postcode");
                    const label = s.postcode ? `${s.suburb} - ${s.postcode}` : s.suburb;
                    setForm((prev) => ({
                      ...prev,
                      postcode: s.postcode || "",
                      suburb: s.suburb || prev.suburb,
                      state_region: s.state || prev.state_region,
                    }));
                    setPlaceQuery(label);
                    setShowPlaceSuggestions(false);
                  }}
                >
                  {(s.postcode || "—")} · {s.suburb}
                  {s.state ? ` · ${s.state}` : ""}
                  {s.country_code ? ` (${s.country_code})` : ""}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="employerOnboardingRow2">
        <div className="employerOnboardingField">
          <label className="registerFieldLabel" htmlFor={`${idPrefix}-suburb-text`}>Suburb / district *</label>
          <input
            id={`${idPrefix}-suburb-text`}
            className={fieldErrors.suburb ? "authInput authInputLg authInputHasError" : "authInput authInputLg"}
            placeholder="e.g. Parramatta"
            disabled={placeLocked}
            value={form.suburb}
            aria-invalid={!!fieldErrors.suburb}
            aria-describedby={fieldErrors.suburb ? `${idPrefix}-suburb-text-err` : undefined}
            onChange={(e) => {
              touchAddressField("suburb");
              setForm((prev) => ({ ...prev, suburb: e.target.value }));
            }}
          />
          {fieldErrors.suburb ? (
            <p className="fieldErrorHint" id={`${idPrefix}-suburb-text-err`} role="alert">
              {fieldErrors.suburb}
            </p>
          ) : null}
        </div>
        <div className="employerOnboardingField">
          <label className="registerFieldLabel" htmlFor={`${idPrefix}-postcode-text`}>Postcode</label>
          <input
            id={`${idPrefix}-postcode-text`}
            className={fieldErrors.postcode ? "authInput authInputLg authInputHasError" : "authInput authInputLg"}
            placeholder="e.g. 2150"
            disabled={placeLocked}
            value={form.postcode}
            aria-invalid={!!fieldErrors.postcode}
            aria-describedby={fieldErrors.postcode ? `${idPrefix}-postcode-text-err` : undefined}
            onChange={(e) => {
              touchAddressField("postcode");
              setForm((prev) => ({ ...prev, postcode: e.target.value }));
            }}
          />
          {fieldErrors.postcode ? (
            <p className="fieldErrorHint" id={`${idPrefix}-postcode-text-err`} role="alert">
              {fieldErrors.postcode}
            </p>
          ) : null}
        </div>
      </div>

      <div className="employerOnboardingField">
        <label className="registerFieldLabel" htmlFor={idStreet}>Street address</label>
        <input
          id={idStreet}
          className={fieldErrors.street_address ? "authInput authInputLg authInputHasError" : "authInput authInputLg"}
          placeholder="Suite, building, street (optional — not auto-filled)"
          value={form.street_address}
          aria-invalid={!!fieldErrors.street_address}
          aria-describedby={fieldErrors.street_address ? `${idStreet}-err` : undefined}
          onChange={(e) => {
            touchAddressField("street_address");
            setForm((prev) => ({ ...prev, street_address: e.target.value }));
          }}
        />
        {fieldErrors.street_address ? (
          <p className="fieldErrorHint" id={`${idStreet}-err`} role="alert">
            {fieldErrors.street_address}
          </p>
        ) : null}
      </div>

      <div className="employerOnboardingField">
        <label className="registerFieldLabel" htmlFor={idLoc}>Public location line *</label>
        <input
          id={idLoc}
          className={fieldErrors.location ? "authInput authInputLg authInputHasError" : "authInput authInputLg"}
          placeholder="Short line for job listings, e.g. Sydney, NSW"
          value={form.location}
          aria-invalid={!!fieldErrors.location}
          aria-describedby={fieldErrors.location ? `${idLoc}-err` : undefined}
          onChange={(e) => {
            touchAddressField("location");
            setForm((prev) => ({ ...prev, location: e.target.value }));
          }}
        />
        <p className="fieldHelp fieldHelpMuted">Shown on job cards — keep it short and professional.</p>
        {fieldErrors.location ? (
          <p className="fieldErrorHint" id={`${idLoc}-err`} role="alert">
            {fieldErrors.location}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function EmployerOnboardingGuard({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading...</p>;
  if (user?.role === "employer" && user?.employer_company?.needs_company_profile !== false) {
    return <Navigate to="/employer/onboarding/company" replace />;
  }
  return children;
}

const EMPLOYER_ONBOARD_FIELD_ORDER = [
  "company_name",
  "industry",
  "company_size",
  "founded_year",
  "description",
  "website",
  "linkedin_url",
  "business_registration_number",
  "phone",
  "contact_email",
  "country",
  "state_region",
  "city",
  "suburb",
  "postcode",
  "street_address",
  "location",
];

function focusFirstEmployerOnboardError(fieldErrors) {
  if (fieldErrors.industry) {
    const other = document.getElementById("co-industry-other");
    if (other) {
      other.scrollIntoView({ behavior: "smooth", block: "center" });
      other.focus();
      return;
    }
  }
  const ids = {
    company_name: "co-name",
    industry: "co-industry",
    company_size: "co-size",
    founded_year: "co-founded",
    description: "co-desc",
    website: "co-web",
    linkedin_url: "co-li",
    business_registration_number: "co-reg",
    phone: "co-phone",
    contact_email: "co-cemail",
    country: "onb-country",
    state_region: "onb-state",
    city: "onb-city",
    suburb: "onb-suburb-text",
    postcode: "onb-postcode-text",
    street_address: "onb-street",
    location: "onb-locline",
  };
  for (const key of EMPLOYER_ONBOARD_FIELD_ORDER) {
    if (!fieldErrors[key]) continue;
    const id = ids[key];
    if (!id) continue;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof el.focus === "function") el.focus();
      break;
    }
  }
}

function EmployerCompanyProfilePage({ variant = "onboarding" }) {
  const isOnboarding = variant === "onboarding";
  const { user, loading: authLoading, refreshMe } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => ({ ...EMPTY_EMPLOYER_COMPANY }));
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [industryOtherActive, setIndustryOtherActive] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const c = await api("/api/employers/company/profile");
        if (alive && c?.id) {
          setForm((prev) => ({
            ...prev,
            ...c,
            founded_year: c.founded_year != null ? String(c.founded_year) : "",
          }));
          if (c.industry && !EMPLOYER_INDUSTRY_OPTIONS.includes(c.industry)) {
            setIndustryOtherActive(true);
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function setField(key, value) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (authLoading) {
    return (
      <main className="employerOnboardingPage">
        <p className="muted" style={{ padding: "2rem 1rem", textAlign: "center" }}>
          Loading…
        </p>
      </main>
    );
  }

  if (isOnboarding && user?.employer_company?.needs_company_profile === false) {
    return <Navigate to="/employer/jobs" replace />;
  }

  if (!isOnboarding && user?.employer_company?.needs_company_profile !== false) {
    return <Navigate to="/employer/onboarding/company" replace />;
  }

  return (
    <main className="employerOnboardingPage">
      <div className="employerOnboardingAmbient" aria-hidden="true" />
      <form
        className="employerOnboardingFrame card fadeInUp"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setFieldErrors({});
          setSaving(true);
          try {
            await api("/api/employers/company/profile", {
              method: "POST",
              body: JSON.stringify(buildEmployerCompanyPayload(form)),
            });
            await refreshMe();
            navigate(isOnboarding ? "/employer/jobs" : "/", { replace: true });
          } catch (err) {
            const { fieldErrors: fe, generalMessage } = parseApiValidationErrors(err);
            setFieldErrors(fe);
            const hasFields = Object.keys(fe).length > 0;
            setError(hasFields ? generalMessage : generalMessage || formatApiError(err));
            if (hasFields) {
              requestAnimationFrame(() => focusFirstEmployerOnboardError(fe));
            }
          } finally {
            setSaving(false);
          }
        }}
      >
        <header className="employerOnboardingHeader">
          <div className="employerOnboardingBrandStrip">
            <SiteBrandBar fallbackTo={isOnboarding ? "/" : "/employer"} />
          </div>
          <h1 className="employerOnboardingTitle">{isOnboarding ? "Company profile" : "Edit company profile"}</h1>
          <p className="employerOnboardingLead">
            {isOnboarding ? (
              <>
                A complete profile builds trust with candidates. When you continue, you&apos;ll go to job listings to post
                roles. You can edit company details anytime from the employer dashboard.
              </>
            ) : (
              <>
                Update how your organisation appears to candidates. Changes apply to your public company line and trust
                signals across SkillMesh.
              </>
            )}
          </p>
        </header>

        {error && <p className="error employerOnboardingError">{error}</p>}

        <div className="employerOnboardingPanels">
          <section className="employerOnboardingPanel">
            <div className="employerOnboardingPanelHead">
              <span className="employerOnboardingStep">1</span>
              <div>
                <h2 className="employerOnboardingPanelTitle">Company overview</h2>
                <p className="employerOnboardingPanelSub">Basics candidates and partners see first.</p>
              </div>
            </div>
            <div className="employerOnboardingFields">
              <div className="employerOnboardingField">
                <label className="registerFieldLabel" htmlFor="co-name">Legal or trading name *</label>
                <input
                  id="co-name"
                  className={fieldErrors.company_name ? "authInput authInputLg authInputHasError" : "authInput authInputLg"}
                  value={form.company_name}
                  onChange={(e) => setField("company_name", e.target.value)}
                  autoComplete="organization"
                  aria-invalid={!!fieldErrors.company_name}
                  aria-describedby={fieldErrors.company_name ? "co-name-err" : undefined}
                />
                {fieldErrors.company_name ? (
                  <p className="fieldErrorHint" id="co-name-err" role="alert">
                    {fieldErrors.company_name}
                  </p>
                ) : null}
              </div>
              <div className="employerOnboardingRow2">
                <div className="employerOnboardingField">
                  <label className="registerFieldLabel" htmlFor="co-industry">Industry *</label>
                  <div className="authSelectWrap">
                    <select
                      id="co-industry"
                      className={
                        fieldErrors.industry && !industryOtherActive
                          ? "authInput authInputLg authSelect authInputHasError"
                          : "authInput authInputLg authSelect"
                      }
                      value={
                        industryOtherActive
                          ? "__other__"
                          : EMPLOYER_INDUSTRY_OPTIONS.includes(form.industry)
                            ? form.industry
                            : ""
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "__other__") {
                          setIndustryOtherActive(true);
                          setField("industry", "");
                        } else {
                          setIndustryOtherActive(false);
                          setField("industry", v);
                        }
                      }}
                      aria-invalid={!!fieldErrors.industry && !industryOtherActive}
                      aria-describedby={fieldErrors.industry ? "co-industry-err" : undefined}
                    >
                      <option value="">Select industry</option>
                      {EMPLOYER_INDUSTRY_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      <option value="__other__">Other…</option>
                    </select>
                  </div>
                  {industryOtherActive && (
                    <input
                      id="co-industry-other"
                      className={
                        fieldErrors.industry
                          ? "authInput authInputLg employerIndustryOther authInputHasError"
                          : "authInput authInputLg employerIndustryOther"
                      }
                      placeholder="Type your industry"
                      value={form.industry}
                      onChange={(e) => setField("industry", e.target.value)}
                      aria-invalid={!!fieldErrors.industry}
                      aria-describedby={fieldErrors.industry ? "co-industry-err" : undefined}
                    />
                  )}
                  {fieldErrors.industry ? (
                    <p className="fieldErrorHint" id="co-industry-err" role="alert">
                      {fieldErrors.industry}
                    </p>
                  ) : null}
                </div>
                <div className="employerOnboardingField">
                  <label className="registerFieldLabel" htmlFor="co-size">Company size *</label>
                  <div className="authSelectWrap">
                    <select
                      id="co-size"
                      className={
                        fieldErrors.company_size
                          ? "authInput authInputLg authSelect authInputHasError"
                          : "authInput authInputLg authSelect"
                      }
                      value={form.company_size}
                      onChange={(e) => setField("company_size", e.target.value)}
                      aria-invalid={!!fieldErrors.company_size}
                      aria-describedby={fieldErrors.company_size ? "co-size-err" : undefined}
                    >
                      {EMPLOYER_COMPANY_SIZE_OPTIONS.map(([val, label]) => (
                        <option key={val || "empty"} value={val}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {fieldErrors.company_size ? (
                    <p className="fieldErrorHint" id="co-size-err" role="alert">
                      {fieldErrors.company_size}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="employerOnboardingField">
                <label className="registerFieldLabel" htmlFor="co-founded">Year founded</label>
                <input
                  id="co-founded"
                  className={
                    fieldErrors.founded_year
                      ? "authInput authInputLg inputYearPlain authInputHasError"
                      : "authInput authInputLg inputYearPlain"
                  }
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  placeholder={`e.g. ${new Date().getFullYear() - 5}`}
                  value={form.founded_year}
                  onChange={(e) => setField("founded_year", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  aria-invalid={!!fieldErrors.founded_year}
                  aria-describedby={fieldErrors.founded_year ? "co-founded-err" : undefined}
                />
                {fieldErrors.founded_year ? (
                  <p className="fieldErrorHint" id="co-founded-err" role="alert">
                    {fieldErrors.founded_year}
                  </p>
                ) : null}
              </div>
              <div className="employerOnboardingField">
                <label className="registerFieldLabel" htmlFor="co-desc">Company description *</label>
                <textarea
                  id="co-desc"
                  className={
                    fieldErrors.description
                      ? "authInput employerOnboardingTextarea authInputHasError"
                      : "authInput employerOnboardingTextarea"
                  }
                  rows={5}
                  placeholder="What you do, culture, and what applicants should know (min. 20 characters)."
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  aria-invalid={!!fieldErrors.description}
                  aria-describedby={fieldErrors.description ? "co-desc-err" : undefined}
                />
                {fieldErrors.description ? (
                  <p className="fieldErrorHint" id="co-desc-err" role="alert">
                    {fieldErrors.description}
                  </p>
                ) : null}
              </div>
              <div className="employerOnboardingRow2">
                <div className="employerOnboardingField">
                  <label className="registerFieldLabel" htmlFor="co-web">Website</label>
                  <input
                    id="co-web"
                    className={fieldErrors.website ? "authInput authInputLg authInputHasError" : "authInput authInputLg"}
                    type="url"
                    placeholder="https://"
                    value={form.website}
                    onChange={(e) => setField("website", e.target.value)}
                    aria-invalid={!!fieldErrors.website}
                    aria-describedby={fieldErrors.website ? "co-web-err" : undefined}
                  />
                  {fieldErrors.website ? (
                    <p className="fieldErrorHint" id="co-web-err" role="alert">
                      {fieldErrors.website}
                    </p>
                  ) : null}
                </div>
                <div className="employerOnboardingField">
                  <label className="registerFieldLabel" htmlFor="co-li">LinkedIn</label>
                  <input
                    id="co-li"
                    className={fieldErrors.linkedin_url ? "authInput authInputLg authInputHasError" : "authInput authInputLg"}
                    type="url"
                    placeholder="Company page URL"
                    value={form.linkedin_url}
                    onChange={(e) => setField("linkedin_url", e.target.value)}
                    aria-invalid={!!fieldErrors.linkedin_url}
                    aria-describedby={fieldErrors.linkedin_url ? "co-li-err" : undefined}
                  />
                  {fieldErrors.linkedin_url ? (
                    <p className="fieldErrorHint" id="co-li-err" role="alert">
                      {fieldErrors.linkedin_url}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="employerOnboardingField">
                <label className="registerFieldLabel" htmlFor="co-reg">ABN / ACN / registration #</label>
                <input
                  id="co-reg"
                  className={
                    fieldErrors.business_registration_number
                      ? "authInput authInputLg authInputHasError"
                      : "authInput authInputLg"
                  }
                  value={form.business_registration_number}
                  onChange={(e) => setField("business_registration_number", e.target.value)}
                  aria-invalid={!!fieldErrors.business_registration_number}
                  aria-describedby={fieldErrors.business_registration_number ? "co-reg-err" : undefined}
                />
                {fieldErrors.business_registration_number ? (
                  <p className="fieldErrorHint" id="co-reg-err" role="alert">
                    {fieldErrors.business_registration_number}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="employerOnboardingPanel">
            <div className="employerOnboardingPanelHead">
              <span className="employerOnboardingStep">2</span>
              <div>
                <h2 className="employerOnboardingPanelTitle">Hiring contact</h2>
                <p className="employerOnboardingPanelSub">At least one channel is required.</p>
              </div>
            </div>
            <div className="employerOnboardingFields">
              <div className="employerOnboardingRow2">
                <div className="employerOnboardingField">
                  <label className="registerFieldLabel" htmlFor="co-phone">Main phone *</label>
                  <input
                    id="co-phone"
                    className={fieldErrors.phone ? "authInput authInputLg authInputHasError" : "authInput authInputLg"}
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    aria-invalid={!!fieldErrors.phone}
                    aria-describedby={fieldErrors.phone ? "co-phone-err" : undefined}
                  />
                  {fieldErrors.phone ? (
                    <p className="fieldErrorHint" id="co-phone-err" role="alert">
                      {fieldErrors.phone}
                    </p>
                  ) : null}
                </div>
                <div className="employerOnboardingField">
                  <label className="registerFieldLabel" htmlFor="co-cemail">Careers email *</label>
                  <input
                    id="co-cemail"
                    className={fieldErrors.contact_email ? "authInput authInputLg authInputHasError" : "authInput authInputLg"}
                    type="email"
                    placeholder="careers@company.com"
                    value={form.contact_email}
                    onChange={(e) => setField("contact_email", e.target.value)}
                    aria-invalid={!!fieldErrors.contact_email}
                    aria-describedby={fieldErrors.contact_email ? "co-cemail-err" : undefined}
                  />
                  {fieldErrors.contact_email ? (
                    <p className="fieldErrorHint" id="co-cemail-err" role="alert">
                      {fieldErrors.contact_email}
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="fieldHelp fieldHelpMuted">Provide a phone and/or email so candidates can reach you.</p>
            </div>
          </section>

          <section className="employerOnboardingPanel employerOnboardingPanelWide">
            <div className="employerOnboardingPanelHead">
              <span className="employerOnboardingStep">3</span>
              <div>
                <h2 className="employerOnboardingPanelTitle">Registered address</h2>
                <p className="employerOnboardingPanelSub">
                  Country → state → city/town → suburb &amp; postcode (lookup fills suburb only; city stays separate). Street is free‑typed.
                </p>
              </div>
            </div>
            <EmployerAddressSection
              form={form}
              setForm={setForm}
              idPrefix="onb"
              fieldErrors={fieldErrors}
              onAddressFieldEdited={(name) =>
                setFieldErrors((prev) => {
                  if (!prev[name]) return prev;
                  const next = { ...prev };
                  delete next[name];
                  return next;
                })
              }
            />
          </section>
        </div>

        <footer className="employerOnboardingFooter">
          <button className="modernBtn authSubmitBtn employerOnboardingSubmit" type="submit" disabled={saving}>
            {saving ? "Saving…" : isOnboarding ? "Save and continue to job listings" : "Save changes"}
          </button>
        </footer>
      </form>
    </main>
  );
}

function employerCompanyCompleteness(c) {
  const b = c && typeof c === "object" ? c : {};
  const items = [
    { label: "Company name", ok: !!(b.company_name || "").trim() },
    { label: "Industry", ok: !!(b.industry || "").trim() },
    { label: "Company size", ok: !!(b.company_size || "").trim() },
    { label: "Description", ok: (b.description || "").trim().length >= 20 },
    { label: "Contact phone or email", ok: !!(b.phone || "").trim() || !!(b.contact_email || "").trim() },
    { label: "Country & region", ok: !!(b.country || "").trim() && !!(b.state_region || "").trim() },
    { label: "City", ok: !!(b.city || "").trim() },
    { label: "Suburb", ok: !!(b.suburb || "").trim() },
    { label: "Public location line", ok: !!(b.location || "").trim() },
    { label: "Website or LinkedIn", ok: !!(b.website || "").trim() || !!(b.linkedin_url || "").trim() },
  ];
  const filled = items.filter((i) => i.ok).length;
  const total = items.length;
  const pct = Math.round((100 * filled) / total);
  return { pct, filled, total, items };
}

function EmployerDashboard() {
  const [companyProfile, setCompanyProfile] = useState({
    ...EMPTY_EMPLOYER_COMPANY,
  });
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [candidateFilters, setCandidateFilters] = useState({
    skills: "",
    education: "",
    location: "",
  });
  const [recs, setRecs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [dashLoading, setDashLoading] = useState(true);
  const [searchBusy, setSearchBusy] = useState(false);
  const [recBusy, setRecBusy] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [recAttempted, setRecAttempted] = useState(false);
  const [resultsTab, setResultsTab] = useState("search");

  const jobStats = useMemo(() => {
    const list = jobs || [];
    const norm = (s) => String(s || "").toLowerCase();
    const open = list.filter((j) => norm(j.status) === "open").length;
    const draft = list.filter((j) => norm(j.status) === "draft").length;
    const closed = list.filter((j) => norm(j.status) === "closed").length;
    const other = Math.max(0, list.length - open - draft - closed);
    return {
      total: list.length,
      open,
      draft,
      closed,
      other,
    };
  }, [jobs]);

  const profileStrength = useMemo(() => employerCompanyCompleteness(companyProfile), [companyProfile]);

  const recentJobs = useMemo(() => {
    const list = [...(jobs || [])];
    list.sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return tb - ta;
    });
    return list.slice(0, 5);
  }, [jobs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDashLoading(true);
      try {
        try {
          const c = await api("/api/employers/company/profile");
          if (!cancelled && c?.id) {
            setCompanyProfile((prev) => ({
              ...prev,
              ...c,
              founded_year: c.founded_year != null ? String(c.founded_year) : "",
            }));
          }
        } catch {
          /* no profile */
        }
        const myJobs = await api("/api/employers/jobs");
        if (!cancelled) setJobs(Array.isArray(myJobs) ? myJobs : []);
      } catch {
        if (!cancelled) setError("Could not load dashboard data.");
      } finally {
        if (!cancelled) setDashLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function searchCandidates() {
    setError("");
    setStatus("");
    setSearchBusy(true);
    try {
      const q = new URLSearchParams(candidateFilters).toString();
      const res = await api(`/api/candidates/search?${q}`);
      const list = Array.isArray(res) ? res : [];
      setCandidates(list);
      setSearchAttempted(true);
      setResultsTab("search");
      setStatus(list.length ? `${list.length} candidate${list.length === 1 ? "" : "s"} found.` : "No matches for those filters.");
    } catch (err) {
      setError(formatApiError(err));
      setCandidates([]);
    } finally {
      setSearchBusy(false);
    }
  }

  async function getRecommendations() {
    setError("");
    setStatus("");
    const id = selectedJobId ? Number(selectedJobId) : null;
    if (!id) {
      setError("Select a job to run recommendations.");
      return;
    }
    setRecBusy(true);
    try {
      const list = await api(`/api/recommendations/candidates-for-job/${id}`);
      setRecs(Array.isArray(list) ? list : []);
      setRecAttempted(true);
      setResultsTab("matches");
      setStatus("Matches loaded.");
    } catch (err) {
      setError(formatApiError(err));
      setRecs([]);
    } finally {
      setRecBusy(false);
    }
  }

  const companyDisplayName = (companyProfile.company_name || "").trim() || "Your company";

  const heroLead = useMemo(() => {
    const meta = [(companyProfile.industry || "").trim(), (companyProfile.location || "").trim()]
      .filter(Boolean)
      .join(" · ");
    const stats = `${jobStats.open} open · ${jobStats.total} job${jobStats.total === 1 ? "" : "s"} · profile ${profileStrength.pct}%`;
    if (meta) return `${meta} — ${stats}`;
    return `${stats}. Add industry and location on your company profile.`;
  }, [companyProfile.industry, companyProfile.location, jobStats.open, jobStats.total, profileStrength.pct]);

  return (
    <main className="homePage jobsSeekPage candidateDashboardPage employerDashboardPage">
      <EmployerMemberHeader />

      <section className="jobsSeekHero candidateDashHero" aria-label="Employer dashboard">
        <div className="heroGlow heroGlowA" />
        <div className="heroGlow heroGlowB" />
        <div className="heroMesh" />
        <div className="jobsSeekHeroInner candidateDashHeroInner">
          <div className="candidateDashHeroText">
            <p className="heroKicker jobsSeekHeroKicker">Employer</p>
            <h1 className="candidateDashTitle">{companyDisplayName}</h1>
            <p className="candidateDashLead muted">{heroLead}</p>
          </div>
          <div className="candidateDashHeroActions">
            <Link className="jobsSeekCta candidateDashBrowseCta" to="/employer/jobs">
              Job listings
            </Link>
            <Link className="jobsSeekLinkBtn candidateDashHeroLink" to="/employer/applications">
              Applications
            </Link>
            <Link className="jobsSeekLinkBtn candidateDashHeroLink" to="/employer/company">
              Company profile
            </Link>
          </div>
        </div>
      </section>

      <div className="candidateDashFlash">
        {status && <p className="candidateDashBanner candidateDashBannerSuccess">{status}</p>}
        {error && <p className="candidateDashBanner candidateDashBannerError">{error}</p>}
      </div>

      {dashLoading ? (
        <p className="muted employerDashPageLoading">Loading…</p>
      ) : (
        <div className="candidateDashLayout candidateDashLayoutWide">
          <div className="candidateDashMain">
            <section className="candidateDashCard candidateDashCardCompact" aria-labelledby="employer-dash-recent-heading">
              <div className="candidateDashCardHead">
                <h2 id="employer-dash-recent-heading" className="candidateDashCardTitle">
                  Recent listings
                </h2>
                <Link to="/employer/jobs" className="employerDashTextLink">
                  View all
                </Link>
              </div>
              {recentJobs.length === 0 ? (
                <p className="candidateDashEmpty">
                  No jobs yet.{" "}
                  <Link to="/employer/jobs" className="employerDashInlineLink">
                    Create a listing
                  </Link>
                </p>
              ) : (
                <ul className="employerDashRecentList">
                  {recentJobs.map((j) => (
                    <li key={j.id}>
                      <Link to={`/jobs/${j.id}`} className="employerDashRecentItem employerDashRecentLink">
                        <div className="employerDashRecentMain">
                          <span className="employerDashRecentTitle">
                            {(j.title || "").trim() || "Untitled draft"}
                          </span>
                          <span className="employerDashRecentSub">
                            {formatWorkModeLabel(j.work_mode)}
                            {j.location ? ` · ${j.location}` : ""}
                          </span>
                        </div>
                        <span className="employerDashRecentPill">{String(j.status || "open")}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="candidateDashCard candidateDashCardCompact" aria-labelledby="employer-dash-talent-heading">
              <h2 id="employer-dash-talent-heading" className="candidateDashCardTitle">
                Find talent
              </h2>
              <p className="candidateDashCardHint">Search the directory or rank candidates against a job you posted.</p>

              <div className="employerDashTalentGrid">
                <div className="employerDashField">
                  <label className="employerDashLabel" htmlFor="dash-filter-skill">
                    Skill
                  </label>
                  <input
                    id="dash-filter-skill"
                    className="authInput"
                    placeholder="Keyword"
                    value={candidateFilters.skills}
                    onChange={(e) => setCandidateFilters({ ...candidateFilters, skills: e.target.value })}
                  />
                </div>
                <div className="employerDashField">
                  <label className="employerDashLabel" htmlFor="dash-filter-edu">
                    Education
                  </label>
                  <input
                    id="dash-filter-edu"
                    className="authInput"
                    placeholder="Keyword"
                    value={candidateFilters.education}
                    onChange={(e) => setCandidateFilters({ ...candidateFilters, education: e.target.value })}
                  />
                </div>
                <div className="employerDashField">
                  <label className="employerDashLabel" htmlFor="dash-filter-loc">
                    Location
                  </label>
                  <input
                    id="dash-filter-loc"
                    className="authInput"
                    placeholder="Keyword"
                    value={candidateFilters.location}
                    onChange={(e) => setCandidateFilters({ ...candidateFilters, location: e.target.value })}
                  />
                </div>
              </div>
              <button
                type="button"
                className="modernBtn employerDashTalentSearchBtn"
                disabled={searchBusy}
                onClick={searchCandidates}
              >
                {searchBusy ? "Searching…" : "Search directory"}
              </button>

              <div className="employerDashTalentDivider" />

              <div className="employerDashMatchRow">
                {jobs.length === 0 ? (
                  <p className="candidateDashEmpty employerDashMatchEmpty">
                    Post a job to unlock ranked matches.{" "}
                    <Link to="/employer/jobs" className="employerDashInlineLink">
                      New job
                    </Link>
                  </p>
                ) : (
                  <div className="employerDashField employerDashFieldGrow">
                    <label className="employerDashLabel" htmlFor="dash-rec-job">
                      Rank for job
                    </label>
                    <div className="authSelectWrap">
                      <select
                        id="dash-rec-job"
                        className="authInput authSelect"
                        value={selectedJobId}
                        onChange={(e) => setSelectedJobId(e.target.value)}
                      >
                        <option value="">Select job…</option>
                        {jobs.map((j) => (
                          <option key={j.id} value={String(j.id)}>
                            {j.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  className="employerDashBtn employerDashBtnSecondary employerDashMatchBtn"
                  disabled={recBusy || jobs.length === 0}
                  onClick={getRecommendations}
                >
                  {recBusy ? "Loading…" : "Top matches"}
                </button>
              </div>
            </section>

            <section className="candidateDashCard candidateDashCardCompact employerDashResultsCard" aria-labelledby="employer-dash-results-heading">
              <div className="employerDashResultsHead">
                <h2 id="employer-dash-results-heading" className="candidateDashCardTitle">
                  Results
                </h2>
                <div className="employerDashTabBar" role="tablist" aria-label="Result type">
                  <button
                    type="button"
                    role="tab"
                    className="employerDashTab"
                    aria-selected={resultsTab === "search"}
                    onClick={() => setResultsTab("search")}
                  >
                    Directory ({candidates.length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className="employerDashTab"
                    aria-selected={resultsTab === "matches"}
                    onClick={() => setResultsTab("matches")}
                  >
                    Matches ({recs.length})
                  </button>
                </div>
              </div>

              {resultsTab === "search" ? (
                <div className="employerDashTableScroll">
                  {candidates.length === 0 ? (
                    <div className="employerDashTableEmpty">
                      <p className="employerDashTableEmptyTitle">
                        {searchAttempted ? "No matching candidates" : "Run a search"}
                      </p>
                      <p className="employerDashTableEmptyText">
                        {searchAttempted ? "Try broader keywords or fewer filters." : "Use the fields above, then Search directory."}
                      </p>
                    </div>
                  ) : (
                    <table className="employerDashTable">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Name</th>
                          <th>Headline</th>
                          <th>Education</th>
                          <th>Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map((c) => (
                          <tr key={c.id}>
                            <td>{c.id}</td>
                            <td className="employerDashTdStrong">{c.full_name}</td>
                            <td>{c.headline || c.major || "—"}</td>
                            <td>{c.education_level || "—"}</td>
                            <td>{c.location || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                <div className="employerDashTableScroll">
                  {recs.length === 0 ? (
                    <div className="employerDashTableEmpty">
                      <p className="employerDashTableEmptyTitle">
                        {recAttempted ? "No matches returned" : "Load matches"}
                      </p>
                      <p className="employerDashTableEmptyText">
                        {recAttempted
                          ? "Add skills to the job or try another listing."
                          : "Choose a job and tap Top matches."}
                      </p>
                    </div>
                  ) : (
                    <table className="employerDashTable">
                      <thead>
                        <tr>
                          <th>Candidate</th>
                          <th>Score</th>
                          <th>Matched skills</th>
                          <th>Education fit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recs.map((r) => (
                          <tr key={r.candidate_id}>
                            <td className="employerDashTdStrong">{r.candidate_id}</td>
                            <td>
                              {matchScorePercent(r.score) != null ? `${matchScorePercent(r.score)}%` : r.score ?? "—"}
                            </td>
                            <td>{(r.explanation?.matched_skills || []).join(", ") || "—"}</td>
                            <td>{r.explanation?.education_match ? "Yes" : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </main>
  );
}

function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [homeJobQuery, setHomeJobQuery] = useState("");
  const [homeSearchLabel, setHomeSearchLabel] = useState("");
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobsError, setJobsError] = useState("");
  const [headlineIdx, setHeadlineIdx] = useState(0);
  const [wordVisible, setWordVisible] = useState(true);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const rotatingWords = ["your next role", "the right people", "better opportunities"];

  useEffect(() => {
    const id = setInterval(() => {
      setWordVisible(false);
      setTimeout(() => {
        setHeadlineIdx((prev) => (prev + 1) % rotatingWords.length);
        setWordVisible(true);
      }, 280);
    }, 2600);
    return () => clearInterval(id);
  }, [rotatingWords.length]);

  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!user || user.role !== "candidate") return;
    const step = user?.candidate_onboarding?.onboarding_step;
    if (step === "resume") navigate("/onboarding/work-experience");
    if (step === "categories") navigate("/onboarding/categories");
  }, [user, navigate]);

  if (user?.role === "candidate" && user?.candidate_onboarding?.onboarding_step === "done") {
    return <CandidateHomePage />;
  }

  async function runHomeJobSearch() {
    setJobsError("");
    setLoadingJobs(true);
    const q = homeJobQuery.trim();
    try {
      if (!q) {
        const feed = await api("/api/jobs/feed", { withAuth: false });
        const list = Array.isArray(feed) ? feed : [];
        setJobs(list.slice(0, 6));
        setHomeSearchLabel("");
        return;
      }
      const rows = await api(`/api/jobs/search?keyword=${encodeURIComponent(q)}`, { withAuth: false });
      const list = Array.isArray(rows) ? rows : [];
      setJobs(list.slice(0, 20));
      setHomeSearchLabel(q);
    } catch (err) {
      setJobsError("Could not load jobs right now. Please try again.");
      setJobs([]);
      setHomeSearchLabel("");
    } finally {
      setLoadingJobs(false);
    }
  }

  if (!user) {
    return (
      <main className="homePage">
        <header className={`homeHeader ${headerScrolled ? "homeHeaderScrolled" : ""}`}>
          <div className="homeHeaderLead">
            <Link to="/" className="homeHeaderBrand">
              <img className="homeHeaderLogo" src={ldLogo} alt="" />
              <span className="homeHeaderWordmark">SkillMesh</span>
            </Link>
          </div>
          <div className="homeHeaderActions">
            <button className="btnGhost" type="button" onClick={() => setShowLoginModal(true)}>
              Log in
            </button>
            <button className="btnLink" type="button" onClick={() => setShowSignupModal(true)}>
              Sign up
            </button>
          </div>
        </header>

        <section className="homeHero">
          <div className="heroGlow heroGlowA" />
          <div className="heroGlow heroGlowB" />
          <div className="heroMesh" />
          <div className="heroInner">
            <h1>
              Match with{" "}
              <span className={`gradientText ${wordVisible ? "wordIn" : "wordOut"}`}>
                {rotatingWords[headlineIdx]}
              </span>
            </h1>
            <p className="homeSubtitle">
              Search opportunities near you and match with jobs aligned to your skills.
            </p>
            <div className="postcodeBox">
              <input
                type="search"
                autoComplete="off"
                placeholder="Job title, skills, location, or postcode"
                value={homeJobQuery}
                onChange={(e) => setHomeJobQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runHomeJobSearch();
                }}
                aria-label="Search open jobs"
              />
              <button type="button" className="searchButton" onClick={runHomeJobSearch} disabled={loadingJobs}>
                {loadingJobs ? "Searching..." : "Search jobs"}
                <span>→</span>
              </button>
            </div>
          </div>
          {jobsError && <p className="error">{jobsError}</p>}
          {!jobsError && homeSearchLabel && jobs.length === 0 && (
            <p className="homeJobPreviewEmpty" role="status">
              {`No open roles match "${homeSearchLabel}". Try different keywords or a location.`}
            </p>
          )}
          {jobs.length > 0 && (
            <section className="homeJobPreviewPanel" aria-labelledby="home-job-preview-heading">
              <h3 id="home-job-preview-heading" className="homeJobPreviewTitle">
                {homeSearchLabel ? `Results for "${homeSearchLabel}"` : "Open roles"}
              </h3>
              <p className="homeJobPreviewLead">Select a role to read the full description and apply.</p>
              <ul className="homeJobPreviewList">
                {jobs.map((j) => {
                  const pay = formatCompensationSummary(j);
                  const posted = formatPostedShort(j.created_at);
                  const categoryName = j.job_category?.name;
                  return (
                    <li key={j.id} className="homeJobPreviewItem">
                      <Link
                        to={`/jobs/${j.id}`}
                        className="homeJobPreviewCard"
                        aria-label={`${j.title} at ${j.company_info || "company"} — view job`}
                      >
                        <div className="homeJobPreviewCardHead">
                          <span className="homeJobPreviewAvatar" aria-hidden="true">
                            {companyAvatarLetter(j.company_info, j.title)}
                          </span>
                          <div className="homeJobPreviewHeadText">
                            <span className="homeJobPreviewCompany">{j.company_info || "Company"}</span>
                            <h4 className="homeJobPreviewRole">{j.title}</h4>
                          </div>
                          {posted ? (
                            <span className="homeJobPreviewPosted" title="Posted">
                              {posted}
                            </span>
                          ) : null}
                        </div>
                        <div className="homeJobPreviewTags">
                          <span className="homeJobPreviewTag">{j.location || "Location TBD"}</span>
                          <span className="homeJobPreviewTag">{formatWorkModeLabel(j.work_mode) || "Work mode TBD"}</span>
                          {categoryName ? <span className="homeJobPreviewTag">{categoryName}</span> : null}
                          {pay ? <span className="homeJobPreviewTag homeJobPreviewTagPay">{pay}</span> : null}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </section>

        <section className="homeSection">
          <h2>How SkillMesh Works</h2>
          <div className="howVisual">
            <article className="howCard">
              <span className="howBadge">1</span>
              <h4>Create your account</h4>
              <p>Sign up in minutes as candidate or employer.</p>
            </article>
            <div className="howArrow">→</div>
            <article className="howCard">
              <span className="howBadge">2</span>
              <h4>Build your profile</h4>
              <p>Upload resume and experience for smarter matching.</p>
            </article>
            <div className="howArrow">→</div>
            <article className="howCard">
              <span className="howBadge">3</span>
              <h4>Apply with confidence</h4>
              <p>Browse roles and track applications from one place.</p>
            </article>
          </div>
        </section>

        <footer className="homeFooter">
          <p>© {new Date().getFullYear()} SkillMesh. Connecting skills with opportunities.</p>
        </footer>

        {showSignupModal && (
          <div className="modalOverlay" onClick={() => setShowSignupModal(false)}>
            <div className="roleModal" onClick={(e) => e.stopPropagation()}>
              <h3>Sign up as</h3>
              <p>Choose your account type to continue.</p>
              <div className="roleChoices">
                <button
                  type="button"
                  className="roleChoiceBtn"
                  onClick={() => {
                    setShowSignupModal(false);
                    navigate("/register?role=candidate");
                  }}
                >
                  <span className="roleEmoji">👤</span>
                  <span>
                    <strong>Candidate</strong>
                    <small>Find roles matched to your profile</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="roleChoiceBtn"
                  onClick={() => {
                    setShowSignupModal(false);
                    navigate("/register?role=employer");
                  }}
                >
                  <span className="roleEmoji">🏢</span>
                  <span>
                    <strong>Employer</strong>
                    <small>Post jobs and hire faster</small>
                  </span>
                </button>
              </div>
              <button className="modalCloseBtn" type="button" onClick={() => setShowSignupModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {showLoginModal && (
          <div className="modalOverlay" onClick={() => setShowLoginModal(false)}>
            <div className="roleModal" onClick={(e) => e.stopPropagation()}>
              <h3>Log in as</h3>
              <p>Choose your account type to continue.</p>
              <div className="roleChoices">
                <button
                  type="button"
                  className="roleChoiceBtn"
                  onClick={() => {
                    setShowLoginModal(false);
                    navigate("/login?role=candidate");
                  }}
                >
                  <span className="roleEmoji">👤</span>
                  <span>
                    <strong>Candidate</strong>
                    <small>Find roles matched to your profile</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="roleChoiceBtn"
                  onClick={() => {
                    setShowLoginModal(false);
                    navigate("/login?role=employer");
                  }}
                >
                  <span className="roleEmoji">🏢</span>
                  <span>
                    <strong>Employer</strong>
                    <small>Post jobs and hire faster</small>
                  </span>
                </button>
              </div>
              <button className="modalCloseBtn" type="button" onClick={() => setShowLoginModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>
    );
  }
  if (user?.role === "employer") {
    return <EmployerHomePage />;
  }
  return (
    <div className="card employerHomeCard">
      <div className="employerHomeTop">
        <div className="homeHeaderLead">
          <Link to="/" className="homeHeaderBrand employerHomeBrandLink">
            <img className="homeHeaderLogo" src={ldLogo} alt="" />
            <span className="homeHeaderWordmark">SkillMesh</span>
          </Link>
        </div>
      </div>
      <h1>SkillMesh</h1>
      <p>Intelligent Talent Matching Platform</p>
      <div className="row">
        {!user && <Link to="/login?role=employer">Login</Link>}
        {!user && <Link to="/register?role=employer">Register</Link>}
        {user && <button onClick={logout}>Logout ({user.email})</button>}
        {user?.role === "candidate" && <Link to="/">Candidate home</Link>}
        {user?.role === "candidate" && <Link to="/candidate">Profile & tools</Link>}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/jobs/:jobId/apply" element={<JobApplyPage />} />
      <Route path="/jobs/:jobId" element={<JobDetailPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/onboarding/work-experience"
        element={
          <CandidateOnboardingRoute page="work_experience">
            <CandidateOnboardingWorkExperience />
          </CandidateOnboardingRoute>
        }
      />
      <Route
        path="/onboarding/categories"
        element={
          <CandidateOnboardingRoute page="categories">
            <CandidateCategoryOnboarding />
          </CandidateOnboardingRoute>
        }
      />
      <Route
        path="/candidate"
        element={
          <CandidateOnboardingRoute page="dashboard">
            <CandidateDashboard />
          </CandidateOnboardingRoute>
        }
      />
      <Route
        path="/candidate/saved-jobs"
        element={
          <CandidateOnboardingRoute page="saved_jobs">
            <CandidateSavedJobsPage />
          </CandidateOnboardingRoute>
        }
      />
      <Route
        path="/candidate/applied-jobs"
        element={
          <CandidateOnboardingRoute page="applied_jobs">
            <CandidateAppliedJobsPage />
          </CandidateOnboardingRoute>
        }
      />
      <Route
        path="/employer/onboarding/company"
        element={
          <Protected roles={["employer"]}>
            <EmployerCompanyProfilePage variant="onboarding" />
          </Protected>
        }
      />
      <Route
        path="/employer/company"
        element={
          <Protected roles={["employer"]}>
            <EmployerOnboardingGuard>
              <EmployerCompanyProfilePage variant="edit" />
            </EmployerOnboardingGuard>
          </Protected>
        }
      />
      <Route
        path="/employer/jobs"
        element={
          <Protected roles={["employer"]}>
            <EmployerOnboardingGuard>
              <EmployerJobsPage />
            </EmployerOnboardingGuard>
          </Protected>
        }
      />
      <Route
        path="/employer/applications"
        element={
          <Protected roles={["employer"]}>
            <EmployerOnboardingGuard>
              <EmployerApplicationsPage />
            </EmployerOnboardingGuard>
          </Protected>
        }
      />
      <Route
        path="/employer"
        element={
          <Protected roles={["employer"]}>
            <EmployerOnboardingGuard>
              <EmployerDashboard />
            </EmployerOnboardingGuard>
          </Protected>
        }
      />
    </Routes>
  );
}
