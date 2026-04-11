import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import { BackButton } from "./BackButton";
import { CandidateMemberHeader } from "./CandidateMemberHeader";
import { JobPostingDetailPanel } from "./JobPostingDetailPanel";
import { formatPostedShort } from "./jobFormatters";
import ldLogo from "./assets/ld.png";

function employerPreviewMessage(job) {
  if (!job) return "";
  const st = String(job.status || "").toLowerCase();
  if (st === "draft") {
    return "This listing is a draft — candidates cannot see it until you publish it from Job listings.";
  }
  if (st === "closed") {
    return "This listing is closed — it is not shown on the public job board.";
  }
  const cd = job.closing_date;
  if (cd) {
    const end = new Date(`${String(cd).slice(0, 10)}T12:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (end < today) {
      return "The closing date has passed — this role is hidden from public search until you update dates or reopen it.";
    }
  }
  return "You are viewing your listing as it appears when live on SkillMesh.";
}

export function JobDetailPage() {
  const { jobId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [applications, setApplications] = useState([]);
  const [applyBusy, setApplyBusy] = useState(false);
  const [flash, setFlash] = useState("");

  const idNum = Number(jobId);
  const validId = Number.isInteger(idNum) && idNum > 0;

  const showCandidateHeader =
    user?.role === "candidate" && user?.candidate_onboarding?.onboarding_step === "done";

  useEffect(() => {
    if (!validId) return undefined;
    let cancelled = false;
    (async () => {
      setLoadError("");
      setJob(null);
      setPreviewMode(false);
      let publicFailed = false;
      try {
        const data = await api(`/api/jobs/${idNum}/`, { withAuth: false });
        if (cancelled) return;
        setJob(data);
        return;
      } catch {
        publicFailed = true;
      }
      if (!publicFailed || cancelled) return;
      if (user?.role === "employer") {
        try {
          const data = await api(`/api/employers/jobs/${idNum}`);
          if (cancelled) return;
          setJob(data);
          setPreviewMode(true);
        } catch {
          if (!cancelled) {
            setLoadError("We could not load this job. It may belong to another employer account.");
          }
        }
        return;
      }
      if (authLoading) {
        return;
      }
      if (!cancelled) {
        setLoadError("This job is not available or has been closed.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [validId, idNum, user?.role, authLoading, user]);

  useEffect(() => {
    if (!job?.title) return undefined;
    const prev = document.title;
    document.title = `${job.title} · SkillMesh`;
    return () => {
      document.title = prev;
    };
  }, [job?.title]);

  useEffect(() => {
    if (!user || user.role !== "candidate") {
      setApplications([]);
      return undefined;
    }
    let alive = true;
    (async () => {
      try {
        const apps = await api("/api/applications/");
        if (alive && Array.isArray(apps)) setApplications(apps);
      } catch {
        if (alive) setApplications([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const hasApplied = useMemo(
    () => applications.some((a) => a.job === idNum),
    [applications, idNum],
  );

  const handleApply = useCallback(async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (user.role !== "candidate") {
      setFlash("Only candidate accounts can apply to jobs.");
      return;
    }
    if (user.candidate_onboarding?.onboarding_step !== "done") {
      navigate("/onboarding/work-experience");
      return;
    }
    setApplyBusy(true);
    setFlash("");
    try {
      await api("/api/applications/", {
        method: "POST",
        body: JSON.stringify({ job: idNum }),
      });
      setFlash("Application sent.");
      const apps = await api("/api/applications/");
      setApplications(Array.isArray(apps) ? apps : []);
    } catch (e) {
      setFlash(String(e.message || e) || "Could not apply.");
    } finally {
      setApplyBusy(false);
    }
  }, [user, navigate, idNum]);

  if (authLoading && !validId) {
    return <p className="jobPublicLoading">Loading…</p>;
  }

  if (user?.role === "candidate" && user?.candidate_onboarding?.onboarding_step === "resume") {
    return <Navigate to="/onboarding/work-experience" replace />;
  }
  if (user?.role === "candidate" && user?.candidate_onboarding?.onboarding_step === "categories") {
    return <Navigate to="/onboarding/categories" replace />;
  }

  if (!validId) {
    return (
      <main className="jobDetailPage jobDetailPageError">
        <header className="jobDetailPageHeader jobDetailPageHeaderSimple">
          <div className="jobDetailPageHeaderLead">
            <BackButton className="homeHeaderBack" />
            <Link to="/" className="homeHeaderBrand">
              <img className="homeHeaderLogo" src={ldLogo} alt="" />
              <span className="homeHeaderWordmark">SkillMesh</span>
            </Link>
          </div>
        </header>
        <div className="jobDetailPageInner">
          <p className="error">Invalid job link.</p>
          <Link className="jobDetailPageTextLink" to="/">
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  const browseJobsTo = user?.role === "candidate" && user?.candidate_onboarding?.onboarding_step === "done" ? "/" : "/";

  return (
    <main className="jobDetailPage">
      {showCandidateHeader ? (
        <CandidateMemberHeader />
      ) : user?.role === "employer" ? (
        <header className="jobDetailPageHeader jobDetailPageHeaderEmployer">
          <div className="jobDetailPageHeaderLead">
            <BackButton className="homeHeaderBack" fallbackTo="/" />
            <Link to="/" className="homeHeaderBrand">
              <img className="homeHeaderLogo" src={ldLogo} alt="" />
              <span className="homeHeaderWordmark">SkillMesh</span>
            </Link>
          </div>
          <nav className="jobDetailPageHeaderNav" aria-label="Employer shortcuts">
            <Link className="jobDetailPageNavLink" to="/employer">
              Dashboard
            </Link>
            <Link className="jobDetailPageNavLink" to="/employer/jobs">
              Job listings
            </Link>
            <Link className="jobDetailPageNavLink" to="/employer/applications">
              Applications received
            </Link>
          </nav>
        </header>
      ) : (
        <header className="jobDetailPageHeader jobDetailPageHeaderSimple">
          <div className="jobDetailPageHeaderLead">
            <BackButton className="homeHeaderBack" />
            <Link to="/" className="homeHeaderBrand">
              <img className="homeHeaderLogo" src={ldLogo} alt="" />
              <span className="homeHeaderWordmark">SkillMesh</span>
            </Link>
          </div>
        </header>
      )}

      <div className="jobDetailPageHero">
        <nav className="jobDetailBreadcrumb" aria-label="Breadcrumb">
          <Link to={browseJobsTo}>Jobs</Link>
          <span className="jobDetailBreadcrumbSep" aria-hidden="true">
            /
          </span>
          <span className="jobDetailBreadcrumbCurrent">{job?.title ? job.title : "Role"}</span>
        </nav>
      </div>

      <div className="jobDetailPageInner">
        {!loadError && !job && <p className="jobDetailPageLoading muted">Loading job…</p>}
        {loadError && (
          <div className="jobPublicDetailError">
            <p className="error">{loadError}</p>
            <div className="jobDetailPageErrorActions">
              <Link className="jobDetailPageBtnSecondary" to={browseJobsTo}>
                Browse jobs
              </Link>
              {user?.role === "employer" && (
                <Link className="jobDetailPageBtnPrimary" to="/employer/jobs">
                  Manage listings
                </Link>
              )}
            </div>
          </div>
        )}
        {job && (
          <>
            {flash ? (
              <p className={flash.includes("sent") ? "success jobsSeekFlash" : "error jobsSeekFlash"}>{flash}</p>
            ) : null}
            {previewMode && (
              <div className="jobDetailPreviewBanner" role="status">
                <strong>Listing preview</strong>
                <p>{employerPreviewMessage(job)}</p>
                <Link className="jobDetailPageBtnPrimary jobDetailPreviewEdit" to="/employer/jobs">
                  Edit in Job listings
                </Link>
              </div>
            )}
            <div className="jobDetailMetaBar">
              {job.created_at && (
                <span className="jobDetailPosted">Posted {formatPostedShort(job.created_at)}</span>
              )}
              {!previewMode && job.id != null && (
                <span className="jobDetailShareHint muted">Share this page — same view candidates see on SkillMesh.</span>
              )}
            </div>
            <JobPostingDetailPanel
              job={job}
              matchInfo={null}
              hasApplied={hasApplied}
              onApply={
                previewMode || user?.role === "employer"
                  ? undefined
                  : user?.role === "candidate" && user?.candidate_onboarding?.onboarding_step === "done"
                    ? handleApply
                    : undefined
              }
              applyBusy={applyBusy}
              showFullPageLink={false}
              employerPreview={previewMode}
              employerViewingPublic={user?.role === "employer" && !previewMode}
              fullPageLayout
            />
          </>
        )}
      </div>

      <footer className="jobsSeekFooter">
        © {new Date().getFullYear()} SkillMesh
        {user?.email ? ` · ${user.email}` : ""}
      </footer>
    </main>
  );
}
