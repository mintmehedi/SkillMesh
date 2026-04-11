import { useNavigate } from "react-router-dom";

/**
 * @param {{ className?: string; fallbackTo?: string }} props
 * When history has no prior entry, navigate to `fallbackTo` instead of `/`.
 */
export function BackButton({ className = "", fallbackTo }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className={`backNavBtn ${className}`.trim()}
      aria-label="Go back"
      title="Back"
      onClick={() => {
        const idx = window.history.state?.idx;
        if (typeof idx === "number" && idx > 0) {
          navigate(-1);
        } else {
          navigate(fallbackTo || "/");
        }
      }}
    >
      <svg className="backNavBtnIcon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          d="M14.5 6.5 8 12l6.5 5.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8 12h11.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
