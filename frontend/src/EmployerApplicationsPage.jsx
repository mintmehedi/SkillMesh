import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, apiBlob } from "./api";
import { useAuth } from "./auth";
import { formatWorkModeLabel } from "./jobFormatters";
import { SiteBrandBar } from "./SiteBrandBar";

export function EmployerApplicationsPage() {
  const { user, logout } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [jobFilter, setJobFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [resumePreviewUrl, setResumePreviewUrl] = useState("");
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");
  const [contactOpen, setContactOpen] = useState(false);

  const loadJobs = useCallback(async () => {
    try {
      const rows = await api("/api/employers/jobs");
      setJobs(Array.isArray(rows) ? rows : []);
    } catch {
      setJobs([]);
    }
  }, []);

  const loadApplications = useCallback(async () => {
    setListError("");
    setLoading(true);
    try {
      const q = jobFilter ? `?job=${encodeURIComponent(jobFilter)}` : "";
      const rows = await api(`/api/employers/applications${q}`);
      setApplications(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setListError(String(e.message || e) || "Could not load applications.");
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [jobFilter]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  useEffect(() => {
    return () => {
      if (resumePreviewUrl) URL.revokeObjectURL(resumePreviewUrl);
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    };
  }, [resumePreviewUrl, coverPreviewUrl]);

  const selectedSummary = useMemo(
    () => applications.find((a) => a.id === selectedId) || null,
    [applications, selectedId],
  );

  const loadDetail = useCallback(
    async (id) => {
      if (!id) {
        setDetail(null);
        return;
      }
      setDetailLoading(true);
      setDetailError("");
      setResumePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
      setCoverPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
      try {
        const d = await api(`/api/employers/applications/${id}`);
        setDetail(d);
        if (d?.resume?.download_path) {
          const blob = await apiBlob(d.resume.download_path);
          setResumePreviewUrl(URL.createObjectURL(blob));
        }
        if (d?.cover_letter?.download_path) {
          const blob = await apiBlob(d.cover_letter.download_path);
          setCoverPreviewUrl(URL.createObjectURL(blob));
        }
      } catch (e) {
        setDetail(null);
        setDetailError(String(e.message || e) || "Could not load application.");
      } finally {
        setDetailLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else {
      setDetail(null);
      setResumePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
      setCoverPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
    }
  }, [selectedId, loadDetail]);

  const contact = detail?.candidate_contact;

  return (
    <main className="employerJobsPage employerApplicationsPage">
      <div className="employerJobsAmbient" aria-hidden="true" />
      <div className="employerJobsFrame fadeInUp">
        <header className="employerJobsHeader">
          <div className="employerJobsHeaderBrandRow">
            <SiteBrandBar fallbackTo="/" />
          </div>
          <h1 className="employerJobsTitle">Applications</h1>
          <p className="employerJobsLead">
            Review candidates who applied through SkillMesh. Open a row to see their profile, the resume they used for
            this role, and cover letter materials.
          </p>
          <nav className="employerJobsSubnav" aria-label="Employer shortcuts">
            <Link className="employerJobsDashLink" to="/">
              Employer home
            </Link>
            <span className="employerJobsSubnavSep">·</span>
            <Link className="employerJobsDashLink" to="/employer/jobs">
              Job listings
            </Link>
            <span className="employerJobsSubnavSep">·</span>
            <Link className="employerJobsDashLink" to="/employer/company">
              Company profile
            </Link>
            {user?.email ? (
              <>
                <span className="employerJobsSubnavSep">·</span>
                <button type="button" className="employerApplicationsInlineLogout" onClick={() => logout?.()}>
                  Log out
                </button>
              </>
            ) : null}
          </nav>
        </header>

        <div className="employerApplicationsLayout">
          <section className="employerApplicationsListCard card" aria-labelledby="emp-apps-list-heading">
            <div className="employerApplicationsListHead">
              <h2 id="emp-apps-list-heading" className="employerApplicationsListTitle">
                Inbox
              </h2>
              <label className="employerApplicationsFilter">
                <span className="employerApplicationsFilterLabel">Filter by job</span>
                <select
                  className="employerJobsSelect employerApplicationsSelect"
                  value={jobFilter}
                  onChange={(e) => {
                    setJobFilter(e.target.value);
                    setSelectedId(null);
                  }}
                >
                  <option value="">All jobs</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={String(j.id)}>
                      {(j.title || "Untitled").slice(0, 80)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {listError ? <p className="error employerApplicationsBanner">{listError}</p> : null}
            {loading ? <p className="muted employerApplicationsBanner">Loading…</p> : null}
            {!loading && applications.length === 0 ? (
              <p className="employerApplicationsEmpty muted">No applications yet for this filter.</p>
            ) : (
              <ul className="employerApplicationsList">
                {applications.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className={`employerApplicationsRow ${selectedId === a.id ? "employerApplicationsRowOn" : ""}`}
                      onClick={() => setSelectedId(a.id)}
                    >
                      <span className="employerApplicationsRowTitle">{a.candidate_name}</span>
                      <span className="employerApplicationsRowJob">{a.job?.title || `Job #${a.job?.id}`}</span>
                      <span className="employerApplicationsRowMeta">
                        {a.created_at ? String(a.created_at).slice(0, 10) : "—"} · {a.cover_letter_mode?.replace("_", " ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="employerApplicationsDetailCard card" aria-live="polite">
            {!selectedId ? (
              <p className="employerApplicationsPick muted">Select an application to view details.</p>
            ) : detailLoading ? (
              <p className="muted employerApplicationsPick">Loading application…</p>
            ) : detailError ? (
              <p className="error employerApplicationsPick">{detailError}</p>
            ) : detail ? (
              <div className="employerApplicationsDetailInner">
                <div className="employerApplicationsDetailTop">
                  <div>
                    <h2 className="employerApplicationsDetailName">
                      {detail.candidate_profile?.full_name || selectedSummary?.candidate_name || "Candidate"}
                    </h2>
                    <p className="employerApplicationsDetailHeadline muted">
                      {detail.candidate_profile?.headline || "—"}
                    </p>
                    <p className="employerApplicationsDetailJobLine">
                      <strong>Applied to</strong> {detail.job?.title}{" "}
                      <span className="muted">
                        · {detail.job?.company_info || "—"} · {formatWorkModeLabel(detail.job?.work_mode)}
                      </span>
                    </p>
                  </div>
                  <button type="button" className="jobDetailPageBtnPrimary" onClick={() => setContactOpen(true)}>
                    Contact applicant
                  </button>
                </div>

                {detail.candidate_profile?.summary ? (
                  <div className="employerApplicationsBlock">
                    <h3 className="employerApplicationsBlockTitle">Summary</h3>
                    <p className="employerApplicationsProse">{detail.candidate_profile.summary}</p>
                  </div>
                ) : null}

                {Array.isArray(detail.candidate_profile?.skills) && detail.candidate_profile.skills.length > 0 ? (
                  <div className="employerApplicationsBlock">
                    <h3 className="employerApplicationsBlockTitle">Skills</h3>
                    <div className="jobsSeekSkillRow">
                      {detail.candidate_profile.skills.map((s) => (
                        <span className="jobsSeekSkillTag" key={s.id ?? s.skill_name}>
                          {s.skill_name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {Array.isArray(detail.candidate_profile?.work_experiences) &&
                detail.candidate_profile.work_experiences.length > 0 ? (
                  <div className="employerApplicationsBlock">
                    <h3 className="employerApplicationsBlockTitle">Experience</h3>
                    <ul className="employerApplicationsExpList">
                      {detail.candidate_profile.work_experiences.map((w) => (
                        <li key={w.id}>
                          <strong>{w.job_title}</strong> · {w.company_name}
                          <p className="muted employerApplicationsExpDesc">{w.description || "—"}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="employerApplicationsBlock">
                  <h3 className="employerApplicationsBlockTitle">Resume used for this application</h3>
                  {detail.resume ? (
                    <>
                      <p className="employerApplicationsFileMeta muted">{detail.resume.display_name}</p>
                      {resumePreviewUrl ? (
                        <div className="employerApplicationsPreviewFrame">
                          <iframe title="Resume preview" src={resumePreviewUrl} className="employerApplicationsPreview" />
                        </div>
                      ) : (
                        <p className="muted">Preview not available.</p>
                      )}
                    </>
                  ) : (
                    <p className="muted">No resume on file for this application (legacy submission).</p>
                  )}
                </div>

                <div className="employerApplicationsBlock">
                  <h3 className="employerApplicationsBlockTitle">Cover letter</h3>
                  {detail.cover_letter?.mode === "in_app" && (detail.cover_letter?.text || "").trim() ? (
                    <div className="employerApplicationsProse employerApplicationsCoverText">
                      {detail.cover_letter.text.split("\n").map((line, i) => (
                        <p key={i}>{line || "\u00a0"}</p>
                      ))}
                    </div>
                  ) : null}
                  {detail.cover_letter?.mode === "upload" && detail.cover_letter?.download_path ? (
                    coverPreviewUrl ? (
                      <div className="employerApplicationsPreviewFrame">
                        <iframe
                          title="Cover letter preview"
                          src={coverPreviewUrl}
                          className="employerApplicationsPreview"
                        />
                      </div>
                    ) : (
                      <p className="muted">Loading preview…</p>
                    )
                  ) : null}
                  {detail.cover_letter?.mode === "none" ? (
                    <p className="muted">Candidate applied without a cover letter.</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {contactOpen && contact ? (
        <div
          className="employerApplicationsModalBackdrop"
          role="presentation"
          onClick={() => setContactOpen(false)}
        >
          <div
            className="employerApplicationsModal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-applicant-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="contact-applicant-title" className="employerApplicationsModalTitle">
              Contact applicant
            </h2>
            <p className="employerApplicationsModalLead muted">
              Reach out using the details they associated with this application.
            </p>
            <dl className="employerApplicationsContactDl">
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${contact.email}`}>{contact.email || "—"}</a>
              </dd>
              <dt>Phone</dt>
              <dd>{contact.phone || "—"}</dd>
            </dl>
            <button type="button" className="jobDetailPageBtnSecondary employerApplicationsModalClose" onClick={() => setContactOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
