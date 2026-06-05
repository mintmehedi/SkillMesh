import { Link } from "react-router-dom";
import { formatCompensationSummary, formatWorkModeLabel, matchScorePercent } from "./jobFormatters";

function normalizeBulletLines(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x || "").trim()).filter(Boolean);
}

function JobStructuredSections({ job, fullPageLayout }) {
  const offers = normalizeBulletLines(job?.whats_on_offer);
  const lookingPeople = normalizeBulletLines(job?.looking_for_people_bullets);
  const lookingExtra = normalizeBulletLines(job?.looking_for_additional_bullets);
  const lookingCombined = [...lookingPeople, ...lookingExtra];
  const roleLines = normalizeBulletLines(job?.role_bullets);
  const whyUsLines = normalizeBulletLines(job?.why_choose_us_bullets);
  const how = (job.how_to_apply || "").trim();
  const overview = (job.jd_text || "").trim();
  const hasLooking = lookingCombined.length > 0;
  const hasAny = Boolean(
    overview || offers.length || hasLooking || roleLines.length || whyUsLines.length || how,
  );

  const descClass = `jobsSeekDesc${fullPageLayout ? " jobsSeekDescFull" : ""}`;
  const descClassTight = `jobsSeekDesc jobsSeekDescSection${fullPageLayout ? " jobsSeekDescFull" : ""}`;

  return (
    <>
      {overview ? (
        <section className="jobsSeekDetailSection">
          <h5 className="jobsSeekDetailSectionTitle">Overview</h5>
          <div className={descClass}>{overview}</div>
        </section>
      ) : null}

      {!hasAny ? (
        <div className={descClass}>The employer hasn&apos;t added a written overview for this listing yet.</div>
      ) : null}

      {offers.length > 0 ? (
        <section className="jobsSeekDetailSection">
          <h5 className="jobsSeekDetailSectionTitle">What&apos;s on offer</h5>
          <ul className="jobsSeekBulletList">
            {offers.map((line, idx) => (
              <li key={`${idx}-${line.slice(0, 24)}`}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {hasLooking ? (
        <section className="jobsSeekDetailSection">
          <h5 className="jobsSeekDetailSectionTitle">What we&apos;re looking for</h5>
          <ul className="jobsSeekBulletList">
            {lookingCombined.map((line, idx) => (
              <li key={`lf-${idx}-${line.slice(0, 20)}`}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {roleLines.length > 0 ? (
        <section className="jobsSeekDetailSection">
          <h5 className="jobsSeekDetailSectionTitle">The role</h5>
          <ul className="jobsSeekBulletList">
            {roleLines.map((line, idx) => (
              <li key={`role-${idx}-${line.slice(0, 20)}`}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {whyUsLines.length > 0 ? (
        <section className="jobsSeekDetailSection">
          <h5 className="jobsSeekDetailSectionTitle">Why choose us</h5>
          <ul className="jobsSeekBulletList">
            {whyUsLines.map((line, idx) => (
              <li key={`why-${idx}-${line.slice(0, 20)}`}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {how ? (
        <section className="jobsSeekDetailSection">
          <h5 className="jobsSeekDetailSectionTitle">How to apply</h5>
          <div className={descClassTight}>{how}</div>
        </section>
      ) : null}
    </>
  );
}

/**
 * Read-only job detail (sidebar on job hub or full-page view).
 * @param {object} props
 * @param {object} props.job
 * @param {object} [props.matchInfo] recommendation row shape { score, ... } or job._match
 * @param {boolean} props.hasApplied
 * @param {(() => void) | undefined} props.onApply — omit for guests (shows log-in hint)
 * @param {boolean} [props.applyBusy]
 * @param {boolean} [props.showFullPageLink] link to /jobs/:id when embedded in hub
 * @param {boolean} [props.employerPreview] employer-only draft/closed preview — no apply CTA
 * @param {boolean} [props.employerViewingPublic] employer viewing a live public job — short note instead of apply/login
 * @param {boolean} [props.fullPageLayout] full-page job view — taller description, more skills visible
 * @param {boolean} [props.bookmarkSaved] when set with onBookmarkToggle, shows save control
 * @param {(() => void) | undefined} [props.onBookmarkToggle]
 */
export function JobPostingDetailPanel({
  job,
  matchInfo,
  hasApplied,
  onApply,
  applyBusy,
  showFullPageLink,
  employerPreview = false,
  employerViewingPublic = false,
  fullPageLayout = false,
  bookmarkSaved = false,
  onBookmarkToggle,
}) {
  if (!job) return null;

  const pct = matchInfo != null ? matchScorePercent(matchInfo.score) : null;
  const payLine = formatCompensationSummary(job);
  const exp = job.required_experience != null ? Number(job.required_experience) : 0;
  const edu = (job.required_education || "").trim();
  const skillLimit = fullPageLayout ? 999 : 8;
  const showBookmark = typeof onBookmarkToggle === "function";

  const body = (
    <>
      <div className="jobsSeekDetailHeaderRow">
        <div className="jobsSeekDetailHeaderMain">
          <h4 className="jobsSeekDetailEyebrow">{employerPreview ? "Preview" : "At a glance"}</h4>
          {showFullPageLink && job.id != null && (
            <p className="jobsSeekDetailPermalinkWrap">
              <Link className="jobsSeekDetailPermalink" to={`/jobs/${job.id}`}>
                Open full page
              </Link>
            </p>
          )}
          <h3 className="jobsSeekDetailTitle">{job.title}</h3>
          <p className="jobsSeekDetailSub">{job.company_info || "Employer"}</p>
        </div>
        {showBookmark ? (
          <button
            type="button"
            className={`jobsSeekBookmarkBtn jobsSeekDetailBookmarkBtn ${bookmarkSaved ? "jobsSeekBookmarkBtn--saved" : ""}`}
            title={bookmarkSaved ? "Remove from saved" : "Save job"}
            aria-label={bookmarkSaved ? "Remove from saved" : "Save job"}
            aria-pressed={bookmarkSaved}
            onClick={onBookmarkToggle}
          >
            <svg className="jobsSeekBookmarkSvg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              {bookmarkSaved ? (
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
        ) : null}
      </div>
      <div className="jobsSeekDetailTags">
        <span>{job.location || "—"}</span>
        <span>{formatWorkModeLabel(job.work_mode)}</span>
        {job.job_category?.name && <span>{job.job_category.name}</span>}
        {job.closing_date && (
          <span>Closes {String(job.closing_date).slice(0, 10)}</span>
        )}
      </div>

      {(edu || (Number.isFinite(exp) && exp > 0)) && (
        <div className="jobsSeekDetailReq">
          {Number.isFinite(exp) && exp > 0 ? (
            <p className="jobsSeekDetailReqLine">
              <strong>Experience</strong> often around {exp} year{exp === 1 ? "" : "s"} — flexible
            </p>
          ) : null}
          {edu ? (
            <p className="jobsSeekDetailReqLine">
              <strong>Education</strong> {edu}
            </p>
          ) : null}
        </div>
      )}

      {matchInfo && (
        <div className="jobsSeekDetailMatch">
          <div className="jobsSeekDetailMatchTop">
            <span>How you align</span>
            <strong>{pct ?? "—"}%</strong>
          </div>
          <div className="jobsSeekMatchTrack">
            <div
              className="jobsSeekMatchFill"
              style={{
                width: `${Math.min(100, Math.max(6, pct || 0))}%`,
              }}
            />
          </div>
        </div>
      )}

      {Array.isArray(job.skills) && job.skills.length > 0 && (
        <div className="jobsSeekSkillRow">
          {job.skills.slice(0, skillLimit).map((s) => (
            <span className="jobsSeekSkillTag" key={s.id ?? s.skill_name}>
              {s.skill_name}
            </span>
          ))}
        </div>
      )}

      {payLine ? <p className="jobsSeekPayLine">{payLine}</p> : null}

      <JobStructuredSections job={job} fullPageLayout={fullPageLayout} />

      {employerPreview ? (
        <p className="jobsSeekEmployerPreviewNote muted">Above matches the layout candidates see for a live listing.</p>
      ) : hasApplied ? (
        <p className="jobsSeekAppliedNote">You’ve applied to this role.</p>
      ) : typeof onApply === "function" ? (
        <button type="button" className="jobsSeekApply" onClick={onApply} disabled={applyBusy}>
          {applyBusy ? "Submitting…" : "Apply"}
        </button>
      ) : employerViewingPublic ? (
        <p className="jobsSeekEmployerBrowseNote muted">
          You’re viewing the public job page. Candidates read this same view and apply when logged in with a candidate
          account.
        </p>
      ) : (
        <p className="jobsSeekLoginToApply muted">
          <Link to="/login">Log in</Link> or <Link to="/register?role=candidate">create a candidate account</Link> to
          apply.
        </p>
      )}
    </>
  );

  if (fullPageLayout) {
    return <div className="jobsSeekDetail jobsSeekDetailFullPage">{body}</div>;
  }

  return (
    <div className="jobsSeekDetail jobsSeekDetail--scrollAside">
        <div className="jobsSeekDetailBody jobsSeekDetailBodyScroll" role="region" aria-label="Job summary and description">
        {body}
      </div>
    </div>
  );
}
