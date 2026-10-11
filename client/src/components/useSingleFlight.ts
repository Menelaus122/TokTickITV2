import { useCallback, useRef, useState } from "react";

// One request per submission (Lab 4 BR-53), for every form that writes.
//
// A `busy` state is not a guard. React draws it after the event handler, so a second event delivered in
// the same task, by a script, a key that repeats, or a page that was slow to catch up, still reads `false`
// and sends a second request. (A person's double-click arrives as two tasks, with the screen drawn in
// between, which is why testing with one never showed it.) The guard has to be taken the instant the
// handler is called, before the first await, and a ref changes at once where state does not.
//
// `busy` is for the screen to draw: the button's busy label and its disabled state.

export function useSingleFlight() {
  const taken = useRef(false);
  const [busy, setBusy] = useState(false);

  /**
   * Runs `work` unless a run is already in flight, in which case nothing happens and `undefined` is
   * returned. The guard is let go when `work` ends, whether it resolved or threw, so a failed
   * submission can be sent again.
   */
  const once = useCallback(async function once<T>(work: () => Promise<T>): Promise<T | undefined> {
    if (taken.current) return undefined;
    taken.current = true;
    setBusy(true);
    try {
      return await work();
    } finally {
      taken.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, once };
}
