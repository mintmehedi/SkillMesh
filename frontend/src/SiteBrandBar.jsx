import { Link } from "react-router-dom";
import { BackButton } from "./BackButton";
import { getRoleHomePath, useAuth } from "./auth";
import ldLogo from "./assets/ld.png";

/**
 * Sticky-header style block: back control + SkillMesh wordmark logo (used sitewide).
 */
export function SiteBrandBar({ leadClassName = "", brandClassName = "", fallbackTo, showProBadge = false }) {
  const { user } = useAuth();
  const homePath = getRoleHomePath(user);

  return (
    <div className={`homeHeaderLead ${leadClassName}`.trim()}>
      <BackButton className="homeHeaderBack" fallbackTo={fallbackTo} />
      <Link
        to={homePath}
        className={`homeHeaderBrand ${brandClassName}`.trim()}
        aria-label="SkillMesh — home"
        title="Home"
      >
        <img className="homeHeaderLogo" src={ldLogo} alt="" />
        <span className="homeHeaderWordmark">SkillMesh</span>
        {showProBadge ? (
          <span className="candidatePremiumBrandBadge" aria-label="Premium member" title="Premium member">
            PRO
          </span>
        ) : null}
      </Link>
    </div>
  );
}
