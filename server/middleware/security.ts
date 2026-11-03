// Applied to every request: security headers, and for requests that change
// something, a same-origin check and a body size limit. The WebSocket (/_ws)
// doesn't go through middleware: it checks its origin itself.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// JSON bodies are small, except a JSON import. Photos are checked by their
// route (server/api/teams/me/quests/[questId]/photo.post.ts), which tells the
// player the photo is too large.
const MAX_BODY_BYTES = 64 * 1024;
const LARGE_BODIES: { path: RegExp; maxBytes: number | null }[] = [
  { path: /^\/api\/teams\/me\/quests\/[^/]+\/photo$/, maxBytes: null },
  { path: /^\/api\/admin\/patch$/, maxBytes: 5 * 1024 * 1024 },
];

const HEADERS = {
  // Files are served for what they claim to be: a photo can't run as a page.
  "X-Content-Type-Options": "nosniff",
  // No other site can show the app in a frame, to trick clicks on it.
  "X-Frame-Options": "SAMEORIGIN",
  "Content-Security-Policy": "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // The camera is for the NPC scanner, nothing else is used.
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

export default defineEventHandler((event) => {
  setResponseHeaders(event, HEADERS);

  if (SAFE_METHODS.has(event.method)) {
    return;
  }

  if (
    isCrossOriginRequest(
      (name) => getRequestHeader(event, name),
      requestHost(event),
    )
  ) {
    throw createError({ statusCode: 403, statusMessage: "Cross-origin request" });
  }

  const path = event.path.split("?")[0]!;
  const large = LARGE_BODIES.find((route) => route.path.test(path));
  const maxBytes = large ? large.maxBytes : MAX_BODY_BYTES;
  const length = getRequestHeader(event, "content-length");

  // Without a length, the body would be read whole before anything can check
  // its size. In production, nginx always sends the length (it buffers the
  // body); the dev tunnel may not.
  if (length === undefined && getRequestHeader(event, "transfer-encoding") && !import.meta.dev) {
    throw createError({ statusCode: 411, statusMessage: "Length required" });
  }

  if (maxBytes !== null && Number(length) > maxBytes) {
    throw createError({ statusCode: 413, statusMessage: "Payload too large" });
  }
});
