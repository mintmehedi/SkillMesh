import { api } from "./api";

const CACHE_PREFIX = "skillmesh:jobs-cache:";
const FEED_KEY = `${CACHE_PREFIX}feed`;
const DETAIL_PREFIX = `${CACHE_PREFIX}detail:`;
const SEARCH_PREFIX = `${CACHE_PREFIX}search:`;
const FEED_TTL_MS = 2 * 60 * 1000;
const SEARCH_TTL_MS = 2 * 60 * 1000;
const DETAIL_TTL_MS = 5 * 60 * 1000;

const memoryCache = new Map();
const inFlight = new Map();

function getStorage() {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readEntry(key) {
  const now = Date.now();
  const mem = memoryCache.get(key);
  if (mem && mem.expiresAt > now) return mem.data;
  if (mem) memoryCache.delete(key);

  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.expiresAt <= now) {
      storage.removeItem(key);
      return null;
    }
    memoryCache.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

function writeEntry(key, data, ttlMs) {
  const entry = { data, expiresAt: Date.now() + ttlMs };
  memoryCache.set(key, entry);
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(entry));
  } catch {
    /* ignore storage quota / serialization issues */
  }
}

function primeJobDetails(jobs, ttlMs = DETAIL_TTL_MS) {
  if (!Array.isArray(jobs)) return;
  for (const job of jobs) {
    if (job && job.id != null) writeEntry(`${DETAIL_PREFIX}${job.id}`, job, ttlMs);
  }
}

async function getOrLoad(key, ttlMs, loader, { primeDetails = false } = {}) {
  const cached = readEntry(key);
  if (cached != null) return cached;

  if (inFlight.has(key)) return inFlight.get(key);

  const request = (async () => {
    try {
      const data = await loader();
      writeEntry(key, data, ttlMs);
      if (primeDetails) primeJobDetails(data);
      return data;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, request);
  return request;
}

export function fetchJobFeedCached() {
  return getOrLoad(
    FEED_KEY,
    FEED_TTL_MS,
    async () => {
      const rows = await api("/api/jobs/feed", { withAuth: false });
      return Array.isArray(rows) ? rows : [];
    },
    { primeDetails: true },
  );
}

export function fetchJobSearchCached(queryString) {
  const qs = String(queryString || "").trim();
  const key = `${SEARCH_PREFIX}${qs}`;
  return getOrLoad(
    key,
    SEARCH_TTL_MS,
    async () => {
      const rows = await api(`/api/jobs/search?${qs}`, { withAuth: false });
      return Array.isArray(rows) ? rows : [];
    },
    { primeDetails: true },
  );
}

export function fetchJobDetailCached(jobId) {
  const id = Number(jobId);
  return getOrLoad(`${DETAIL_PREFIX}${id}`, DETAIL_TTL_MS, async () => {
    const job = await api(`/api/jobs/${id}/`, { withAuth: false });
    return job && job.id ? job : null;
  });
}

export function primeJobCache(jobOrJobs) {
  if (Array.isArray(jobOrJobs)) {
    primeJobDetails(jobOrJobs);
    return;
  }
  if (jobOrJobs && jobOrJobs.id != null) {
    writeEntry(`${DETAIL_PREFIX}${jobOrJobs.id}`, jobOrJobs, DETAIL_TTL_MS);
  }
}

export function clearJobCache() {
  memoryCache.clear();
  const storage = getStorage();
  if (!storage) return;
  try {
    const keysToRemove = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) keysToRemove.push(key);
    }
    for (const key of keysToRemove) storage.removeItem(key);
  } catch {
    /* ignore */
  }
}
