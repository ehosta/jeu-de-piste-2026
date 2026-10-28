// Logins pasted in admin forms, separated by spaces, commas or new lines
// (e.g. copied from a spreadsheet column).
export function splitLogins(text: string) {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((login) => login.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}
