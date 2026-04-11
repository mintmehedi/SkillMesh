import { Link } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { formatApiError, humanizeFieldErrorMessage, parseApiValidationErrors } from "./apiErrors";
import { BackButton } from "./BackButton";
import { formatPostedShort, formatWorkModeLabel } from "./jobFormatters";
import { SiteDatePicker } from "./SiteDatePicker";
import ldLogo from "./assets/ld.png";

const JOB_FIELD_IDS = {
  title: "ej-title",
  job_category_id: "ej-category",
  location: "ej-location",
  required_education: "ej-education",
  required_experience: "ej-exp",
  work_mode: "ej-mode",
  status: "ej-status",
  closing_date: "ej-closing-date",
  compensation_period: "ej-comp-period",
  compensation_amount_min: "ej-comp-min",
  compensation_amount_max: "ej-comp-max",
  jd_text: "ej-jd",
  looking_for_people_bullets: "ej-lfp-0",
  looking_for_additional_bullets: "ej-lfa-0",
  role_bullets: "ej-roleb-0",
  why_choose_us_bullets: "ej-why-0",
  how_to_apply: "ej-apply",
  skills: "ej-skills",
};

const JOB_FIELD_FOCUS_ORDER = [
  "title",
  "job_category_id",
  "location",
  "required_education",
  "required_experience",
  "work_mode",
  "status",
  "closing_date",
  "compensation_period",
  "compensation_amount_min",
  "compensation_amount_max",
  "jd_text",
  "looking_for_people_bullets",
  "looking_for_additional_bullets",
  "role_bullets",
  "why_choose_us_bullets",
  "how_to_apply",
  "skills",
];

function focusFirstJobFieldError(fieldErrors) {
  for (const key of JOB_FIELD_FOCUS_ORDER) {
    if (!fieldErrors[key]) continue;
    const id = JOB_FIELD_IDS[key];
    if (!id) continue;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof el.focus === "function") el.focus();
      break;
    }
  }
}

const EMPTY_JOB_FORM = {
  title: "",
  jd_text: "",
  whats_on_offer: [],
  looking_for_people_bullets: [],
  looking_for_additional_bullets: [],
  role_bullets: [],
  why_choose_us_bullets: [],
  how_to_apply: "",
  required_education: "",
  required_experience: 0,
  work_mode: "onsite",
  location: "",
  status: "open",
  job_category_id: "",
  licenses_certifications: "",
  compensation_period: "not_specified",
  compensation_amount_min: "",
  compensation_amount_max: "",
  closing_date: "",
  skills: [],
};

function bulletListFromJob(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x || "").trim()).filter(Boolean);
}

