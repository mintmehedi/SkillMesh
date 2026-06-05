import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { CandidateMemberHeader } from "./CandidateMemberHeader";
import { companyAvatarLetter, formatPostedShort, formatWorkModeLabel } from "./jobFormatters";
import { LS_SAVED_JOBS, loadSavedJobIds, persistSavedJobIds } from "./savedJobs";

export function CandidateSavedJobsPage() {
  const [savedOrder, setSavedOrder] = useState(() => [...loadSavedJobIds()]);
  const [jobsById, setJobsById] = useState({});
  const [loadingJobs, setLoadingJobs] = useState(true);

  const refreshOrderFromStorage = useCallback(() => {
    setSavedOrder([...loadSavedJobIds()]);
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === LS_SAVED_JOBS || e.key === null) refreshOrderFromStorage();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refreshOrderFromStorage]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!savedOrder.length) {
        setJobsById({});
        setLoadingJobs(false);
        return;
      }
      setLoadingJobs(true);
      const entries = await Promise.all(
        savedOrder.map(async (id) => {
          try {
            const j = await api(`/api/jobs/${id}/`, { withAuth: false });
            return j && j.id ? [id, j] : [id, null];
          } catch {
            return [id, null];
          }
        }),
      );
      if (!alive) return;
      const m = {};
      for (const [id, j] of entries) {
        if (j) m[id] = j;
      }
      setJobsById(m);
      setLoadingJobs(false);
    })();
    return () => {
      alive = false;
    };
  }, [savedOrder]);

  const removeSaved = useCallback((id) => {
    const s = loadSavedJobIds();
    s.delete(id);
    persistSavedJobIds(s);
    setSavedOrder([...s]);
    setJobsById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const rows = useMemo(() => {
    return savedOrder.map((id) => ({
      id,
      job: jobsById[id] || null,
    }));
  }, [savedOrder, jobsById]);

  const count = rows.length;

  return (
    <main className="homePage jobsSeekPage candidateSavedJobsPage">
      <CandidateMemberHeader />

      <section className="jobsSeekHero candidateSavedJobsHero" aria-label="Saved jobs">
        <div className="heroGlow heroGlowA" />
        <div className="heroGlow heroGlowB" />
        <div className="heroMesh" />
        <div className="jobsSeekHeroInner candidateSavedJobsHeroInner">
          <p className="heroKicker jobsSeekHeroKicker">Bookmarks</p>
          <h1 className="candidateSavedJobsTitle">Saved jobs</h1>
          <p className="candidateSavedJobsLead muted">
            {count > 0
              ? `${count} saved on this device — open a role to read the full description or apply.`
              : "Save roles from the job board or a job page. Your list stays on this device until you remove items."}
          </p>
          <div className="candidateSavedJobsHeroActions">
            <Link className="jobsSeekCta" to="/">
              Browse jobs
            </Link>
            <Link className="jobsSeekLinkBtn candidateSavedJobsHeroSecondary" to="/candidate">
              Back to profile
            </Link>
          </div>
        </div>
      </section>

      <div className="candidateSavedJobsBody">
        {loadingJobs ? (
          <p className="muted candidateSavedJobsLoading">Loading saved listings…</p>
        ) : rows.length === 0 ? (
          <div className="candidateSavedJobsEmptyPanel">
            <p className="candidateSavedJobsEmptyTitle">Nothing saved yet</p>
            <p className="candidateSavedJobsEmptyText muted">
              Use the bookmark icon on any open role to add it here.
            </p>
            <Link className="jobsSeekCta candidateSavedJobsEmptyCta" to="/">
              Explore open roles
            </Link>
          </div>
        ) : (
          <ul className="candidateSavedJobsCardList">
            {rows.map(({ id, job }) => (
              <li key={id} className="candidateSavedJobsRow">
                <div className="candidateSavedJobsRowMain">
                  {job ? (
                    <div className="candidateSavedJobsRowLogo" aria-hidden="true">
                      {companyAvatarLetter(job.company_info, job.title)}
                    </div>
                  ) : (
                    <div className="candidateSavedJobsRowLogo candidateSavedJobsRowLogoMuted" aria-hidden="true">
                      ?
                    </div>
                  )}
                  <div className="candidateSavedJobsRowText">
                    <h2 className="candidateSavedJobsRowTitle">
                      {job ? (
                        <Link className="candidateSavedJobsRowTitleLink" to={`/jobs/${id}`}>
                          {job.title || `Job #${id}`}
                        </Link>
                      ) : (
                        <span className="muted">Job #{id} (no longer listed)</span>
                      )}
                    </h2>
                    {job ? <p className="candidateSavedJobsRowCompany">{job.company_info || "Employer"}</p> : null}
                    {job ? (
                      <ul className="candidateSavedJobsRowFacts">
                        <li>{formatWorkModeLabel(job.work_mode)}</li>
                        <li>{job.location || "—"}</li>
                        {job.created_at ? <li>Posted {formatPostedShort(job.created_at)}</li> : null}
                      </ul>
                    ) : (
                      <p className="muted candidateSavedJobsRowNote">
                        This listing may have closed. You can remove it from your list.
                      </p>
                    )}
                  </div>
                </div>
                <div className="candidateSavedJobsRowActions">
                  {job ? (
                    <Link className="jobsSeekCta jobsSeekCtaSm" to={`/jobs/${id}`}>
                      View role
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="candidateSavedJobsRemoveBtn"
                    onClick={() => removeSaved(id)}
                  >
                    Remove from saved
                  </button>
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
