import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import * as api from "../api.js";
import type { AuthUser, PasswordChange, Role } from "../api.js";

// Lab 3, Issue 5 — who is signed in (FR-02, FR-05, FR-06).
//
// The session itself lives in an HttpOnly cookie the client cannot read
// (BR-09), so the client never holds a token. It only asks the API who the
// cookie belongs to, once on load and again after anything that changes it.

export type AuthStatus = "loading" | "anonymous" | "authenticated" | "unavailable";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** Signs in; throws api.ApiError on refusal so the screen can show why. */
  signIn: (email: string, password: string) => Promise<AuthUser>;
  /** Throws when the server did not end the session; the user stays signed in. */
  signOut: () => Promise<void>;
  changePassword: (change: PasswordChange) => Promise<void>;
  /** Asks the API again, e.g. after "Try again" on an unavailable API. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Each role's home: where sign-in lands and where an unauthorized URL bounces
// back to (ui-spec §2). The Requester's is the Dashboard since Lab 4, Issue 7 (D-09);
// IT Staff and Administrators get theirs with Issue 8.
export const LANDING: Record<Role, string> = {
  REQUESTER: "/dashboard",
  IT_STAFF: "/queue",
  ADMINISTRATOR: "/users",
};

export const ROLE_LABEL: Record<Role, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMINISTRATOR: "Administrator",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    try {
      const current = await api.fetchCurrentUser();
      setUser(current);
      setStatus(current ? "authenticated" : "anonymous");
    } catch {
      // The API is down, not "nobody is signed in": the guard shows a safe
      // failure with Try again rather than throwing the user to Login.
      setUser(null);
      setStatus("unavailable");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Issue 6 — the session ended under a working screen (any 401 outside
  // /api/auth). Forgetting the user is enough: the route guard then sends them
  // to Login, carrying the page they were on so sign-in brings them back.
  useEffect(
    () =>
      api.onSessionEnded(() => {
        setUser(null);
        setStatus("anonymous");
      }),
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const signedIn = await api.login(email, password);
    setUser(signedIn);
    setStatus("authenticated");
    return signedIn;
  }, []);

  // Only a logout the server confirmed signs the user out here. The session
  // cookie is HttpOnly, so the client cannot remove it itself: if the request
  // fails, the session is still alive, and pretending otherwise would leave
  // someone on a shared computer believing they had signed out (FR-06).
  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const changePassword = useCallback(async (change: PasswordChange) => {
    await api.changePassword(change);
    // The server cleared mustChangePassword (BR-02); mirror it so the guard
    // lets the user into the application.
    setUser((current) => (current ? { ...current, mustChangePassword: false } : current));
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, signOut, changePassword, refresh }),
    [status, user, signIn, signOut, changePassword, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside an AuthProvider");
  return value;
}
