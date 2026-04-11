const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.PROD ? "/_/backend" : "http://127.0.0.1:8000");

/** Single-flight refresh so concurrent 401s share one token rotation. */
let refreshInFlight = null;

export function getToken() {
  return localStorage.getItem("accessToken");
}

export function setTokens(access, refresh) {
  localStorage.setItem("accessToken", access);
  localStorage.setItem("refreshToken", refresh);
}

export function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

async function refreshAccessToken() {
  const refresh = localStorage.getItem("refreshToken");
  if (!refresh) return false;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (!data?.access) return false;
        setTokens(data.access, data.refresh || refresh);
        // #region agent log
        fetch("http://127.0.0.1:7880/ingest/bd22d204-09ad-4811-98c6-6dcf9f5fcce8", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9c37a0" },
          body: JSON.stringify({
            sessionId: "9c37a0",
            location: "api.js:refreshAccessToken",
            message: "access token refreshed",
            data: { hypothesisId: "B-fix", runId: "post-fix" },
            timestamp: Date.now(),
            hypothesisId: "B-fix",
            runId: "post-fix",
          }),
        }).catch(() => {});
        // #endregion
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export async function api(path, options = {}) {
  const skipAuthRefresh = options._skipAuthRefresh === true;
  const { _skipAuthRefresh: _, ...fetchOptions } = options;
  const token = getToken();
  const withAuth = fetchOptions.withAuth !== false;
  const headers = {
    ...(fetchOptions.headers || {}),
  };
  if (!(fetchOptions.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (withAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
  });
  if (
    response.status === 401
    && withAuth
    && !skipAuthRefresh
    && localStorage.getItem("refreshToken")
  ) {
    const ok = await refreshAccessToken();
    if (ok) {
      return api(path, { ...options, _skipAuthRefresh: true });
    }
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }
  const ct = response.headers.get("content-type") || "";
  if (ct.includes("application/json")) return response.json();
  return response.text();
}

/** Authenticated GET returning a Blob (e.g. PDF). Handles JWT refresh like api(). */
export async function apiBlob(path, options = {}) {
  const skipAuthRefresh = options._skipAuthRefresh === true;
  const { _skipAuthRefresh: _, ...fetchOptions } = options;
  const token = getToken();
  const withAuth = fetchOptions.withAuth !== false;
  const headers = { ...(fetchOptions.headers || {}) };
  if (withAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    method: fetchOptions.method || "GET",
    headers,
  });
  if (
    response.status === 401
    && withAuth
    && !skipAuthRefresh
    && localStorage.getItem("refreshToken")
  ) {
    const ok = await refreshAccessToken();
    if (ok) {
      return apiBlob(path, { ...options, _skipAuthRefresh: true });
    }
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }
  return response.blob();
}
