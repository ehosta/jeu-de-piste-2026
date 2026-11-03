import {
  FortytwoIntraClient,
  isFortytwoIntraClientHttpError,
} from "@ibertran/fortytwo-intra-client";
import type { LoginError } from "#shared/utils/login-error";

// The 42 API allows 2 requests per second for the whole app. The client queues
// every request to stay under it (2 per 1.2 s, its default, to keep a margin),
// so at the start of the game everyone's logins wait their turn instead of
// getting 429s. A login takes 2 requests (code exchange, then /me).
//
// The queue has no end: past MAX_PENDING_LOGINS logins waiting (about
// LOGIN_DEADLINE_MS of queue), new ones are turned away at once with "busy",
// and a login that still waits after LOGIN_DEADLINE_MS gives up, instead of
// leaving players on a blank page for a minute.
const MAX_PENDING_LOGINS = 12;
const LOGIN_DEADLINE_MS = 15_000;

let client: FortytwoIntraClient | undefined;
let pendingLogins = 0;

export function useIntra() {
  if (!client) {
    const { oauth2 } = useRuntimeConfig();
    client = new FortytwoIntraClient(oauth2.clientId, oauth2.clientSecret, {
      redirect_uri: oauth2.redirectUrl,
      // It logs every request in color otherwise; failures are logged below.
      logLine: false,
      // 429s and 5xx are retried (in the queue). Kept low: a retry takes the
      // place of someone else's login.
      maxRetry: 2,
    });
  }

  return client;
}

export class IntraLoginError extends Error {
  constructor(readonly reason: LoginError) {
    super(`42 login failed: ${reason}`);
  }
}

// The 42 login of the player who came back from the 42 page with `code`.
export async function fetchIntraLogin(code: string): Promise<string> {
  if (pendingLogins >= MAX_PENDING_LOGINS) {
    throw new IntraLoginError("busy");
  }

  pendingLogins++;

  const login = (async () => {
    const intra = useIntra();
    const tokens = await intra.exchangeOAuthCode(code);
    const me = await intra.get("me", { token: tokens });

    if (typeof me?.login !== "string") {
      throw new IntraLoginError("intra");
    }

    return me.login;
  })().finally(() => pendingLogins--);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new IntraLoginError("busy")), LOGIN_DEADLINE_MS);
  });
  // Still counts as pending until 42 answers, but nobody waits for it anymore.
  login.catch(() => {});

  try {
    return await Promise.race([login, deadline]);
  } catch (error) {
    const reason = loginErrorReason(error);
    // Not the error itself: the code exchange's request holds the client secret.
    console.warn(
      `[auth] 42 login failed (${reason}):`,
      error instanceof Error ? error.message : error,
    );
    throw new IntraLoginError(reason);
  } finally {
    clearTimeout(timer);
  }
}

function loginErrorReason(error: unknown): LoginError {
  if (error instanceof IntraLoginError) {
    return error.reason;
  }

  // Wrapped by the client for /me, a bare axios error for the code exchange.
  const status = isFortytwoIntraClientHttpError(error)
    ? error.statusCode
    : (error as { response?: { status?: number } }).response?.status;

  if (status === 429) {
    return "busy";
  }

  // invalid_grant: the code expired or was already used (e.g. the page was
  // reloaded after logging in).
  if (status === 400 || status === 401) {
    return "expired";
  }

  // 5xx, timeouts, network errors.
  return "intra";
}
