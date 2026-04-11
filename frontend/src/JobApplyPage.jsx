import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiBlob } from "./api";
import { formatApiError } from "./apiErrors";
import { useAuth } from "./auth";
import { CandidateMemberHeader } from "./CandidateMemberHeader";
import { SiteBrandBar } from "./SiteBrandBar";
import { formatCompensationSummary, formatPostedShort, formatWorkModeLabel } from "./jobFormatters";

const COVER_NONE = "none";
const COVER_IN_APP = "in_app";
const COVER_UPLOAD = "upload";

export function JobApplyPage() {
  const { jobId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const idNum = Number(jobId);
  const validId = Number.isInteger(idNum) && idNum > 0;

  const [job, setJob] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const [coverMode, setCoverMode] = useState(COVER_NONE);
  const [coverText, setCoverText] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [dragResume, setDragResume] = useState(false);
  const [dragCover, setDragCover] = useState(false);
  const [resumePreview, setResumePreview] = useState(null);
  const [resumePreviewLoading, setResumePreviewLoading] = useState(false);
  const [coverBlobUrl, setCoverBlobUrl] = useState(null);
  const resumePreviewUrlRef = useRef(null);

  const showCandidateHeader =
    user?.role === "candidate" && user?.candidate_onboarding?.onboarding_step === "done";

  useEffect(() => {
    if (!coverFile) {
      setCoverBlobUrl(null);
      return undefined;
    }
    const u = URL.createObjectURL(coverFile);
    setCoverBlobUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [coverFile]);

  function classifyResumeBlob(blob, filenameHint) {
    const mime = (blob.type || "").toLowerCase();
    const fn = (filenameHint || "").toLowerCase();
    if (mime.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(fn)) {
      return { isImage: true, isPdf: false, isUnsupported: false };
    }
    if (mime === "application/pdf" || fn.endsWith(".pdf")) {
      return { isImage: false, isPdf: true, isUnsupported: false };
    }
    if (mime.includes("word") || mime.includes("officedocument") || fn.endsWith(".docx") || fn.endsWith(".doc")) {
      return { isImage: false, isPdf: false, isUnsupported: true };
    }
    return { isImage: false, isPdf: false, isUnsupported: true };
  }

  const closeResumePreview = useCallback(() => {
    setResumePreview((prev) => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });
  }, []);

  const openResumePreviewForId = useCallback(async (resumeId, nameHint, filenameHint) => {
    if (!resumeId) return;
    setResumePreviewLoading(true);
    setFormError("");
    try {
      const blob = await apiBlob(`/api/candidates/resume/${resumeId}/download/`);
      const name = (nameHint || "").trim() || "Resume";
      const flags = classifyResumeBlob(blob, filenameHint || name);
      const blobUrl = URL.createObjectURL(blob);
      setResumePreview((prev) => {
        if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
        return { blobUrl, name, ...flags };
      });
    } catch (e) {
      setFormError(formatApiError(e) || String(e.message || e) || "Could not load resume preview.");
    } finally {
      setResumePreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    resumePreviewUrlRef.current = resumePreview?.blobUrl ?? null;
  }, [resumePreview?.blobUrl]);

  useEffect(() => {
    return () => {
      if (resumePreviewUrlRef.current) {
        URL.revokeObjectURL(resumePreviewUrlRef.current);
        resumePreviewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!validId) return undefined;
    let cancelled = false;
    (async () => {
      setLoadError("");
      setJob(null);
      try {
        const data = await api(`/api/jobs/${idNum}/`, { withAuth: false });
        if (!cancelled) setJob(data);
      } catch {
        if (!cancelled) setLoadError("This job is not available or has been closed.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [validId, idNum]);

  const loadResumes = useCallback(async () => {
    try {
      const rows = await api("/api/candidates/resume/");
      const list = Array.isArray(rows) ? rows : [];
      setResumes(list);
      setSelectedResumeId((prev) => {
        if (prev && list.some((r) => r.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch {
      setResumes([]);
      setSelectedResumeId(null);
    }
  }, []);

  useEffect(() => {
    if (!user || user.role !== "candidate") return undefined;
    loadResumes();
    return undefined;
  }, [user, loadResumes]);

  useEffect(() => {
    if (!user || user.role !== "candidate") return undefined;
    let alive = true;
    (async () => {
      try {
        const apps = await api("/api/applications/");
        if (!alive || !Array.isArray(apps)) return;
        if (apps.some((a) => a.job === idNum)) {
          navigate(`/jobs/${idNum}`, { replace: true, state: { alreadyApplied: true } });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, idNum, navigate]);

  async function onResumeFileInput(file) {
    if (!file || !user) return;
    setUploadingResume(true);
    setFormError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const nameStem = (file.name || "Resume").replace(/\.[^.]+$/, "");
      fd.append("display_name", nameStem.slice(0, 240));
      const created = await api("/api/candidates/resume/upload", {
        method: "POST",
        body: fd,
      });
      await loadResumes();
      if (created?.id) {
        setSelectedResumeId(created.id);
        const hint = (created.display_name || nameStem || "").trim();
        await openResumePreviewForId(created.id, hint, file.name);
      }
    } catch (e) {
      setFormError(formatApiError(e) || String(e.message || e) || "Could not upload resume.");
    } finally {
      setUploadingResume(false);
    }
  }

  function pickCoverLetterFile(file) {
    if (!file) return;
    const lower = (file.name || "").toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) {
      setFormError("Cover letter must be a PDF or DOCX file.");
      return;
    }
    setFormError("");
    setCoverFile(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (!selectedResumeId) {
      setFormError("Select a resume or upload a new one.");
      return;
    }
    if (coverMode === COVER_IN_APP && !(coverText || "").trim()) {
      setFormError("Write a cover letter or choose another cover letter option.");
      return;
    }
    if (coverMode === COVER_UPLOAD && !coverFile) {
      setFormError("Choose a cover letter PDF or DOCX to upload.");
      return;
    }
    setSubmitBusy(true);
    try {
      const fd = new FormData();
      fd.append("job", String(idNum));
      fd.append("resume", String(selectedResumeId));
      fd.append("cover_letter_mode", coverMode);
      if (coverMode === COVER_IN_APP) {
        fd.append("cover_letter_text", coverText.trim());
      }
      if (coverMode === COVER_UPLOAD && coverFile) {
        fd.append("cover_letter", coverFile);
      }
      await api("/api/applications/", { method: "POST", body: fd });
      navigate(`/jobs/${idNum}`, { replace: false, state: { applicationSubmitted: true } });
    } catch (e) {
      const msg = formatApiError(e) || String(e.message || e) || "Could not submit application.";
      setFormError(msg);
    } finally {
      setSubmitBusy(false);
    }
  }

  if (authLoading && !validId) {
    return <p className="jobPublicLoading">Loading…</p>;
  }

  if (user?.role === "candidate" && user?.candidate_onboarding?.onboarding_step === "resume") {
    return <Navigate to="/onboarding/work-experience" replace />;
  }
  if (user?.role === "candidate" && user?.candidate_onboarding?.onboarding_step === "categories") {
    return <Navigate to="/onboarding/categories" replace />;
  }

  if (!user) {
    return <Navigate to={`/login?next=/jobs/${idNum}/apply`} replace />;
  }
  if (user.role !== "candidate") {
    return (
      <main className="jobApplyPage">
        <p className="error jobApplyPageInner">Only candidate accounts can apply.</p>
        <Link to={`/jobs/${idNum}`}>Back to job</Link>
      </main>
    );
  }

  if (user.candidate_onboarding?.onboarding_step !== "done") {
    return <Navigate to="/onboarding/work-experience" replace />;
  }

  if (!validId) {
    return (
      <main className="jobApplyPage">
        <p className="error jobApplyPageInner">Invalid job link.</p>
        <Link to="/">Home</Link>
      </main>
    );
  }

  const payLine = job ? formatCompensationSummary(job) : "";

  return (
    <main className="jobApplyPage">
      {showCandidateHeader ? <CandidateMemberHeader /> : null}
      <header className="jobApplyPageHeader">
        <SiteBrandBar leadClassName="jobApplyPageHeaderLead" fallbackTo={validId ? `/jobs/${idNum}` : "/"} />
      </header>

      <div className="jobApplyPageInner">
        <nav className="jobDetailBreadcrumb jobApplyBreadcrumb" aria-label="Breadcrumb">
          <Link to="/">Jobs</Link>
          <span className="jobDetailBreadcrumbSep" aria-hidden="true">
            /
          </span>
          <Link to={`/jobs/${idNum}`}>{job?.title?.trim() || "Role"}</Link>
          <span className="jobDetailBreadcrumbSep" aria-hidden="true">
            /
          </span>
          <span className="jobDetailBreadcrumbCurrent">Apply</span>
        </nav>

        {loadError ? <p className="error">{loadError}</p> : null}
        {!loadError && !job ? <p className="muted">Loading…</p> : null}

        {job ? (
          <div className="jobApplyLayout">
            <aside className="jobApplySummary card">
              <p className="jobApplySummaryEyebrow">You are applying to</p>
              <h1 className="jobApplySummaryTitle">{job.title}</h1>
              <p className="jobApplySummarySub">{job.company_info || "Employer"}</p>
              <div className="jobApplySummaryTags">
                <span>{job.location || "—"}</span>
                <span>{formatWorkModeLabel(job.work_mode)}</span>
                {job.job_category?.name ? <span>{job.job_category.name}</span> : null}
              </div>
              {payLine ? <p className="jobApplyPay">{payLine}</p> : null}
              {job.created_at ? (
                <p className="jobApplyPosted muted">Posted {formatPostedShort(job.created_at)}</p>
              ) : null}
            </aside>

            <form className="jobApplyForm card" onSubmit={handleSubmit}>
              <h2 className="jobApplyFormTitle">Application materials</h2>
              <p className="jobApplyFormLead muted">
                Choose the resume this employer should see for this role. You can upload a tailored version without
                changing your profile default.
              </p>

              <section className="jobApplySection" aria-labelledby="apply-resume-heading">
                <h3 id="apply-resume-heading" className="jobApplySectionTitle">
                  Resume
                </h3>
                <div
                  className={`jobApplyDropzone ${dragResume ? "jobApplyDropzoneActive" : ""}`}
                  onDragOver={(ev) => {
                    ev.preventDefault();
                    setDragResume(true);
                  }}
                  onDragLeave={() => setDragResume(false)}
                  onDrop={(ev) => {
                    ev.preventDefault();
                    setDragResume(false);
                    const f = ev.dataTransfer.files?.[0];
                    if (f) onResumeFileInput(f);
                  }}
                >
                  <p>Drop a file here, or</p>
                  <label className="jobApplyFileLabel">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      className="jobApplyFileInput"
                      disabled={uploadingResume}
                      onChange={(ev) => {
                        const f = ev.target.files?.[0];
                        if (f) onResumeFileInput(f);
                        ev.target.value = "";
                      }}
                    />
                    <span className="jobApplyBtnSecondary">{uploadingResume ? "Uploading…" : "Browse files"}</span>
                  </label>
                  <p className="jobApplyDropHint muted">PDF, DOCX, or image — same formats as your profile.</p>
                </div>

                {resumes.length === 0 ? (
                  <p className="jobApplyHint muted">Upload a resume to continue.</p>
                ) : (
                  <>
                    <ul className="jobApplyResumeList">
                      {resumes.map((r) => (
                        <li key={r.id}>
                          <label className="jobApplyResumeRow">
                            <input
                              type="radio"
                              name="resumePick"
                              checked={selectedResumeId === r.id}
                              onChange={() => setSelectedResumeId(r.id)}
                            />
                            <span className="jobApplyResumeName">{r.display_name || `Resume #${r.id}`}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <div className="jobApplyResumePreviewBar">
                      <button
                        type="button"
                        className="jobApplyBtnSecondary jobApplyPreviewBtn"
                        disabled={!selectedResumeId || resumePreviewLoading || uploadingResume}
                        onClick={() => {
                          const r = resumes.find((x) => x.id === selectedResumeId);
                          openResumePreviewForId(
                            selectedResumeId,
                            r?.display_name,
                            r?.stored_filename || "",
                          );
                        }}
                      >
                        {resumePreviewLoading ? "Opening preview…" : "Preview selected resume"}
                      </button>
                      <span className="muted jobApplyPreviewHint">PDF and images open in a viewer; Word files show file details only.</span>
                    </div>
                  </>
                )}
              </section>

              <section className="jobApplySection" aria-labelledby="apply-cover-heading">
                <h3 id="apply-cover-heading" className="jobApplySectionTitle">
                  Cover letter
                </h3>
                <div className="jobApplyCoverModes" role="radiogroup" aria-label="Cover letter option">
                  <label className={`jobApplyModeCard ${coverMode === COVER_NONE ? "jobApplyModeCardOn" : ""}`}>
                    <input
                      type="radio"
                      name="coverMode"
                      checked={coverMode === COVER_NONE}
                      onChange={() => {
                        setCoverMode(COVER_NONE);
                        setCoverFile(null);
                      }}
                    />
                    <span className="jobApplyModeTitle">Apply without cover letter</span>
                    <span className="jobApplyModeDesc muted">Optional — some roles only need your resume.</span>
                  </label>
                  <label className={`jobApplyModeCard ${coverMode === COVER_IN_APP ? "jobApplyModeCardOn" : ""}`}>
                    <input
                      type="radio"
                      name="coverMode"
                      checked={coverMode === COVER_IN_APP}
                      onChange={() => setCoverMode(COVER_IN_APP)}
                    />
                    <span className="jobApplyModeTitle">Write cover letter on SkillMesh</span>
                    <span className="jobApplyModeDesc muted">A short letter tailored to this role.</span>
                  </label>
                  <label className={`jobApplyModeCard ${coverMode === COVER_UPLOAD ? "jobApplyModeCardOn" : ""}`}>
                    <input
                      type="radio"
                      name="coverMode"
                      checked={coverMode === COVER_UPLOAD}
                      onChange={() => setCoverMode(COVER_UPLOAD)}
                    />
                    <span className="jobApplyModeTitle">Upload cover letter</span>
                    <span className="jobApplyModeDesc muted">PDF or DOCX.</span>
                  </label>
                </div>

                {coverMode === COVER_IN_APP ? (
                  <textarea
                    className="candidateDashTextarea jobApplyCoverTextarea"
                    rows={10}
                    placeholder="Introduce yourself and explain why you are a strong fit for this role."
                    value={coverText}
                    onChange={(e) => setCoverText(e.target.value)}
                    maxLength={12000}
                  />
                ) : null}

                {coverMode === COVER_UPLOAD ? (
                  <div className="jobApplyCoverUpload">
                    <div
                      className={`jobApplyDropzone jobApplyCoverDropzone ${dragCover ? "jobApplyDropzoneActive" : ""}`}
                      onDragOver={(ev) => {
                        ev.preventDefault();
                        setDragCover(true);
                      }}
                      onDragLeave={() => setDragCover(false)}
                      onDrop={(ev) => {
                        ev.preventDefault();
                        setDragCover(false);
                        const f = ev.dataTransfer.files?.[0];
                        if (f) pickCoverLetterFile(f);
                      }}
                    >
                      <p>Drop cover letter here, or</p>
                      <label className="jobApplyFileLabel">
                        <input
                          type="file"
                          accept=".pdf,.docx"
                          className="jobApplyFileInput"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) pickCoverLetterFile(f);
                            e.target.value = "";
                          }}
                        />
                        <span className="jobApplyBtnSecondary">Browse files</span>
                      </label>
                      <p className="jobApplyDropHint muted">PDF or DOCX only — same as employer requirements.</p>
                    </div>
                    {coverFile ? (
                      <div className="jobApplyCoverPicked">
                        <p className="jobApplyFilePicked">
                          Selected: <strong>{coverFile.name}</strong>{" "}
                          <button type="button" className="jobApplyCoverClear" onClick={() => setCoverFile(null)}>
                            Remove
                          </button>
                        </p>
                        {(coverFile.name || "").toLowerCase().endsWith(".pdf") && coverBlobUrl ? (
                          <div className="jobApplyCoverPreview">
                            <p className="jobApplyCoverPreviewLabel muted">Preview</p>
                            <iframe title="Cover letter preview" src={coverBlobUrl} className="jobApplyCoverPreviewFrame" />
                          </div>
                        ) : (
                          <p className="muted jobApplyCoverNoPreview">
                            Word documents can’t be previewed in the browser here. Employers still receive your file when
                            you submit.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>

              {formError ? <p className="error jobApplyFormError">{formError}</p> : null}

              <div className="jobApplyActions">
                <Link className="jobApplyBtnSecondary jobApplyCancel" to={`/jobs/${idNum}`}>
                  Cancel
                </Link>
                <button type="submit" className="jobsSeekApply jobApplySubmit" disabled={submitBusy || !selectedResumeId}>
                  {submitBusy ? "Submitting…" : "Submit application"}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>

      {resumePreview ? (
        <div className="resumeOverlay" onClick={closeResumePreview} role="presentation">
          <div className="resumePreviewModal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="apply-resume-preview-title">
            <div className="resumePreviewToolbar">
              <span className="resumePreviewName" id="apply-resume-preview-title">
                {resumePreview.name}
              </span>
              <button type="button" className="resumePreviewClose" onClick={closeResumePreview}>
                Close
              </button>
            </div>
            <div className="resumePreviewBody">
              {resumePreview.isUnsupported ? (
                <div className="jobApplyPreviewUnsupported">
                  <p>This format can’t be shown in the built-in viewer.</p>
                  <p className="muted">Your file is still attached for employers. PDFs and images preview below when supported.</p>
                </div>
              ) : resumePreview.isImage ? (
                <img src={resumePreview.blobUrl} alt="Resume preview" />
              ) : (
                <iframe src={resumePreview.blobUrl} title="Resume preview" />
              )}
            </div>
          </div>
        </div>
      ) : null}

      <footer className="jobsSeekFooter">
        © {new Date().getFullYear()} SkillMesh
        {user?.email ? ` · ${user.email}` : ""}
      </footer>
    </main>
  );
}
