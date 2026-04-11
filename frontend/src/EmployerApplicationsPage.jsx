import { Link } from "react-router-dom";
import { useAuth } from "./auth";
import { BackButton } from "./BackButton";
import ldLogo from "./assets/ld.png";

/**
 * Placeholder for employer application inbox. Backend + candidate profile views will plug in here later.
 */
export function EmployerApplicationsPage() {
  const { user, logout } = useAuth();

  return (
    <main className="employerJobsPage employerApplicationsPage">
      <div className="employerJobsAmbient" aria-hidden="true" />
      <div className="employerJobsFrame fadeInUp">
        <header className="employerJobsHeader">
          <div className="employerJobsTopRow">
            <div className="employerJobsBackCell">
              <BackButton fallbackTo="/" />
            </div>
            <div className="employerJobsBrandCell">
              <Link to="/" className="authBrand authBrandLink" aria-label="SkillMesh — employer home" title="Employer home">
                <img src={ldLogo} alt="" />
                <div>
                  <strong>SkillMesh</strong>
                  <small>Intelligent Talent Matching</small>
                </div>
              </Link>
            </div>
            <div className="employerJobsBackSpacer" aria-hidden="true" />
          </div>
          <h1 className="employerJobsTitle">Applications received</h1>
          <p className="employerJobsLead">
            This area will list applicants by job and link to candidate profiles. For now, manage listings from{" "}
            <Link className="employerJobsDashLink" to="/employer/jobs">
              Job listings
            </Link>{" "}
            and use the{" "}
            <Link className="employerJobsDashLink" to="/employer">
              dashboard
            </Link>{" "}
            for search and recommendations.
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

        <section className="employerApplicationsPlaceholder card" aria-labelledby="employer-apps-placeholder-heading">
          <h2 id="employer-apps-placeholder-heading" className="employerApplicationsPlaceholderTitle">
            Inbox coming soon
          </h2>
          <p className="employerApplicationsPlaceholderText">
            You will be able to see each application, filter by job, and open a candidate&apos;s full profile from here.
            No data is shown yet.
          </p>
        </section>
      </div>
    </main>
  );
}
