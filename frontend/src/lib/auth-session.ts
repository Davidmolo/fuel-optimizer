export type AuthSession = {
  email: string;
  role: string | null;
};

const SESSION_KEY = "fuel_auth_session";
const SESSION_EVENT = "fuel_auth_session_changed";

let sessionSnapshotCache: { raw: string | null; value: AuthSession | null } = {
  raw: undefined as unknown as string | null,
  value: null,
};

function notifySessionChange() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function saveAuthSession(session: AuthSession) {
  if (typeof window === "undefined") {
    return;
  }

  const serialized = JSON.stringify(session);
  sessionStorage.setItem(SESSION_KEY, serialized);
  sessionSnapshotCache = { raw: serialized, value: session };
  notifySessionChange();
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = sessionStorage.getItem(SESSION_KEY);
  if (sessionSnapshotCache.raw === raw) {
    return sessionSnapshotCache.value;
  }

  if (!raw) {
    sessionSnapshotCache = { raw: null, value: null };
    return null;
  }

  try {
    const value = JSON.parse(raw) as AuthSession;
    sessionSnapshotCache = { raw, value };
    return value;
  } catch {
    sessionSnapshotCache = { raw: null, value: null };
    return null;
  }
}

export function clearAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(SESSION_KEY);
  sessionSnapshotCache = { raw: null, value: null };
  notifySessionChange();
}

export function subscribeAuthSession(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener(SESSION_EVENT, handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(SESSION_EVENT, handler);
  };
}
