import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { Requester } from "../api.js";

// The Development Requester testing context (BR-03, BR-10, BR-11).
//
// This is deliberately NOT a session. The selection lives in localStorage on
// the client and is never stored server-side, because a server session would be
// authentication, which Lab 2 excludes. In Lab 3 this provider is what gets
// replaced by a real authenticated identity; nothing that consumes it needs to
// change, because consumers only ever see "who is the current requester".

export const STORAGE_KEY = "toktickit.devRequesterId";

interface RequesterContextValue {
  /** The selected Requester, or null when none has been chosen. */
  requester: Requester | null;
  /** Stores the selection and enters the application. */
  selectRequester: (requester: Requester) => void;
  /** Drops the selection and returns to the Selection screen. */
  changeRequester: () => void;
  /** Increments on every change; consumers key their fetches off it. */
  generation: number;
}

const RequesterContext = createContext<RequesterContextValue | null>(null);

function readStoredId(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    // Private mode, disabled storage, or a sandboxed frame. Losing the
    // selection is recoverable — the user just picks again.
    return null;
  }
}

function writeStoredId(id: number | null) {
  try {
    if (id === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    /* ignore — see readStoredId */
  }
}

export function RequesterProvider({
  children,
  /**
   * Requesters loaded from the API, or undefined while that load is still in
   * flight. A stored id is only honoured if it appears in a LOADED list, so a
   * Requester deactivated since the last visit cannot come back through a stale
   * localStorage value (BR-09, BR-12).
   *
   * The undefined case matters: treating "not loaded yet" as "loaded and empty"
   * would discard the stored selection on every page load, before the API had a
   * chance to answer.
   */
  available,
}: {
  children: ReactNode;
  available?: Requester[];
}) {
  const [requester, setRequester] = useState<Requester | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (requester) return;
    if (!available) return; // still loading — keep the stored id for now

    const storedId = readStoredId();
    if (storedId === null) return;

    const match = available.find((candidate) => candidate.id === storedId);
    if (match) setRequester(match);
    else writeStoredId(null); // stale or now-inactive: discard it
  }, [available, requester]);

  const selectRequester = useCallback((next: Requester) => {
    writeStoredId(next.id);
    setRequester(next);
    // Bumping the generation is how every requester-scoped fetch is told to
    // start over. Nothing belonging to the previous Requester may survive
    // the switch (BR-11).
    setGeneration((value) => value + 1);
  }, []);

  const changeRequester = useCallback(() => {
    writeStoredId(null);
    setRequester(null);
    setGeneration((value) => value + 1);
  }, []);

  const value = useMemo(
    () => ({ requester, selectRequester, changeRequester, generation }),
    [requester, selectRequester, changeRequester, generation],
  );

  return <RequesterContext.Provider value={value}>{children}</RequesterContext.Provider>;
}

export function useRequester(): RequesterContextValue {
  const value = useContext(RequesterContext);
  if (!value) {
    throw new Error("useRequester must be used inside a RequesterProvider");
  }
  return value;
}