function EmployerBulletBlock({ idPrefix, hint, lines, onChange }) {
  const safe = Array.isArray(lines) ? lines : [];
  return (
    <div className="employerJobsBulletBlock">
      {hint ? <p className="employerJobsFieldHint muted">{hint}</p> : null}
      <ul className="employerJobsOfferList">
        {safe.map((line, i) => (
          <li key={`${idPrefix}-row-${i}`} className="employerJobsOfferRow">
            <label className="employerJobsSrOnly" htmlFor={`${idPrefix}-${i}`}>
              Line {i + 1}
            </label>
            <input
              id={`${idPrefix}-${i}`}
              className="authInput"
              value={line}
              placeholder="e.g. Enjoy having variety in their day."
              onChange={(e) => {
                const next = [...safe];
                next[i] = e.target.value;
                onChange(next);
              }}
            />
            <button
              type="button"
              className="employerJobsGhostBtn employerJobsOfferRemove"
              aria-label={`Remove line ${i + 1}`}
              onClick={() => onChange(safe.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="employerJobsAddBulletBtn"
        onClick={() => onChange([...safe, ""])}
      >
        + Add bullet
      </button>
    </div>
  );
}

function jobClosingDateToInput(iso) {
  if (!iso) return "";
  const s = String(iso);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

function normalizeJobStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "closed") return "closed";
  if (s === "draft") return "draft";
  return "open";
}

function jobToForm(job) {
  const min = job.compensation_amount_min;
  const max = job.compensation_amount_max;
  return {
    title: job.title || "",
    jd_text: job.jd_text || "",
    whats_on_offer: bulletListFromJob(job.whats_on_offer),
    looking_for_people_bullets: bulletListFromJob(job.looking_for_people_bullets),
    looking_for_additional_bullets: bulletListFromJob(job.looking_for_additional_bullets),
    role_bullets: bulletListFromJob(job.role_bullets),
    why_choose_us_bullets: bulletListFromJob(job.why_choose_us_bullets),
    how_to_apply: job.how_to_apply || "",
    required_education: job.required_education || "",
    required_experience: job.required_experience ?? 0,
    work_mode: job.work_mode || "onsite",
    location: job.location || "",
    status: normalizeJobStatus(job.status),
    closing_date: jobClosingDateToInput(job.closing_date),
    job_category_id: job.job_category?.id != null ? String(job.job_category.id) : "",
    licenses_certifications: job.licenses_certifications || "",
    compensation_period: job.compensation_period || "not_specified",
    compensation_amount_min: min != null && min !== "" ? String(min) : "",
    compensation_amount_max: max != null && max !== "" ? String(max) : "",
    skills: (job.skills || []).map((s) => ({
      skill_name: s.skill_name || "",
      weight: s.weight ?? 1,
    })),
  };
}

function buildJobPayload(form, opts = {}) {
  const skills = (form.skills || [])
    .map((s) => ({
      skill_name: String(s.skill_name || "").trim(),
      weight: Math.min(32767, Math.max(1, Number(s.weight) || 1)),
    }))
    .filter((s) => s.skill_name);

  const parseOptionalDecimal = (v) => {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const n = Number(s);
    if (Number.isNaN(n) || n < 0) return null;
    return n;
  };

  const trimBullets = (arr) =>
    (arr || [])
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, 30);

  const payload = {
    title: (form.title || "").trim(),
    jd_text: (form.jd_text || "").trim(),
    whats_on_offer: trimBullets(form.whats_on_offer),
    looking_for_people_bullets: trimBullets(form.looking_for_people_bullets),
    looking_for_additional_bullets: trimBullets(form.looking_for_additional_bullets),
    role_bullets: trimBullets(form.role_bullets),
    why_choose_us_bullets: trimBullets(form.why_choose_us_bullets),
    how_to_apply: (form.how_to_apply || "").trim(),
    required_education: (form.required_education || "").trim(),
    required_experience: Math.max(0, Number(form.required_experience) || 0),
    work_mode: form.work_mode || "onsite",
    location: (form.location || "").trim(),
    status: opts.forceStatus != null ? String(opts.forceStatus).toLowerCase() : normalizeJobStatus(form.status),
    licenses_certifications: (form.licenses_certifications || "").trim(),
    compensation_period: form.compensation_period || "not_specified",
    compensation_amount_min: parseOptionalDecimal(form.compensation_amount_min),
    compensation_amount_max: parseOptionalDecimal(form.compensation_amount_max),
    skills,
  };

  const cd = (form.closing_date || "").trim();
  payload.closing_date = cd || null;

  const cat = form.job_category_id;
  if (cat === "" || cat == null) {
    payload.job_category_id = null;
  } else {
    payload.job_category_id = Number(cat);
  }
  return payload;
}

function statusLabel(s) {
  if (!s) return "—";
  return String(s).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function EmployerJobsPage() {
  const [categories, setCategories] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");
  /** True = next save must POST a new listing (never PATCH). */
  const [isNewJobDraft, setIsNewJobDraft] = useState(false);
  /** Non-null = editing this job id; ignored while isNewJobDraft is true for save targeting. */
  const [activeJobId, setActiveJobId] = useState(null);
  const [selectedListId, setSelectedListId] = useState(null);
  /** Bumps when starting a new draft, closing, or opening a job — stale openJob responses must not apply. */
  const editorSeqRef = useRef(0);
  const [jobForm, setJobForm] = useState(EMPTY_JOB_FORM);
  const [jobSkillInput, setJobSkillInput] = useState("");
  const [jobSkillSuggestions, setJobSkillSuggestions] = useState([]);
  const jobSkillSuggestRef = useRef(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const refreshJobs = useCallback(async () => {
    const list = await api("/api/employers/jobs");
    setJobs(Array.isArray(list) ? list : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [cats, list] = await Promise.all([
          api("/api/candidates/job-categories/").catch(() => []),
          api("/api/employers/jobs"),
        ]);
        if (cancelled) return;
        setCategories(Array.isArray(cats) ? cats : []);
        setJobs(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!cancelled) setError(formatApiError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const q = jobSkillInput.trim();
    if (q.length < 2) {
      setJobSkillSuggestions([]);
      return undefined;
    }
    const t = setTimeout(async () => {
      try {
        const rows = await api(`/api/candidates/skills/suggest/?q=${encodeURIComponent(q)}`);
        setJobSkillSuggestions(Array.isArray(rows) ? rows : []);
      } catch {
        setJobSkillSuggestions([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [jobSkillInput]);

  useEffect(() => {
    function onDocDown(e) {
      if (!jobSkillSuggestRef.current?.contains(e.target)) setJobSkillSuggestions([]);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  function clearJobFieldError(name) {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function startNewJob() {
    editorSeqRef.current += 1;
    setError("");
    setStatusMsg("");
    setFieldErrors({});
    setIsNewJobDraft(true);
    setActiveJobId(null);
    setSelectedListId(null);
    setJobForm({ ...EMPTY_JOB_FORM });
    setJobSkillInput("");
    setJobSkillSuggestions([]);
  }

  async function openJob(id) {
    editorSeqRef.current += 1;
    const seq = editorSeqRef.current;
    const numericId = Number(id);
    setError("");
    setStatusMsg("");
    setFieldErrors({});
    setIsNewJobDraft(false);
    setActiveJobId(numericId);
    setSelectedListId(numericId);
    setJobSkillInput("");
    setJobSkillSuggestions([]);
    try {
      const job = await api(`/api/employers/jobs/${numericId}`);
      if (seq !== editorSeqRef.current) return;
      setJobForm(jobToForm(job));
    } catch (err) {
      if (seq !== editorSeqRef.current) return;
      setError(formatApiError(err));
      setIsNewJobDraft(false);
      setActiveJobId(null);
      setSelectedListId(null);
    }
  }

  function addJobSkill(explicitName) {
    const value = (explicitName != null ? String(explicitName) : jobSkillInput).trim();
    if (!value) return;
    clearJobFieldError("skills");
    setJobForm((prev) => ({
      ...prev,
      skills: [...(prev.skills || []), { skill_name: value, weight: 1 }],
    }));
    setJobSkillInput("");
    setJobSkillSuggestions([]);
  }

  function removeSkillAt(index) {
    clearJobFieldError("skills");
    setJobForm((prev) => ({
      ...prev,
      skills: (prev.skills || []).filter((_, i) => i !== index),
    }));
  }

  async function saveJob(options = {}) {
    const asDraft = Boolean(options.asDraft);
    setError("");
    setStatusMsg("");
    const payload = buildJobPayload(jobForm, asDraft ? { forceStatus: "draft" } : {});
    if (!asDraft) {
      const clientFe = {};
      if (!payload.title) clientFe.title = humanizeFieldErrorMessage("This field may not be blank.");
      if (!payload.jd_text) clientFe.jd_text = humanizeFieldErrorMessage("This field may not be blank.");
      if (Object.keys(clientFe).length) {
        setFieldErrors(clientFe);
        setError("");
        setTimeout(() => focusFirstJobFieldError(clientFe), 0);
        return;
      }
    }
    setFieldErrors({});
    const creating = isNewJobDraft;
    const editingId = activeJobId;
    const saveStartSeq = editorSeqRef.current;
    setSaving(true);
    try {
      if (creating) {
        const created = await api("/api/employers/jobs", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const newId = Number(created.id);
        if (!Number.isFinite(newId)) {
          throw new Error("Server did not return a new job id.");
        }
        await refreshJobs();
        if (saveStartSeq !== editorSeqRef.current) {
          setFieldErrors({});
          setStatusMsg(asDraft ? "Saved as draft (not visible publicly)." : "Job posted.");
          return;
        }
        setIsNewJobDraft(false);
        setActiveJobId(newId);
        setSelectedListId(newId);
        setJobForm(jobToForm(created));
        setFieldErrors({});
        setStatusMsg(asDraft ? "Saved as draft (not visible publicly)." : "Job posted.");
      } else if (editingId != null && Number.isFinite(editingId)) {
        const updated = await api(`/api/employers/jobs/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        await refreshJobs();
        if (saveStartSeq !== editorSeqRef.current) {
          setFieldErrors({});
          setStatusMsg(asDraft ? "Saved as draft (not visible publicly)." : "Job updated.");
          return;
        }
        setJobForm(jobToForm(updated));
        setFieldErrors({});
        setStatusMsg(asDraft ? "Saved as draft (not visible publicly)." : "Job updated.");
      }
    } catch (err) {
      const { fieldErrors: fe, generalMessage } = parseApiValidationErrors(err);
      const hasFields = Object.keys(fe).length > 0;
      setFieldErrors(fe);
      setError(hasFields ? generalMessage : generalMessage || formatApiError(err));
      if (hasFields) setTimeout(() => focusFirstJobFieldError(fe), 0);
    } finally {
      setSaving(false);
    }
  }

  function closeEditor() {
    editorSeqRef.current += 1;
    setIsNewJobDraft(false);
    setActiveJobId(null);
    setSelectedListId(null);
    setJobForm(EMPTY_JOB_FORM);
    setJobSkillInput("");
    setJobSkillSuggestions([]);
    setFieldErrors({});
    setError("");
    setStatusMsg("");
  }

  const editorOpen = isNewJobDraft || activeJobId != null;

  return (
    <main className="employerJobsPage">
      <div className="employerJobsAmbient" aria-hidden="true" />
      <div className="employerJobsFrame fadeInUp">
        <header className="employerJobsHeader">
          <div className="employerJobsTopRow">
            <div className="employerJobsBackCell">
              <BackButton fallbackTo="/" />
            </div>
            <div className="employerJobsBrandCell">
              <Link
                to="/"
                className="authBrand authBrandLink"
                aria-label="SkillMesh — employer home"
                title="Employer home"
              >
                <img src={ldLogo} alt="" />
                <div>
                  <strong>SkillMesh</strong>
                  <small>Intelligent Talent Matching</small>
                </div>
              </Link>
            </div>
            <div className="employerJobsBackSpacer" aria-hidden="true" />
          </div>
          <h1 className="employerJobsTitle">Job listings</h1>
          <p className="employerJobsLead">
            Create and edit job posts here. Use the back arrow or SkillMesh logo to return to your employer homepage;
            open <Link className="employerJobsDashLink" to="/employer/applications">Applications received</Link> when you are
            ready to review applicants.
          </p>
        </header>

        {statusMsg && <p className="success employerJobsFlash">{statusMsg}</p>}
        {error && <p className="error employerJobsError">{error}</p>}

        {loading ? (
          <p className="muted employerJobsLoading">Loading your jobs…</p>
        ) : (
          <div className="employerJobsLayout">
            <aside className="employerJobsListCol" aria-label="Your job posts">
              <div className="employerJobsSidebarHead">
                <h2 className="employerJobsSidebarTitle">Your listings</h2>
                {jobs.length > 0 ? <span className="employerJobsSidebarCount">{jobs.length}</span> : null}
              </div>
              <button type="button" className="modernBtn employerJobsNewBtn" onClick={startNewJob}>
                New job
              </button>
              {jobs.length === 0 ? (
                <p className="muted employerJobsEmptyList">
                  No listings yet. Use <strong>New job</strong> to publish your first role.
                </p>
              ) : (
                <ul className="employerJobsList">
                  {jobs.map((j) => {
                    const active = selectedListId != null && Number(selectedListId) === Number(j.id);
                    return (
                      <li key={j.id}>
                        <button
                          type="button"
                          className={`employerJobsListItem${active ? " employerJobsListItemActive" : ""}`}
                          onClick={() => openJob(j.id)}
                        >
                          <span className="employerJobsListTitle">
                            {(j.title || "").trim() || "Untitled draft"}
                          </span>
                          <span className="employerJobsListMeta">
                            {formatWorkModeLabel(j.work_mode)}
                            {j.location ? ` · ${j.location}` : ""}
                          </span>
                          <span className="employerJobsListFooter">
                            <span className="employerJobsStatusPill">{statusLabel(j.status)}</span>
                            <span className="employerJobsListDate">{formatPostedShort(j.created_at)}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>

            <section className="employerJobsEditorCol" aria-label="Job editor">
              {!editorOpen ? (
                <div className="employerJobsPlaceholder">
                  <button
                    type="button"
                    className="employerJobsPlaceholderIcon employerJobsPlaceholderNewBtn"
                    onClick={startNewJob}
                    aria-label="Start a new job"
                  >
                    +
                  </button>
                  <p className="employerJobsPlaceholderTitle">Select a job or start a new one</p>
                  <p className="muted">
                    Choose a listing on the left to edit it, or click{" "}
                    <button type="button" className="employerJobsPlaceholderInlineNew" onClick={startNewJob}>
                      New job
                    </button>{" "}
                    to create a listing.
                  </p>
                </div>
              ) : (
                <>
                  <div className="employerJobsEditorScroll">
                    <div className="employerJobsEditorHead">
                      <h2 className="employerJobsEditorTitle">{isNewJobDraft ? "New job" : "Edit job"}</h2>
                      <button type="button" className="employerJobsGhostBtn" onClick={closeEditor}>
                        Close
                      </button>
                    </div>

                    <div className="employerJobsFields">
                      <section className="employerJobsFormSection" aria-labelledby="ej-sec-overview">
                        <h3 className="employerJobsFormSectionTitle" id="ej-sec-overview">
                          Role overview
                        </h3>
                    <div className="employerJobsRow2">
                      <div className="employerJobsField">
                        <label className="employerJobsLabel" htmlFor="ej-title">
                          Title
                        </label>
                        <input
                          id="ej-title"
                          className={fieldErrors.title ? "authInput authInputHasError" : "authInput"}
                          placeholder="e.g. Senior Backend Engineer"
                          value={jobForm.title}
                          aria-invalid={!!fieldErrors.title}
                          aria-describedby={fieldErrors.title ? "ej-title-err" : undefined}
                          onChange={(e) => {
                            clearJobFieldError("title");
                            setJobForm({ ...jobForm, title: e.target.value });
                          }}
                        />
                        {fieldErrors.title && (
                          <p className="fieldErrorHint" id="ej-title-err" role="alert">
                            {fieldErrors.title}
                          </p>
                        )}
                      </div>
                      <div className="employerJobsField">
                        <label className="employerJobsLabel" htmlFor="ej-category">
                          Category
                        </label>
                        <div className="authSelectWrap">
                          <select
                            id="ej-category"
                            className={
                              fieldErrors.job_category_id ? "authInput authSelect authInputHasError" : "authInput authSelect"
                            }
                            value={jobForm.job_category_id}
                            aria-invalid={!!fieldErrors.job_category_id}
                            aria-describedby={fieldErrors.job_category_id ? "ej-category-err" : undefined}
                            onChange={(e) => {
                              clearJobFieldError("job_category_id");
                              setJobForm({ ...jobForm, job_category_id: e.target.value });
                            }}
                          >
                            <option value="">Uncategorised</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={String(cat.id)}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        {fieldErrors.job_category_id && (
                          <p className="fieldErrorHint" id="ej-category-err" role="alert">
                            {fieldErrors.job_category_id}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="employerJobsField">
                      <label className="employerJobsLabel" htmlFor="ej-location">
                        Location
                      </label>
                      <input
                        id="ej-location"
                        className={fieldErrors.location ? "authInput authInputHasError" : "authInput"}
                        placeholder="City, region, or Remote"
                        value={jobForm.location}
                        aria-invalid={!!fieldErrors.location}
                        aria-describedby={fieldErrors.location ? "ej-location-err" : undefined}
                        onChange={(e) => {
                          clearJobFieldError("location");
                          setJobForm({ ...jobForm, location: e.target.value });
                        }}
                      />
                      {fieldErrors.location && (
                        <p className="fieldErrorHint" id="ej-location-err" role="alert">
                          {fieldErrors.location}
                        </p>
                      )}
                    </div>
                      </section>

                      <section className="employerJobsFormSection" aria-labelledby="ej-sec-workplace">
                        <h3 className="employerJobsFormSectionTitle" id="ej-sec-workplace">
                          Requirements &amp; workplace
                        </h3>
                    <div className="employerJobsRow2">
                      <div className="employerJobsField">
                        <label className="employerJobsLabel" htmlFor="ej-education">
                          Required education
                        </label>
                        <input
                          id="ej-education"
                          className={fieldErrors.required_education ? "authInput authInputHasError" : "authInput"}
                          placeholder="e.g. Bachelor’s in CS"
                          value={jobForm.required_education}
                          aria-invalid={!!fieldErrors.required_education}
                          aria-describedby={fieldErrors.required_education ? "ej-education-err" : undefined}
                          onChange={(e) => {
                            clearJobFieldError("required_education");
                            setJobForm({ ...jobForm, required_education: e.target.value });
                          }}
                        />
                        {fieldErrors.required_education && (
                          <p className="fieldErrorHint" id="ej-education-err" role="alert">
                            {fieldErrors.required_education}
                          </p>
                        )}
                      </div>
                      <div className="employerJobsField">
                        <label className="employerJobsLabel" htmlFor="ej-exp">
                          Min. experience (years)
                        </label>
                        <input
                          id="ej-exp"
                          className={`employerJobsNumberPlain ${fieldErrors.required_experience ? "authInput authInputHasError" : "authInput"}`}
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={jobForm.required_experience}
                          aria-invalid={!!fieldErrors.required_experience}
                          aria-describedby={fieldErrors.required_experience ? "ej-exp-err" : undefined}
                          onChange={(e) => {
                            clearJobFieldError("required_experience");
                            setJobForm({ ...jobForm, required_experience: e.target.value });
                          }}
                        />
                        {fieldErrors.required_experience && (
                          <p className="fieldErrorHint" id="ej-exp-err" role="alert">
                            {fieldErrors.required_experience}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="employerJobsRow2">
                      <div className="employerJobsField">
                        <label className="employerJobsLabel" htmlFor="ej-mode">
                          Work mode
                        </label>
                        <div className="authSelectWrap">
                          <select
                            id="ej-mode"
                            className={
                              fieldErrors.work_mode ? "authInput authSelect authInputHasError" : "authInput authSelect"
                            }
                            value={jobForm.work_mode}
                            aria-invalid={!!fieldErrors.work_mode}
                            aria-describedby={fieldErrors.work_mode ? "ej-mode-err" : undefined}
                            onChange={(e) => {
                              clearJobFieldError("work_mode");
                              setJobForm({ ...jobForm, work_mode: e.target.value });
                            }}
                          >
                            <option value="onsite">On-site</option>
                            <option value="remote">Remote</option>
                            <option value="hybrid">Hybrid</option>
                          </select>
                        </div>
                        {fieldErrors.work_mode && (
                          <p className="fieldErrorHint" id="ej-mode-err" role="alert">
                            {fieldErrors.work_mode}
                          </p>
                        )}
                      </div>
                      <div className="employerJobsField">
                        <label className="employerJobsLabel" htmlFor="ej-status">
                          Status
                        </label>
                        <div className="authSelectWrap">
                          <select
                            id="ej-status"
                            className={
                              fieldErrors.status ? "authInput authSelect authInputHasError" : "authInput authSelect"
                            }
                            value={jobForm.status}
                            aria-invalid={!!fieldErrors.status}
                            aria-describedby={fieldErrors.status ? "ej-status-err" : undefined}
                            onChange={(e) => {
                              clearJobFieldError("status");
                              setJobForm({ ...jobForm, status: e.target.value });
                            }}
                          >
                            <option value="draft">Draft</option>
                            <option value="open">Open</option>
                            <option value="closed">Closed</option>
                          </select>
                        </div>
                        {fieldErrors.status && (
                          <p className="fieldErrorHint" id="ej-status-err" role="alert">
                            {fieldErrors.status}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="employerJobsField employerJobsClosingDateField">
                      <SiteDatePicker
                        variant="closing"
                        label="Job closing date"
                        value={jobForm.closing_date || ""}
                        onChange={(v) => {
                          clearJobFieldError("closing_date");
                          setJobForm({ ...jobForm, closing_date: v });
                        }}
                        slotProps={{
                          textField: {
                            id: "ej-closing-date",
                            error: !!fieldErrors.closing_date,
                            helperText:
                              fieldErrors.closing_date ||
                              "Optional. Open listings disappear from the public site after this day (or sooner if status is Closed).",
                          },
                        }}
                      />
                    </div>
                      </section>

                      <section className="employerJobsFormSection" aria-labelledby="ej-sec-pay">
                        <h3 className="employerJobsFormSectionTitle" id="ej-sec-pay">
                          Pay
                        </h3>
                    <div className="employerJobsRow2">
                      <div className="employerJobsField">
                        <label className="employerJobsLabel" htmlFor="ej-comp-period">
                          Pay period
                        </label>
                        <div className="authSelectWrap">
                          <select
                            id="ej-comp-period"
                            className={
                              fieldErrors.compensation_period
                                ? "authInput authSelect authInputHasError"
                                : "authInput authSelect"
                            }
                            value={jobForm.compensation_period}
                            aria-invalid={!!fieldErrors.compensation_period}
                            aria-describedby={fieldErrors.compensation_period ? "ej-comp-period-err" : undefined}
                            onChange={(e) => {
                              clearJobFieldError("compensation_period");
                              setJobForm({ ...jobForm, compensation_period: e.target.value });
                            }}
                          >
                            <option value="not_specified">Not specified</option>
                            <option value="hourly">Hourly</option>
                            <option value="yearly">Yearly (salary)</option>
                            <option value="monthly">Monthly</option>
                            <option value="daily">Daily</option>
                          </select>
                        </div>
                        {fieldErrors.compensation_period && (
                          <p className="fieldErrorHint" id="ej-comp-period-err" role="alert">
                            {fieldErrors.compensation_period}
                          </p>
                        )}
                      </div>
                      <div className="employerJobsField">
                        <span className="employerJobsLabel">Amount range (optional)</span>
                        <div className="employerJobsPayRangeRow">
                          <div>
                            <label className="employerJobsSrOnly" htmlFor="ej-comp-min">
                              Minimum amount
                            </label>
                            <input
                              id="ej-comp-min"
                              className={`employerJobsNumberPlain ${
                                fieldErrors.compensation_amount_min ? "authInput authInputHasError" : "authInput"
                              }`}
                              type="number"
                              min={0}
                              step="0.01"
                              inputMode="decimal"
                              placeholder="Min"
                              value={jobForm.compensation_amount_min}
                              aria-invalid={!!fieldErrors.compensation_amount_min}
                              aria-describedby={
                                fieldErrors.compensation_amount_min ? "ej-comp-min-err" : undefined
                              }
                              onChange={(e) => {
                                clearJobFieldError("compensation_amount_min");
                                setJobForm({ ...jobForm, compensation_amount_min: e.target.value });
                              }}
                            />
                            {fieldErrors.compensation_amount_min && (
                              <p className="fieldErrorHint" id="ej-comp-min-err" role="alert">
                                {fieldErrors.compensation_amount_min}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="employerJobsSrOnly" htmlFor="ej-comp-max">
                              Maximum amount
                            </label>
                            <input
                              id="ej-comp-max"
                              className={`employerJobsNumberPlain ${
                                fieldErrors.compensation_amount_max ? "authInput authInputHasError" : "authInput"
                              }`}
                              type="number"
                              min={0}
                              step="0.01"
                              inputMode="decimal"
                              placeholder="Max"
                              value={jobForm.compensation_amount_max}
                              aria-invalid={!!fieldErrors.compensation_amount_max}
                              aria-describedby={
                                fieldErrors.compensation_amount_max ? "ej-comp-max-err" : undefined
                              }
                              onChange={(e) => {
                                clearJobFieldError("compensation_amount_max");
                                setJobForm({ ...jobForm, compensation_amount_max: e.target.value });
                              }}
                            />
                            {fieldErrors.compensation_amount_max && (
                              <p className="fieldErrorHint" id="ej-comp-max-err" role="alert">
                                {fieldErrors.compensation_amount_max}
                              </p>
                            )}
                          </div>
                        </div>
                        <p className="employerJobsFieldHint muted">
                          Optional numbers only — currency matches how you hire (e.g. AUD). Leave blank if undisclosed.
                        </p>
                      </div>
                    </div>
                      </section>

                      <section className="employerJobsFormSection" aria-labelledby="ej-sec-desc">
                        <h3 className="employerJobsFormSectionTitle" id="ej-sec-desc">
                          Role description &amp; skills
                        </h3>
                        <p className="employerJobsSectionIntro muted">
                          A clear overview plus structured sections help candidates scan the post and decide to apply.
                        </p>
                    <div className="employerJobsField">
                      <label className="employerJobsLabel" htmlFor="ej-jd">
                        Overview
                      </label>
                      <p className="employerJobsFieldHint muted">
                        Set the scene: your team, the mission, and why this role exists. Keep it concise; use the sections
                        below for lists and detail.
                      </p>
                      <textarea
                        id="ej-jd"
                        className={
                          fieldErrors.jd_text
                            ? "authInput employerJobsTextarea authInputHasError"
                            : "authInput employerJobsTextarea"
                        }
                        rows={6}
                        placeholder="e.g. We’re growing our product team in Sydney. You’ll work with design and engineering to ship features used by thousands of learners…"
                        value={jobForm.jd_text}
                        aria-invalid={!!fieldErrors.jd_text}
                        aria-describedby={fieldErrors.jd_text ? "ej-jd-err" : undefined}
                        onChange={(e) => {
                          clearJobFieldError("jd_text");
                          setJobForm({ ...jobForm, jd_text: e.target.value });
                        }}
                      />
                      {fieldErrors.jd_text && (
                        <p className="fieldErrorHint" id="ej-jd-err" role="alert">
                          {fieldErrors.jd_text}
                        </p>
                      )}
                    </div>

                    <div className="employerJobsField">
                      <span className="employerJobsLabel" id="ej-offers-label">
                        What&apos;s on offer
                      </span>
                      <p className="employerJobsFieldHint muted">
                        Add a bullet for each benefit or perk (salary range if you publish it, leave, flexibility,
                        learning budget, etc.).
                      </p>
                      <ul className="employerJobsOfferList">
                        {(jobForm.whats_on_offer || []).map((line, i) => (
                          <li key={`offer-${i}`} className="employerJobsOfferRow">
                            <label className="employerJobsSrOnly" htmlFor={`ej-offer-${i}`}>
                              Offer bullet {i + 1}
                            </label>
                            <input
                              id={`ej-offer-${i}`}
                              className="authInput"
                              value={line}
                              placeholder="e.g. Hybrid work — 2 days in office"
                              aria-labelledby="ej-offers-label"
                              onChange={(e) => {
                                const next = [...(jobForm.whats_on_offer || [])];
                                next[i] = e.target.value;
                                setJobForm({ ...jobForm, whats_on_offer: next });
                              }}
                            />
                            <button
                              type="button"
                              className="employerJobsGhostBtn employerJobsOfferRemove"
                              aria-label={`Remove offer line ${i + 1}`}
                              onClick={() => {
                                const next = (jobForm.whats_on_offer || []).filter((_, j) => j !== i);
                                setJobForm({ ...jobForm, whats_on_offer: next });
                              }}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className="employerJobsAddBulletBtn"
                        onClick={() =>
                          setJobForm({
                            ...jobForm,
                            whats_on_offer: [...(jobForm.whats_on_offer || []), ""],
                          })
                        }
                      >
                        + Add bullet
                      </button>
                    </div>

                    <div className="employerJobsField employerJobsFieldMacro">
                      <span className="employerJobsLabel">What we&apos;re looking for</span>
                      <p className="employerJobsFieldHint muted">
                        Short bullets read best on the public listing. Put people and ways of working first; add any
                        practical details in the second list if you like.
                      </p>
                      <EmployerBulletBlock
                        idPrefix="ej-lfp"
                        hint="Qualities, mindset, collaboration style — one bullet per line."
                        lines={jobForm.looking_for_people_bullets}
                        onChange={(next) => setJobForm({ ...jobForm, looking_for_people_bullets: next })}
                      />
                      <EmployerBulletBlock
                        idPrefix="ej-lfa"
                        hint="Optional second list — logistics, tools, or context (one bullet per line)."
                        lines={jobForm.looking_for_additional_bullets}
                        onChange={(next) => setJobForm({ ...jobForm, looking_for_additional_bullets: next })}
                      />
                    </div>

                    <div className="employerJobsField">
                      <span className="employerJobsLabel">The role</span>
                      <p className="employerJobsFieldHint muted">
                        Concrete tasks and day-to-day activities — one bullet per line.
                      </p>
                      <EmployerBulletBlock
                        idPrefix="ej-roleb"
                        hint="What a typical day or week involves."
                        lines={jobForm.role_bullets}
                        onChange={(next) => setJobForm({ ...jobForm, role_bullets: next })}
                      />
                    </div>

                    <div className="employerJobsField">
                      <span className="employerJobsLabel">Why choose us</span>
                      <p className="employerJobsFieldHint muted">
                        Culture, mission, accreditation, training, or what makes your organisation a strong place to
                        work — one bullet per point.
                      </p>
                      <EmployerBulletBlock
                        idPrefix="ej-why"
                        hint="Optional; leave empty if you prefer not to include this block."
                        lines={jobForm.why_choose_us_bullets}
                        onChange={(next) => setJobForm({ ...jobForm, why_choose_us_bullets: next })}
                      />
                    </div>

                    <div className="employerJobsField">
                      <label className="employerJobsLabel" htmlFor="ej-apply">
                        How to apply
                      </label>
                      <p className="employerJobsFieldHint muted">
                        Tell candidates what to send, any links, and what happens next. They can also use the Apply
                        button on SkillMesh.
                      </p>
                      <textarea
                        id="ej-apply"
                        className="authInput employerJobsTextarea"
                        rows={4}
                        placeholder="e.g. Submit your CV and a short note on why this role fits. We’ll reply within 5 business days…"
                        value={jobForm.how_to_apply}
                        onChange={(e) => setJobForm({ ...jobForm, how_to_apply: e.target.value })}
                      />
                    </div>

                    <div
                      className={`employerJobsField${fieldErrors.skills ? " employerJobsFieldInvalid" : ""}`}
                      id="ej-skills"
                      tabIndex={fieldErrors.skills ? -1 : undefined}
                      aria-invalid={!!fieldErrors.skills}
                      aria-describedby={fieldErrors.skills ? "ej-skills-err" : undefined}
                    >
                      <span className="employerJobsLabel" id="ej-skills-label">
                        Skills
                      </span>
                      <p className="employerJobsFieldHint muted">
                        Start typing — suggestions combine job data, the ESCO skill API, and common tags.
                      </p>
                      <div className="employerJobsSkillSuggestWrap" ref={jobSkillSuggestRef}>
                        <div className="employerJobsSkillRow">
                          <input
                            id="ej-skill-input"
                            className="authInput"
                            placeholder="e.g. Python, Project management…"
                            value={jobSkillInput}
                            autoComplete="off"
                            aria-labelledby="ej-skills-label"
                            aria-autocomplete="list"
                            aria-expanded={jobSkillSuggestions.length > 0}
                            aria-controls="ej-skill-suggest-list"
                            onChange={(e) => {
                              clearJobFieldError("skills");
                              setJobSkillInput(e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addJobSkill();
                              }
                            }}
                          />
                          <button type="button" className="modernBtn employerJobsSkillAdd" onClick={() => addJobSkill()}>
                            Add
                          </button>
                        </div>
                        {jobSkillSuggestions.length > 0 && (
                          <ul className="employerJobsSuggestList" id="ej-skill-suggest-list" role="listbox">
                            {jobSkillSuggestions.map((s) => (
                              <li key={s.skill_name} role="option">
                                <button
                                  type="button"
                                  className="employerJobsSuggestItem"
                                  onClick={() => addJobSkill(s.skill_name)}
                                >
                                  {s.skill_name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="chipWrap employerJobsChips">
                        {(jobForm.skills || []).map((s, i) => (
                          <span className="chip employerJobsChip" key={`${s.skill_name}-${i}`}>
                            {s.skill_name}
                            <button
                              type="button"
                              className="employerJobsChipRemove"
                              aria-label={`Remove ${s.skill_name}`}
                              onClick={() => removeSkillAt(i)}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      {fieldErrors.skills && (
                        <p className="fieldErrorHint" id="ej-skills-err" role="alert">
                          {fieldErrors.skills}
                        </p>
                      )}
                    </div>
                      </section>
                    </div>
                  </div>

                  <div className="employerJobsStickyActions">
                    <button
                      type="button"
                      className="employerJobsGhostBtn employerJobsDraftBtn"
                      disabled={saving}
                      onClick={() => saveJob({ asDraft: true })}
                    >
                      Save as draft
                    </button>
                    <button
                      type="button"
                      className="modernBtn employerJobsSaveBtn"
                      disabled={saving}
                      onClick={() => saveJob()}
                    >
                      {saving ? "Saving…" : isNewJobDraft ? "Publish job" : "Save changes"}
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
