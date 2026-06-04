const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ?? (import.meta.env.PROD ? "/_/backend" : "");

/** Single-flight refresh so concurrent 401s share one cookie rotation. */
let refreshInFlight = null;

/** @deprecated Tokens live in HttpOnly cookies; kept for compatibility with older call sites. */
export function getToken() {
  return null;
}

/** @deprecated */
export function setTokens() {}

/** @deprecated */
export function clearTokens() {}

/** Turn HTML error pages (e.g. Django 500) into a short message for the UI. */
export function formatApiError(text, status = 0) {
  const raw = String(text || "").trim();
  if (!raw) return "Request failed";
  if (raw.startsWith("<!") || raw.includes("<html")) {
    if (status >= 500) {
      return "Server error while saving. Please try again in a moment.";
    }
    return "Something went wrong. Please try again.";
  }
  return raw;
}

async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        });
        return res.ok;
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
  const withAuth = fetchOptions.withAuth !== false;
  const headers = {
    ...(fetchOptions.headers || {}),
  };
  if (!(fetchOptions.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const credentials = fetchOptions.credentials ?? (withAuth ? "include" : "same-origin");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
    credentials,
  });
  if (response.status === 401 && withAuth && !skipAuthRefresh) {
    const ok = await refreshAccessToken();
    if (ok) {
      return api(path, { ...options, _skipAuthRefresh: true });
    }
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(formatApiError(text, response.status));
  }
  const ct = response.headers.get("content-type") || "";
  if (ct.includes("application/json")) return response.json();
  return response.text();
}

/** Authenticated GET returning a Blob (e.g. PDF). Handles JWT refresh via cookies. */
export async function apiBlob(path, options = {}) {
  const skipAuthRefresh = options._skipAuthRefresh === true;
  const { _skipAuthRefresh: _, ...fetchOptions } = options;
  const withAuth = fetchOptions.withAuth !== false;
  const headers = { ...(fetchOptions.headers || {}) };
  const credentials = fetchOptions.credentials ?? (withAuth ? "include" : "same-origin");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    method: fetchOptions.method || "GET",
    headers,
    credentials,
  });
  if (response.status === 401 && withAuth && !skipAuthRefresh) {
    const ok = await refreshAccessToken();
    if (ok) {
      return apiBlob(path, { ...options, _skipAuthRefresh: true });
    }
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(formatApiError(text, response.status));
  }
  return response.blob();
}
