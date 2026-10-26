// 42 logins are lowercase letters, digits and hyphens.
const INTRA_LOGIN_REGEX = /^[a-z0-9-]{1,32}$/;

export function parseIntraLogin(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const login = value.trim().toLowerCase();

  return INTRA_LOGIN_REGEX.test(login) ? login : null;
}
