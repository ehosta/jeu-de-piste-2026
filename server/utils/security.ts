import type { H3Event } from "h3";

// Requests that change something must come from the app's own pages. The
// session cookie is `SameSite=Lax`, which already keeps other sites out, but
// not other subdomains of the same domain (same *site*): a page on
// another.elouann.dev could otherwise post to the API as the visitor.
// Browsers say where a request comes from with Sec-Fetch-Site (every current
// browser), or else Origin. Requests without either (curl, server-side
// rendering) are not from a browser page, so they carry no visitor's cookie
// by accident.
export function isCrossOriginRequest(
  getHeader: (name: string) => string | null | undefined,
  host: string | undefined,
) {
  const site = getHeader("sec-fetch-site");

  if (site) {
    return site !== "same-origin" && site !== "none";
  }

  const origin = getHeader("origin");

  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export function requestHost(event: H3Event) {
  return getRequestHost(event, { xForwardedHost: true });
}
