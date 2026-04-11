import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./auth";
import { api } from "./api";
import { formatApiError } from "./apiErrors";
import ldLogo from "./assets/ld.png";

export function EmployerHomePage() {
  const { user, logout } = useAuth();
  const [invites, setInvites] = useState([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [invitesError, setInvitesError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [sendBusy, setSendBusy] = useState(false);
  const [sendMessage, setSendMessage] = useState("");

  const loadInvites = useCallback(async () => {
    setInvitesError("");
    setInvitesLoading(true);
    try {
      const rows = await api("/api/employers/team/invites");
      setInvites(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setInvitesError(formatApiError(e));
      setInvites([]);
    } finally {
      setInvitesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  async function sendInvite(e) {
    e.preventDefault();
    setSendMessage("");
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setSendMessage("Enter your colleague's email.");
      return;
    }
    setSendBusy(true);
    try {
      await api("/api/employers/team/invites", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setInviteEmail("");
      setSendMessage("Invitation sent. Share the link below with your colleague.");
      await loadInvites();
    } catch (err) {
      setSendMessage(formatApiError(err));
    } finally {
      setSendBusy(false);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <main className="employerLandingPage">
      <div className="employerLandingAmbient" aria-hidden="true" />
      <div className="employerLandingShell">
        <header className="employerLandingHeader">
          <div className="employerLandingTopRow">
            <Link to="/" className="homeHeaderBrand employerLandingBrand" aria-label="SkillMesh — employer home">
              <img className="homeHeaderLogo" src={ldLogo} alt="" />
              <span className="homeHeaderWordmark">SkillMesh</span>
            </Link>
          </div>
          <h1 className="employerLandingTitle">SkillMesh</h1>
          <p className="employerLandingTagline">Intelligent Talent Matching Platform</p>
          <div className="employerLandingToolbar" aria-label="Employer account">
            {user?.email ? (
              <button type="button" className="employerLandingLogout" onClick={() => logout?.()}>
                Logout ({user.email})
              </button>
            ) : null}
          </div>
        </header>

        <section className="employerLandingIntro" aria-labelledby="employer-landing-intro-heading">
          <h2 id="employer-landing-intro-heading" className="employerLandingIntroTitle">
            Welcome back
          </h2>
          <p className="employerLandingIntroText">
            Use the shortcuts below to open your dashboard, manage jobs, company profile, or applications. Invite
            teammates so they can sign up with their work email and land directly in the shared employer workspace.
          </p>
        </section>

        <section className="employerLandingInvite card" aria-labelledby="employer-invite-heading">
          <h2 id="employer-invite-heading" className="employerLandingInviteTitle">
            Invite team
          </h2>
          <p className="employerLandingInviteLead">
            Add a colleague&apos;s email. They&apos;ll register as an employer with that address and skip company
            onboarding — same jobs and company profile as your workspace.
          </p>
          <form className="employerLandingInviteForm" onSubmit={sendInvite}>
            <label className="employerLandingInviteLabel" htmlFor="employer-invite-email">
              Colleague email
            </label>
            <div className="employerLandingInviteRow">
              <input
                id="employer-invite-email"
                type="email"
                className="authInput authInputLg"
                placeholder="colleague@company.com"
                autoComplete="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={sendBusy}
              />
              <button type="submit" className="modernBtn employerLandingInviteSend" disabled={sendBusy}>
                {sendBusy ? "Sending…" : "Send invite"}
              </button>
            </div>
            {sendMessage ? <p className={sendMessage.includes("sent") ? "success employerLandingInviteFlash" : "error employerLandingInviteFlash"}>{sendMessage}</p> : null}
          </form>
          {invitesError ? <p className="error employerLandingInviteFlash">{invitesError}</p> : null}
          {invitesLoading ? (
            <p className="muted employerLandingInviteListHint">Loading invitations…</p>
          ) : invites.length > 0 ? (
            <div className="employerLandingInviteList">
              <h3 className="employerLandingInviteListTitle">Pending invites</h3>
              <ul className="employerLandingInviteItems">
                {invites.map((inv) => (
                  <li key={inv.id} className="employerLandingInviteItem">
                    <span className="employerLandingInviteItemEmail">{inv.email}</span>
                    <code className="employerLandingInviteLink">{origin ? `${origin}${inv.join_path}` : inv.join_path}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="employerLandingGrid" aria-label="Quick actions">
          <Link className="employerLandingCard" to="/employer">
            <span className="employerLandingCardIcon" aria-hidden="true">
              📊
            </span>
            <h3 className="employerLandingCardTitle">Employer dashboard</h3>
            <p className="employerLandingCardText">Overview, candidate search, and job-to-candidate recommendations.</p>
            <span className="employerLandingCardCta">Open dashboard →</span>
          </Link>
          <Link className="employerLandingCard" to="/employer/jobs">
            <span className="employerLandingCardIcon" aria-hidden="true">
              📋
            </span>
            <h3 className="employerLandingCardTitle">Job listings</h3>
            <p className="employerLandingCardText">Create drafts, publish open roles, and edit how each job appears to candidates.</p>
            <span className="employerLandingCardCta">Manage jobs →</span>
          </Link>
          <Link className="employerLandingCard" to="/employer/company">
            <span className="employerLandingCardIcon" aria-hidden="true">
              🏢
            </span>
            <h3 className="employerLandingCardTitle">Company profile</h3>
            <p className="employerLandingCardText">Industry, location, and story — what applicants see before they apply.</p>
            <span className="employerLandingCardCta">Edit profile →</span>
          </Link>
          <Link className="employerLandingCard employerLandingCardSoon" to="/employer/applications">
            <span className="employerLandingSoonBadge">Coming soon</span>
            <span className="employerLandingCardIcon" aria-hidden="true">
              📥
            </span>
            <h3 className="employerLandingCardTitle">Applications received</h3>
            <p className="employerLandingCardText">
              Review who applied to each role and open candidate profiles. Full workflow is on the way.
            </p>
            <span className="employerLandingCardCta">View applications →</span>
          </Link>
        </section>
      </div>
    </main>
  );
}
