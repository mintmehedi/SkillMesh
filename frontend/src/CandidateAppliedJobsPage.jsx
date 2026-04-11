import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { CandidateMemberHeader } from "./CandidateMemberHeader";
import { companyAvatarLetter, formatPostedShort, formatWorkModeLabel } from "./jobFormatters";

function formatApplicationStatus(status) {
  const s = String(status || "").toLowerCase();
  const map = {
    applied: "Applied",
    reviewing: "Reviewing",
    rejected: "Rejected",
    accepted: "Accepted",
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

export function CandidateAppliedJobsPage() {
  const [applications, setApplications] = useState([]);
  const [jobsById, setJobsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const refreshApplications = useCallback(async () => {
    setLoadError("");
    setLoading(true);
    try {
      const rows = await api("/api/applications/");
      const list = Array.isArray(rows) ? rows : [];
      setApplications(list);
      const jobIds = [...new Set(list.map((a) => Number(a.job)).filter((n) => Number.isInteger(n) && n > 0))];
      const entries = await Promise.all(
        jobIds.map(async (id) => {
          try {
            const j = await api(`/api/jobs/${id}/`, { withAuth: false });
            return j && j.id ? [id, j] : [id, null];
          } catch {
            return [id, null];
          }
        }),
      );
      const m = {};
      for (const [id, j] of entries) {
        if (j) m[id] = j;
      }
      setJobsById(m);
    } catch (err) {
      setLoadError(String(err.message || err) || "Could not load applications.");
      setApplications([]);
      setJobsById({});
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
        job: jobsById[Number(a.job)] || null,
      })),
    [applications, jobsById],
  );

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
            {rows.map(({ app, jobId, job }) => (
              <li key={app.id} className="candidateAppliedJobsCard">
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
                        This job may have closed or been removed from the public board.
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
                    {job ? (
                      <Link className="jobsSeekLinkBtn" to={`/jobs/${jobId}`}>
                        View listing
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="jobsSeekFooter">© {new Date().getFullYear()} SkillMesh</footer>
    </main>
  );
}
