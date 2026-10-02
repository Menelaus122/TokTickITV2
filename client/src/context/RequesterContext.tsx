import { createContext, useContext, ReactNode } from "react";
import { Requester } from "../api.js";

// The current Requester, as the Lab 2 screens read it.
//
// Since Lab 3, Issue 6 this is simply the signed-in user: AuthProvider learns
// who the session belongs to, and the Requester routes hand that user down
// here. There is no selector, nothing in localStorage, and no way to change
// the Requester from inside the application — only signing out and in again.
// The screens kept their "who is the current requester" question, so none of
// them had to learn about sessions.

interface RequesterContextValue {
  requester: Requester;
}

const RequesterContext = createContext<RequesterContextValue | null>(null);

export function RequesterProvider({ requester, children }: { requester: Requester; children: ReactNode }) {
  return <RequesterContext.Provider value={{ requester }}>{children}</RequesterContext.Provider>;
}

export function useRequester(): RequesterContextValue {
  const value = useContext(RequesterContext);
  if (!value) {
    throw new Error("useRequester must be used inside a RequesterProvider");
  }
  return value;
}
