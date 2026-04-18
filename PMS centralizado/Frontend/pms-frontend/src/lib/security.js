export function escapeHtml(raw) {
  return String(raw ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function sanitizeUrl(raw, opts = {}) {
  const {
    allowHttp = true,
    allowHttps = true,
    allowBlob = true,
    allowDataImage = true,
    allowRelative = true,
  } = opts;

  const value = String(raw ?? "").trim();
  if (!value) return "";

  if (allowRelative && /^(\/|\.\/|\.\.\/)/.test(value)) return value;
  if (allowBlob && value.startsWith("blob:")) return value;

  if (allowDataImage && value.startsWith("data:")) {
    return /^data:image\/[a-z0-9.+-]+(;[a-z0-9=-]+)*(;base64)?,/i.test(value) ? value : "";
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" && allowHttp) return parsed.toString();
    if (parsed.protocol === "https:" && allowHttps) return parsed.toString();
    return "";
  } catch {
    return "";
  }
}

export function sanitizeImageUrl(raw) {
  return sanitizeUrl(raw, {
    allowHttp: true,
    allowHttps: true,
    allowBlob: true,
    allowDataImage: true,
    allowRelative: true,
  });
}

export function sanitizeCssBackgroundImage(raw) {
  const safe = sanitizeUrl(raw, {
    allowHttp: true,
    allowHttps: true,
    allowBlob: false,
    allowDataImage: true,
    allowRelative: true,
  });
  if (!safe) return undefined;
  const encoded = safe.replace(/["'()\\\n\r\f]/g, (ch) => encodeURIComponent(ch));
  return `url("${encoded}")`;
}
