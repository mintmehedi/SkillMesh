import { Navigate, Route, Routes, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { useAuth } from "./auth";
import { api } from "./api";
import ldLogo from "./assets/ld.png";
import "./App.css";

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
    <div className="authBrand">
      <img src={ldLogo} alt="SkillMesh logo" />
      <div>
        <strong>SkillMesh</strong>
        <small>Intelligent Talent Matching</small>
      </div>
    </div>
  );
}

function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="card authCard fadeInUp"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          await login(email, password);
        } catch (err) {
          setError(String(err.message || err));
        }
      }}
    >
      <AuthBrand />
      <h2>Login</h2>
      {error && <p className="error">{error}</p>}
      <input className="authInput" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <div className="passwordFieldWrap">
        <input
          className="authInput authInputWithToggle"
          placeholder="Password"
          type={showPassword ? "text" : "password"}
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
      <button className="modernBtn" type="submit">Login</button>
    </form>
  );
}

function RegisterPage() {
  const { register } = useAuth();
  const [searchParams] = useSearchParams();
  const roleFromQuery = searchParams.get("role");
  const initialRole = roleFromQuery === "employer" ? "employer" : "candidate";
  const [form, setForm] = useState({
    role: initialRole,
    email: "",
    username: "",
    password: "",
    password_confirm: "",
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
  const [countrySuggestions, setCountrySuggestions] = useState([]);
  const [postcodeSuggestions, setPostcodeSuggestions] = useState([]);
  const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState({ state: "idle", message: "" });
  const [manualUsernameEdit, setManualUsernameEdit] = useState(false);

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
    if (form.role !== "candidate") {
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
        const reasonText = res.reason === "taken" ? "Username is already taken." : "Invalid username format.";
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

  return (
    <form
      className="card authCard registerShell fadeInUp"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          await register(form);
        } catch (err) {
          setError(String(err.message || err));
        }
      }}
    >
      <AuthBrand />
      <h2>{form.role === "candidate" ? "Create Candidate Account" : "Create Employer Account"}</h2>
      <p className="muted registerIntro">
        {form.role === "candidate"
          ? "Tell us a bit about yourself so we can personalize your job matches."
          : "Set up your employer account to post jobs and find talent."}
      </p>
      {error && <p className="error">{error}</p>}
      <p className="muted">Signing up as <strong>{form.role === "candidate" ? "Candidate" : "Employer"}</strong></p>
      {form.role === "candidate" ? (
        <>
          <h4 className="registerSectionTitle">Account details</h4>
          <input
            className={`authInput authInputLg ${form.email && !emailValid ? "inputError" : ""}`}
            placeholder="Email address"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          {form.email && !emailValid && <p className="fieldHelp fieldHelpError">Enter a valid email (example@domain.com).</p>}
          <input
            className={`authInput authInputLg ${form.username && !usernameValidFormat ? "inputError" : ""}`}
            placeholder="Username"
            value={form.username}
            onChange={(e) => {
              setManualUsernameEdit(true);
              setForm({ ...form, username: e.target.value });
            }}
          />
          {usernameStatus.message && (
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
          )}
          <div className="grid">
            <div className="passwordFieldWrap">
              <input
                className="authInput authInputWithToggle"
                placeholder="Password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
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
                className="authInput authInputWithToggle"
                placeholder="Confirm password"
                type={showPasswordConfirm ? "text" : "password"}
                value={form.password_confirm}
                onChange={(e) => setForm({ ...form, password_confirm: e.target.value })}
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
          <div className="passwordRules">
            <span className={passwordRules.minLength ? "ruleOk" : "rulePending"}>At least 8 characters</span>
            <span className={passwordRules.specialChar ? "ruleOk" : "rulePending"}>At least 1 special character</span>
            <span className={confirmMatches ? "ruleOk" : "rulePending"}>Passwords match</span>
          </div>

          <h4 className="registerSectionTitle">Personal details</h4>
          <div className="grid">
            <input className="authInput" placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            <input className="authInput" placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
          <div className="grid">
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                className="dobPicker"
                label="Date of birth"
                disableFuture
                minDate={dayjs("1940-01-01")}
                maxDate={dayjs().subtract(13, "year")}
                value={form.date_of_birth ? dayjs(form.date_of_birth) : null}
                onChange={(value) =>
                  setForm({ ...form, date_of_birth: value && value.isValid() ? value.format("YYYY-MM-DD") : "" })
                }
                slotProps={{
                  textField: {
                    fullWidth: true,
                    className: "muiDobInput",
                  },
                  popper: {
                    className: "dobPopper",
                  },
                }}
              />
            </LocalizationProvider>
            <input className="authInput" placeholder="Mobile number" value={form.mobile_number} onChange={(e) => setForm({ ...form, mobile_number: e.target.value })} />
          </div>

          <h4 className="registerSectionTitle">Location details</h4>
          <input
            className="authInput authInputLg"
            placeholder="Country (start typing)"
            value={form.country}
            onChange={(e) =>
              setForm({ ...form, country: e.target.value, country_code: "", location_query: "", suburb: "", postcode: "" })
            }
            onFocus={() => setShowCountrySuggestions(true)}
            onBlur={() => setTimeout(() => setShowCountrySuggestions(false), 140)}
          />
          {showCountrySuggestions && countrySuggestions.length > 0 && (
            <div className="suggestionBox">
              {countrySuggestions.map((c) => (
                <button
                  key={`${c.name}-${c.code}`}
                  type="button"
                  onClick={() => {
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
            className="authInput authInputLg"
            placeholder="Suburb or postcode (e.g. Auburn or 2144)"
            value={form.location_query}
            onChange={(e) =>
              setForm({ ...form, location_query: e.target.value, suburb: "", postcode: "" })
            }
            onFocus={() => setShowLocationSuggestions(true)}
            onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 140)}
          />

          {showLocationSuggestions && postcodeSuggestions.length > 0 && (
            <div className="suggestionBox">
              {postcodeSuggestions.map((s) => (
                <button
                  key={`${s.postcode}-${s.suburb}`}
                  type="button"
                  onClick={() => {
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
        <>
          <input className="authInput authInputLg" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="authInput authInputLg" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <div className="passwordFieldWrap">
            <input
              className="authInput authInputLg authInputWithToggle"
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
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
          <button className="modernBtn authSubmitBtn" type="submit">Create employer account</button>
        </>
      )}
    </form>
  );
}

function CandidateDashboard() {
  const [profile, setProfile] = useState({
    full_name: "",
    contact: "",
    education_level: "",
    major: "",
    years_experience: 0,
    location: "",
    preferred_mode: "",
    summary: "",
    skills: [],
  });
  const [skillInput, setSkillInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [jobs, setJobs] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [resumeFile, setResumeFile] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api("/api/candidates/profile");
        if (data && data.id) setProfile(data);
      } catch {
        // Ignore on first load if profile doesn't exist.
      }
    })();
  }, []);

  async function saveProfile() {
    setError("");
    setStatus("");
    try {
      const payload = {
        ...profile,
        years_experience: Number(profile.years_experience || 0),
      };
      const data = await api("/api/candidates/profile", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setProfile(data);
      setStatus("Profile saved.");
    } catch (err) {
      setError(String(err.message || err));
    }
  }

  async function uploadResume() {
    if (!resumeFile) return;
    setError("");
    setStatus("");
    try {
      const fd = new FormData();
      fd.append("file", resumeFile);
      const resume = await api("/api/candidates/resume/upload", {
        method: "POST",
        body: fd,
      });
      setStatus("Resume uploaded and parsed.");
      if (resume?.parsed_json) {
        const refreshed = await api("/api/candidates/profile");
        if (refreshed && refreshed.id) setProfile(refreshed);
      }
    } catch (err) {
      setError(String(err.message || err));
    }
  }

  async function searchJobs() {
    setJobs(await api(`/api/jobs/search?keyword=${encodeURIComponent(keyword)}`));
  }

  async function loadRecommendations() {
    setRecommended(await api("/api/recommendations/jobs-for-candidate"));
  }

  async function applyToJob(jobId) {
    setError("");
    setStatus("");
    try {
      await api("/api/applications/", {
        method: "POST",
        body: JSON.stringify({ job: jobId }),
      });
      setStatus(`Applied to job #${jobId}`);
      await loadApplications();
    } catch (err) {
      setError(String(err.message || err));
    }
  }

  async function loadApplications() {
    setMyApplications(await api("/api/applications/"));
  }

  function addSkill() {
    const value = skillInput.trim();
    if (!value) return;
    setProfile((prev) => ({
      ...prev,
      skills: [...(prev.skills || []), { skill_name: value, level: 1 }],
    }));
    setSkillInput("");
  }

  function removeSkill(index) {
    setProfile((prev) => ({
      ...prev,
      skills: (prev.skills || []).filter((_, i) => i !== index),
    }));
  }

  return (
    <div className="card">
      <h2>Candidate Dashboard</h2>
      {status && <p className="success">{status}</p>}
      {error && <p className="error">{error}</p>}
      <h3>My Profile</h3>
      <div className="grid">
        <input placeholder="Full name" value={profile.full_name || ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
        <input placeholder="Contact" value={profile.contact || ""} onChange={(e) => setProfile({ ...profile, contact: e.target.value })} />
        <input placeholder="Education" value={profile.education_level || ""} onChange={(e) => setProfile({ ...profile, education_level: e.target.value })} />
        <input placeholder="Major" value={profile.major || ""} onChange={(e) => setProfile({ ...profile, major: e.target.value })} />
        <input placeholder="Years experience" type="number" value={profile.years_experience || 0} onChange={(e) => setProfile({ ...profile, years_experience: e.target.value })} />
        <input placeholder="Location" value={profile.location || ""} onChange={(e) => setProfile({ ...profile, location: e.target.value })} />
        <input placeholder="Preferred mode" value={profile.preferred_mode || ""} onChange={(e) => setProfile({ ...profile, preferred_mode: e.target.value })} />
        <input placeholder="Summary" value={profile.summary || ""} onChange={(e) => setProfile({ ...profile, summary: e.target.value })} />
      </div>
      <div className="row">
        <input placeholder="Add skill (e.g. python)" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} />
        <button type="button" onClick={addSkill}>Add Skill</button>
      </div>
      <div className="chipWrap">
        {(profile.skills || []).map((s, i) => (
          <span className="chip" key={`${s.skill_name}-${i}`}>
            {s.skill_name}
            <button type="button" onClick={() => removeSkill(i)}>x</button>
          </span>
        ))}
      </div>
      <button onClick={saveProfile}>Save Profile</button>

      <h3>Resume Upload</h3>
      <div className="row">
        <input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setResumeFile(e.target.files?.[0] || null)} />
        <button onClick={uploadResume}>Upload + Parse</button>
      </div>

      <h3>Search Jobs</h3>
      <div className="row">
        <input placeholder="Keyword from job description" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <button onClick={searchJobs}>Search Jobs</button>
        <button onClick={loadRecommendations}>Top 10 Jobs</button>
        <button onClick={loadApplications}>My Applications</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Location</th>
            <th>Mode</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td>{j.id}</td>
              <td>{j.title}</td>
              <td>{j.location || "-"}</td>
              <td>{j.work_mode}</td>
              <td><button onClick={() => applyToJob(j.id)}>Apply</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Recommendations</h3>
      <table>
        <thead>
          <tr>
            <th>Job ID</th>
            <th>Score</th>
            <th>Matched Skills</th>
            <th>Experience Gap</th>
          </tr>
        </thead>
        <tbody>
          {recommended.map((r) => (
            <tr key={r.job_id}>
              <td>{r.job_id}</td>
              <td>{r.score}</td>
              <td>{(r.explanation?.matched_skills || []).join(", ") || "-"}</td>
              <td>{r.explanation?.experience_gap ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>My Applications</h3>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Job</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {myApplications.map((a) => (
            <tr key={a.id}>
              <td>{a.id}</td>
              <td>{a.job}</td>
              <td>{a.status}</td>
              <td>{a.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmployerDashboard() {
  const [company, setCompany] = useState({
    company_name: "",
    description: "",
    website: "",
    location: "",
  });
  const [jobForm, setJobForm] = useState({
    title: "",
    company_info: "",
    jd_text: "",
    required_education: "",
    required_experience: 0,
    work_mode: "onsite",
    location: "",
    status: "open",
    skills: [],
  });
  const [jobSkillInput, setJobSkillInput] = useState("");
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [candidateFilters, setCandidateFilters] = useState({
    skills: "",
    education: "",
    experience_min: "",
    location: "",
  });
  const [recs, setRecs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const c = await api("/api/employers/company/profile");
        if (c?.id) setCompany(c);
      } catch {
        // No profile yet.
      }
      const myJobs = await api("/api/employers/jobs");
      setJobs(myJobs);
    })();
  }, []);

  async function saveCompany() {
    setError("");
    setStatus("");
    try {
      const c = await api("/api/employers/company/profile", {
        method: "POST",
        body: JSON.stringify(company),
      });
      setCompany(c);
      setStatus("Company profile saved.");
    } catch (err) {
      setError(String(err.message || err));
    }
  }

  function addJobSkill() {
    const value = jobSkillInput.trim();
    if (!value) return;
    setJobForm((prev) => ({
      ...prev,
      skills: [...(prev.skills || []), { skill_name: value, weight: 1 }],
    }));
    setJobSkillInput("");
  }

  async function createJob() {
    setError("");
    setStatus("");
    try {
      await api("/api/employers/jobs", {
        method: "POST",
        body: JSON.stringify({
          ...jobForm,
          required_experience: Number(jobForm.required_experience || 0),
        }),
      });
      const myJobs = await api("/api/employers/jobs");
      setJobs(myJobs);
      setStatus("Job created.");
    } catch (err) {
      setError(String(err.message || err));
    }
  }

  async function searchCandidates() {
    const q = new URLSearchParams(candidateFilters).toString();
    setCandidates(await api(`/api/candidates/search?${q}`));
  }

  async function getRecommendations() {
    const id = selectedJobId || jobs[0]?.id;
    if (!id) return;
    setRecs(await api(`/api/recommendations/candidates-for-job/${id}`));
  }

  return (
    <div className="card">
      <h2>Employer Dashboard</h2>
      {status && <p className="success">{status}</p>}
      {error && <p className="error">{error}</p>}

      <h3>Company Profile</h3>
      <div className="grid">
        <input placeholder="Company name" value={company.company_name || ""} onChange={(e) => setCompany({ ...company, company_name: e.target.value })} />
        <input placeholder="Website" value={company.website || ""} onChange={(e) => setCompany({ ...company, website: e.target.value })} />
        <input placeholder="Location" value={company.location || ""} onChange={(e) => setCompany({ ...company, location: e.target.value })} />
        <input placeholder="Description" value={company.description || ""} onChange={(e) => setCompany({ ...company, description: e.target.value })} />
      </div>
      <button onClick={saveCompany}>Save Company</button>

      <h3>Create Job</h3>
      <div className="grid">
        <input placeholder="Title" value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} />
        <input placeholder="Company info" value={jobForm.company_info} onChange={(e) => setJobForm({ ...jobForm, company_info: e.target.value })} />
        <input placeholder="Required education" value={jobForm.required_education} onChange={(e) => setJobForm({ ...jobForm, required_education: e.target.value })} />
        <input placeholder="Required experience" type="number" value={jobForm.required_experience} onChange={(e) => setJobForm({ ...jobForm, required_experience: e.target.value })} />
        <input placeholder="Location" value={jobForm.location} onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })} />
        <select value={jobForm.work_mode} onChange={(e) => setJobForm({ ...jobForm, work_mode: e.target.value })}>
          <option value="onsite">On-site</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
        </select>
      </div>
      <textarea placeholder="Job description" value={jobForm.jd_text} onChange={(e) => setJobForm({ ...jobForm, jd_text: e.target.value })} />
      <div className="row">
        <input placeholder="Add job skill" value={jobSkillInput} onChange={(e) => setJobSkillInput(e.target.value)} />
        <button type="button" onClick={addJobSkill}>Add Skill</button>
      </div>
      <div className="chipWrap">
        {(jobForm.skills || []).map((s, i) => <span className="chip" key={`${s.skill_name}-${i}`}>{s.skill_name}</span>)}
      </div>
      <button onClick={createJob}>Create Job</button>

      <h3>My Jobs</h3>
      <table>
        <thead><tr><th>ID</th><th>Title</th><th>Mode</th><th>Location</th></tr></thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} onClick={() => setSelectedJobId(j.id)}>
              <td>{j.id}</td><td>{j.title}</td><td>{j.work_mode}</td><td>{j.location || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Candidate Search</h3>
      <div className="grid">
        <input placeholder="Skill" value={candidateFilters.skills} onChange={(e) => setCandidateFilters({ ...candidateFilters, skills: e.target.value })} />
        <input placeholder="Education" value={candidateFilters.education} onChange={(e) => setCandidateFilters({ ...candidateFilters, education: e.target.value })} />
        <input placeholder="Min experience" value={candidateFilters.experience_min} onChange={(e) => setCandidateFilters({ ...candidateFilters, experience_min: e.target.value })} />
        <input placeholder="Location" value={candidateFilters.location} onChange={(e) => setCandidateFilters({ ...candidateFilters, location: e.target.value })} />
      </div>
      <div className="row">
        <button onClick={searchCandidates}>Search Candidates</button>
        <button onClick={getRecommendations}>Top 10 Candidates for Selected Job</button>
      </div>
      <table>
        <thead><tr><th>ID</th><th>Name</th><th>Education</th><th>Exp</th><th>Location</th></tr></thead>
        <tbody>
          {candidates.map((c) => (
            <tr key={c.id}><td>{c.id}</td><td>{c.full_name}</td><td>{c.education_level || "-"}</td><td>{c.years_experience}</td><td>{c.location || "-"}</td></tr>
          ))}
        </tbody>
      </table>

      <h3>Recommendations</h3>
      <table>
        <thead><tr><th>Candidate ID</th><th>Score</th><th>Skills</th><th>Exp Gap</th></tr></thead>
        <tbody>
          {recs.map((r) => (
            <tr key={r.candidate_id}>
              <td>{r.candidate_id}</td>
              <td>{r.score}</td>
              <td>{(r.explanation?.matched_skills || []).join(", ") || "-"}</td>
              <td>{r.explanation?.experience_gap ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [postcode, setPostcode] = useState("");
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobsError, setJobsError] = useState("");
  const [headlineIdx, setHeadlineIdx] = useState(0);
  const [wordVisible, setWordVisible] = useState(true);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [showSignupModal, setShowSignupModal] = useState(false);
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

  async function viewNearbyJobs() {
    setJobsError("");
    setLoadingJobs(true);
    try {
      const feed = await api("/api/jobs/feed", { withAuth: false });
      const normalized = postcode.trim().toLowerCase();
      const filtered = normalized
        ? feed.filter((j) => (j.location || "").toLowerCase().includes(normalized))
        : feed;
      setJobs(filtered.slice(0, 6));
    } catch (err) {
      setJobsError("Could not load jobs right now. Please try again.");
    } finally {
      setLoadingJobs(false);
    }
  }

  function handleHeroMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / rect.width;
    const dy = (e.clientY - cy) / rect.height;
    setTilt({ x: dx * 8, y: dy * 8 });
  }

  if (!user) {
    return (
      <main className="homePage">
        <header className={`homeHeader ${headerScrolled ? "homeHeaderScrolled" : ""}`}>
          <div className="homeHeaderBrand">
            <img className="homeHeaderLogo" src={ldLogo} alt="SkillMesh logo" />
            <span className="homeHeaderWordmark">SkillMesh</span>
          </div>
          <div className="homeHeaderActions">
            <Link className="btnGhost" to="/login">Log in</Link>
            <button className="btnLink" type="button" onClick={() => setShowSignupModal(true)}>
              Sign up
            </button>
          </div>
        </header>

        <section
          className="homeHero"
          onMouseMove={handleHeroMove}
          onMouseLeave={() => setTilt({ x: 0, y: 0 })}
        >
          <div className="heroGlow heroGlowA" />
          <div className="heroGlow heroGlowB" />
          <div className="heroMesh" />
          <div
            className="heroInner"
            style={{
              transform: `rotateX(${-tilt.y}deg) rotateY(${tilt.x}deg) translateZ(0)`,
            }}
          >
            <p className="heroKicker">AI-Powered Hiring Platform</p>
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
                placeholder="Enter postcode (e.g. 2500)"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
              />
              <button className="searchButton" onClick={viewNearbyJobs} disabled={loadingJobs}>
                {loadingJobs ? "Searching..." : "Find Jobs Near Me"}
                <span>→</span>
              </button>
            </div>
          </div>
          {jobsError && <p className="error">{jobsError}</p>}
          {jobs.length > 0 && (
            <div className="jobPreviewList">
              {jobs.map((j) => (
                <article className="jobRow" key={j.id}>
                  <h4>{j.title}</h4>
                  <div className="jobMeta">
                    <span>{j.location || "Location TBD"}</span>
                    <span>{j.work_mode}</span>
                  </div>
                </article>
              ))}
            </div>
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
              <h4>Get top matches</h4>
              <p>Explore curated jobs or candidates instantly.</p>
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
      </main>
    );
  }
  return (
    <div className="card">
      <h1>SkillMesh</h1>
      <p>Intelligent Talent Matching Platform</p>
      <div className="row">
        {!user && <Link to="/login">Login</Link>}
        {!user && <Link to="/register">Register</Link>}
        {user && <button onClick={logout}>Logout ({user.email})</button>}
        {user?.role === "candidate" && <Link to="/candidate">Candidate Portal</Link>}
        {user?.role === "employer" && <Link to="/employer">Employer Portal</Link>}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/candidate" element={<Protected roles={["candidate"]}><CandidateDashboard /></Protected>} />
      <Route path="/employer" element={<Protected roles={["employer"]}><EmployerDashboard /></Protected>} />
    </Routes>
  );
}
