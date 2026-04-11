import { Link } from "react-router-dom";
import { BackButton } from "./BackButton";
import ldLogo from "./assets/ld.png";

/**
 * Sticky-header style block: back control + SkillMesh wordmark logo (used sitewide).
 */
export function SiteBrandBar({ leadClassName = "", brandClassName = "", fallbackTo }) {
  return (
    <div className={`homeHeaderLead ${leadClassName}`.trim()}>
      <BackButton className="homeHeaderBack" fallbackTo={fallbackTo} />
      <Link
        to="/"
        className={`homeHeaderBrand ${brandClassName}`.trim()}
        aria-label="SkillMesh — home"
        title="Home"
      >
        <img className="homeHeaderLogo" src={ldLogo} alt="" />
        <span className="homeHeaderWordmark">SkillMesh</span>
      </Link>
    </div>
  );
}
