import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth";
import { BackButton } from "./BackButton";
import ldLogo from "./assets/ld.png";

export function EmployerMemberHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const initials = useMemo(() => {
    const a = (user?.first_name || "").trim();
    const b = (user?.last_name || "").trim();
    if (a || b) {
      const s = `${a.charAt(0)}${b.charAt(0)}`.toUpperCase();
      return s || "?";
    }
    return (user?.email || "?").charAt(0).toUpperCase();
  }, [user]);

  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onPointer = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const t = window.setTimeout(() => document.addEventListener("mousedown", onPointer, true), 0);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onPointer, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function signOut() {
    setMenuOpen(false);
    logout();
    navigate("/", { replace: true });
  }

  return (
    <header className={`homeHeader ${headerScrolled ? "homeHeaderScrolled" : ""}`}>
      <div className="homeHeaderLead">
        <BackButton className="homeHeaderBack" />
        <Link to="/" className="homeHeaderBrand candidateHeaderBrand">
          <img className="homeHeaderLogo" src={ldLogo} alt="" />
          <span className="homeHeaderWordmark">SkillMesh</span>
        </Link>
      </div>
      <div className="candidateProfileMenuRoot" ref={menuRef}>
        <button
          type="button"
          className="candidateProfileTrigger"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label="Account menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="candidateProfileAvatar" aria-hidden="true">
            {initials}
          </span>
          <span className={`candidateProfileChev ${menuOpen ? "candidateProfileChevOpen" : ""}`} aria-hidden />
        </button>
        <div
          className={`candidateProfileDropdown ${menuOpen ? "candidateProfileDropdownOpen" : ""}`}
          role="menu"
          aria-hidden={!menuOpen}
        >
          <Link role="menuitem" className="candidateProfileMenuItem" to="/employer" onClick={() => setMenuOpen(false)}>
            Dashboard
          </Link>
          <Link role="menuitem" className="candidateProfileMenuItem" to="/employer/jobs" onClick={() => setMenuOpen(false)}>
            Job listings
          </Link>
          <Link role="menuitem" className="candidateProfileMenuItem" to="/employer/applications" onClick={() => setMenuOpen(false)}>
            Applications
          </Link>
          <Link role="menuitem" className="candidateProfileMenuItem" to="/employer/company" onClick={() => setMenuOpen(false)}>
            Company profile
          </Link>
          <Link role="menuitem" className="candidateProfileMenuItem" to="/" onClick={() => setMenuOpen(false)}>
            Home
          </Link>
          <hr className="candidateProfileMenuRule" />
          <button type="button" role="menuitem" className="candidateProfileMenuItem candidateProfileMenuDanger" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
