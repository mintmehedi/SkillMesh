export const LS_SAVED_JOBS = "skillmesh_saved_job_ids";

export function loadSavedJobIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_SAVED_JOBS) || "[]");
    if (!Array.isArray(raw)) return new Set();
    return new Set(
      raw
        .map((x) => Number(x))
        .filter((n) => Number.isInteger(n) && n > 0),
    );
  } catch {
    return new Set();
  }
}

export function persistSavedJobIds(set) {
  const arr = [...set].filter((n) => Number.isInteger(n) && n > 0);
  localStorage.setItem(LS_SAVED_JOBS, JSON.stringify(arr));
}
