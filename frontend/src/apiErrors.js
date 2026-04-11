/**
 * Turn common Django REST Framework messages into short inline copy.
 */
export function humanizeFieldErrorMessage(message) {
  const t = String(message || "").trim();
  if (!t) return "This field is required.";
  const low = t.toLowerCase();
  if (low.includes("may not be blank") || low.includes("this field is required")) {
    return "This field is required.";
  }
  return t;
}

function normalizeValidationValue(val) {
  if (Array.isArray(val)) {
    if (val.length === 0) return "";
    if (typeof val[0] === "string") {
      return humanizeFieldErrorMessage(val.join(" "));
    }
    const parts = [];
    for (const item of val) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        for (const [, iv] of Object.entries(item)) {
          const m = Array.isArray(iv) ? iv.join(" ") : String(iv);
          if (m) parts.push(humanizeFieldErrorMessage(m));
        }
      }
    }
    return parts.join(" ");
  }
  if (typeof val === "string") return humanizeFieldErrorMessage(val);
  if (val && typeof val === "object") {
    const parts = [];
    for (const [, iv] of Object.entries(val)) {
      const m = normalizeValidationValue(iv);
      if (m) parts.push(m);
    }
    return parts.join(" ");
  }
  return "";
}

/**
 * Parse Error.message from `api()` (JSON body as string) into field keys and a general banner message.
 * @returns {{ fieldErrors: Record<string, string>, generalMessage: string }}
 */
export function parseApiValidationErrors(err) {
  const raw = String(err?.message || err || "");
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { fieldErrors: {}, generalMessage: raw || "Something went wrong." };
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { fieldErrors: {}, generalMessage: raw };
  }

  const fieldErrors = {};
  const generalParts = [];

  if (Array.isArray(data.detail)) {
    generalParts.push(...data.detail.map(String));
  } else if (typeof data.detail === "string") {
    generalParts.push(data.detail);
  }

  for (const [key, val] of Object.entries(data)) {
    if (key === "detail") continue;
    if (key === "non_field_errors") {
      const m = normalizeValidationValue(val);
      if (m) generalParts.push(m);
      continue;
    }
    const msg = normalizeValidationValue(val);
    if (msg) fieldErrors[key] = msg;
  }

  const generalMessage = generalParts.map(humanizeFieldErrorMessage).filter(Boolean).join(" ");
  return { fieldErrors, generalMessage };
}

/**
 * DRF ListSerializer errors: [{ field: ["msg"] }, null, { other: ["…"] }, …]
 * Index matches the submitted row order.
 * @returns {Record<number, Record<string, string>>}
 */
export function parseIndexedListFieldErrors(val) {
  const out = {};
  if (!Array.isArray(val)) return out;
  val.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    const row = {};
    for (const [k, v] of Object.entries(item)) {
      if (k === "non_field_errors") {
        const m = normalizeValidationValue(v);
        if (m) row._row = m;
        continue;
      }
      const msg = normalizeValidationValue(v);
      if (msg) row[k] = msg;
    }
    if (Object.keys(row).length) out[index] = row;
  });
  return out;
}

export function formatApiError(err) {
  const raw = String(err?.message || err || "");
  try {
    const j = JSON.parse(raw);
    if (typeof j === "object" && j !== null) {
      const parts = [];
      for (const [, v] of Object.entries(j)) {
        if (Array.isArray(v)) parts.push(...v.map(String));
        else if (typeof v === "string") parts.push(v);
      }
      if (parts.length) return parts.join(" ");
    }
  } catch {
    /* not JSON */
  }
  return raw || "Something went wrong.";
}
