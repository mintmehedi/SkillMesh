export function formatWorkModeLabel(mode) {
  if (!mode) return "";
  const m = String(mode).toLowerCase();
  if (m === "remote") return "Remote";
  if (m === "hybrid") return "Hybrid";
  if (m === "onsite") return "On-site";
  return mode;
}

export function formatPostedShort(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function companyAvatarLetter(companyInfo, title) {
  const raw = (companyInfo || title || "?").trim();
  return raw.charAt(0).toUpperCase() || "?";
}

export function matchScorePercent(score) {
  if (score == null || Number.isNaN(Number(score))) return null;
  const n = Number(score);
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

const COMP_PERIOD_UNIT = {
  not_specified: "",
  hourly: "hr",
  yearly: "yr",
  monthly: "mo",
  daily: "day",
};

const COMP_PERIOD_TITLE = {
  not_specified: "",
  hourly: "Hourly",
  yearly: "Yearly (salary)",
  monthly: "Monthly",
  daily: "Daily",
};

function formatMoneyAmount(n) {
  if (n == null || n === "") return "";
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  if (Number.isInteger(num)) return String(num);
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Human-readable pay line for job cards / detail (optional fields).
 */
export function formatCompensationSummary(job) {
  if (!job) return "";
  const period = job.compensation_period || "not_specified";
  const lo = job.compensation_amount_min;
  const hi = job.compensation_amount_max;
  const hasLo = lo != null && lo !== "";
  const hasHi = hi != null && hi !== "";
  const unit = COMP_PERIOD_UNIT[period] || "";
  const title = COMP_PERIOD_TITLE[period] || "";

  if (period === "not_specified" && !hasLo && !hasHi) return "";

  let range = "";
  if (hasLo && hasHi) {
    const a = formatMoneyAmount(lo);
    const b = formatMoneyAmount(hi);
    range = a === b ? a : `${a}–${b}`;
  } else if (hasLo) {
    range = `From ${formatMoneyAmount(lo)}`;
  } else if (hasHi) {
    range = `Up to ${formatMoneyAmount(hi)}`;
  }

  if (range && unit) {
    return `${range} / ${unit}`;
  }
  if (range) {
    return range;
  }
  return title || "";
}
