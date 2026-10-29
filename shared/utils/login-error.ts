// Why a 42 login failed, sent back to the landing page as `?login_error=` by
// server/routes/auth/42.get.ts and translated there (app/components/LoginButton.vue).
// - busy: too many logins at once for the 42 API's rate limit, retry soon.
// - intra: the 42 API is down or answered something unexpected.
// - expired: the login link was too old or already used (state, code).
// - denied: the player refused the authorization on the 42 page.
export const LOGIN_ERRORS = ["busy", "intra", "expired", "denied"] as const;

export type LoginError = (typeof LOGIN_ERRORS)[number];

export function parseLoginError(value: unknown): LoginError | null {
  return LOGIN_ERRORS.includes(value as LoginError) ? (value as LoginError) : null;
}
