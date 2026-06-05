import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { formatApiError } from "./apiErrors";
import { CandidateMemberHeader } from "./CandidateMemberHeader";
import { companyAvatarLetter, formatPostedShort, formatWorkModeLabel } from "./jobFormatters";

function formatApplicationStatus(status) {
  const s = String(status || "").toLowerCase();
  const map = {
    applied: "Applied",
    reviewing: "Reviewing",
    rejected: "Rejected",
    accepted: "Accepted",
    withdrawn: "Withdrawn",
  };
  return map[s] || (status ? String(status) : "—");
}

function formatSubmittedAt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function jobListingClosedMessage(job) {
  if (!job) return null;
  const st = String(job.status || "").toLowerCase();
  if (st === "closed") {
    return "This employer has closed the job listing. Your application remains on file; status updates may still appear here.";
  }
  if (st === "draft") {
    return "This listing is no longer public. Your application is still recorded.";
  }
  return null;
}

export function CandidateAppliedJobsPage() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [withdrawingId, setWithdrawingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionStatus, setActionStatus] = useState("");

  const refreshApplications = useCallback(async () => {
    setLoadError("");
    setLoading(true);
    try {
      const rows = await api("/api/applications/");
      setApplications(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setLoadError(String(err.message || err) || "Could not load applications.");
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshApplications();
  }, [refreshApplications]);

  const rows = useMemo(
    () =>
      applications.map((a) => ({
        app: a,
        jobId: Number(a.job),
        job: a.job_detail || null,
      })),
    [applications],
  );

  async function withdrawApplication(appId) {
    if (!window.confirm("Withdraw this application? Employers will no longer see it as active.")) return;
    setActionError("");
    setActionStatus("");
    setWithdrawingId(appId);
    try {
      await api(`/api/applications/${appId}/withdraw`, { method: "POST" });
      setActionStatus("Application withdrawn.");
      await refreshApplications();
    } catch (err) {
      setActionError(formatApiError(err) || String(err.message || err) || "Could not withdraw application.");
    } finally {
      setWithdrawingId(null);
    }
  }

  return (
    <main className="homePage jobsSeekPage candidateAppliedJobsPage">
      <CandidateMemberHeader />

      <section className="jobsSeekHero candidateAppliedJobsHero" aria-label="Applied jobs">
        <div className="heroGlow heroGlowA" />
        <div className="heroGlow heroGlowB" />
        <div className="heroMesh" />
        <div className="jobsSeekHeroInner candidateAppliedJobsHeroInner">
          <p className="heroKicker jobsSeekHeroKicker">Applications</p>
          <h1 className="candidateAppliedJobsTitle">Applied jobs</h1>
          <p className="candidateAppliedJobsLead muted">
            Roles you submitted through SkillMesh. Employers see these in their applications inbox.
          </p>
          <div className="candidateAppliedJobsHeroActions">
            <Link className="jobsSeekCta" to="/">
              Browse jobs
            </Link>
            <Link className="jobsSeekLinkBtn" to="/candidate">
              Back to profile
            </Link>
          </div>
        </div>
      </section>

      <div className="candidateAppliedJobsBody">
        {loadError && <p className="error candidateAppliedJobsBanner">{loadError}</p>}
        {actionStatus && <p className="success candidateAppliedJobsBanner">{actionStatus}</p>}
        {actionError && <p className="error candidateAppliedJobsBanner">{actionError}</p>}
        {loading ? (
          <p className="muted candidateAppliedJobsLoading">Loading applications…</p>
        ) : rows.length === 0 ? (
          <div className="candidateAppliedJobsEmpty">
            <p className="candidateAppliedJobsEmptyTitle">No applications yet</p>
            <p className="candidateAppliedJobsEmptyText muted">
              When you apply to a role, it appears here with status updates from the employer.
            </p>
            <Link className="jobsSeekCta candidateAppliedJobsEmptyCta" to="/">
              Find roles
            </Link>
          </div>
        ) : (
          <ul className="candidateAppliedJobsList">
            {rows.map(({ app, jobId, job }) => {
              const closedNote = jobListingClosedMessage(job);
              const canWithdraw =
                !["withdrawn", "rejected", "accepted"].includes(String(app.status || "").toLowerCase());
              return (
                <li key={app.id} className="candidateAppliedJobsCard">
                  {closedNote ? (
                    <div className="candidateAppliedJobsClosedBar" role="status">
                      <strong>Listing update</strong>
                      <p>{closedNote}</p>
                    </div>
                  ) : null}
                  <div className="candidateAppliedJobsCardTop">
                    <div className="candidateAppliedJobsCardText">
                      <div className="candidateAppliedJobsCardTitleRow">
                        <h2 className="candidateAppliedJobsCardTitle">
                          {job ? (
                            <Link className="candidateAppliedJobsCardTitleLink" to={`/jobs/${jobId}`}>
                              {job.title || `Job #${jobId}`}
                            </Link>
                          ) : (
                            <span className="muted">Job #{jobId} (listing unavailable)</span>
                          )}
                        </h2>
                        <span
                          className={`candidateAppliedJobsStatus candidateAppliedJobsStatus--${String(app.status || "applied").toLowerCase()}`}
                        >
                          {formatApplicationStatus(app.status)}
                        </span>
                      </div>
                      {job ? <p className="candidateAppliedJobsCompany">{job.company_info || "Employer"}</p> : null}
                      {job ? (
                        <ul className="candidateAppliedJobsFacts">
                          <li>{formatWorkModeLabel(job.work_mode)}</li>
                          <li>{job.location || "—"}</li>
                          {job.created_at ? <li>Posted {formatPostedShort(job.created_at)}</li> : null}
                        </ul>
                      ) : (
                        <p className="muted candidateAppliedJobsUnlistedNote">
                          This job may have closed or been removed from the public board. Your application is still on
                          record.
                        </p>
                      )}
                    </div>
                    {job ? (
                      <div className="candidateAppliedJobsCardLogo" aria-hidden="true">
                        {companyAvatarLetter(job.company_info, job.title)}
                      </div>
                    ) : null}
                  </div>
                  <div className="candidateAppliedJobsCardBottom">
                    <span className="candidateAppliedJobsSubmitted muted">
                      Submitted {formatSubmittedAt(app.created_at) || "—"}
                    </span>
                    <div className="candidateAppliedJobsCardActions">
                      {job && String(job.status || "").toLowerCase() === "open" ? (
                        <Link className="jobsSeekLinkBtn" to={`/jobs/${jobId}`}>
                          View listing
                        </Link>
                      ) : null}
                      {canWithdraw ? (
                        <button
                          type="button"
                          className="jobsSeekIconBtn candidateAppliedJobsWithdrawBtn"
                          title={withdrawingId === app.id ? "Withdrawing…" : "Withdraw application"}
                          aria-label={withdrawingId === app.id ? "Withdrawing application" : "Withdraw application"}
                          disabled={withdrawingId === app.id}
                          onClick={() => withdrawApplication(app.id)}
                        >
                          <svg className="jobsSeekIconSvg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                            <path
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H12"
                            />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="jobsSeekFooter">© {new Date().getFullYear()} SkillMesh</footer>
    </main>
  );
}
