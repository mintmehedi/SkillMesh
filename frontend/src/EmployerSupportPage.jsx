import { Link } from "react-router-dom";
import { EmployerMemberHeader } from "./EmployerMemberHeader";

const SUPPORT_EMAIL = "support@skillmesh.dev";

const FAQ_ITEMS = [
  {
    q: "How do I publish a job listing?",
    a: "Go to Job listings, click New job, fill in role details, then choose Publish job.",
  },
  {
    q: "Why is my job not visible to candidates?",
    a: "Draft and closed jobs are hidden. Also check your closing date and status in Job listings.",
  },
  {
    q: "How can my team access the same employer workspace?",
    a: "Use Invite team from Employer home. Invited colleagues join the same jobs and company profile workspace.",
  },
  {
    q: "Where do I review applicants?",
    a: "Open Applications received to filter by job, view profile details, and review resumes or cover letters.",
  },
];

export function EmployerSupportPage() {
  return (
    <main className="homePage employerSupportPage">
      <EmployerMemberHeader />
      <section className="card employerSupportCard fadeInUp">
        <h1>Support & FAQ</h1>
        <p className="muted">
          Need help with SkillMesh employer features? Contact the platform developer or check common answers below.
        </p>

        <div className="employerSupportContact card">
          <h2>Contact developer</h2>
          <p>
            Email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
          <p className="muted">Include your account email, affected page, and what happened so we can help faster.</p>
        </div>

        <div className="employerSupportFaq card">
          <h2>Frequently asked questions</h2>
          <div className="employerSupportFaqList">
            {FAQ_ITEMS.map((item) => (
              <article key={item.q} className="employerSupportFaqItem">
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="row employerSupportActions">
          <Link className="modernBtn" to="/employer">
            Back to employer dashboard
          </Link>
          <Link className="btnGhost" to="/employer/jobs">
            Open job listings
          </Link>
        </div>
      </section>
    </main>
  );
}
