// Login attempt throttling — Lab 3 BR-67, D-24.
//
// Failures are counted per normalised email, never per IP: behind one campus
// proxy or NAT every user shares an address, so an IP limit would lock out
// whole buildings. Unknown emails are counted exactly like real ones, because
// a 429 for one and a 401 for the other would reveal which emails exist
// (BR-16).
//
// Attempts are RESERVED before the password is checked. Checking the lock,
// then awaiting bcrypt, then counting the failure would let every request
// sent at the same moment pass the check before any was counted, so a burst
// of guesses would get past a five-attempt limit. beginAttempt runs without
// an await between the check and the reservation, and Node runs it to
// completion before any other request, so the two cannot be separated.
//
// The store lives in memory, in this process: a restart clears it, and two
// server processes would count separately. specification.md D-24 records why
// that is acceptable for Lab 3.

export const MAX_FAILURES = 5;
export const FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const LOCK_MS = 15 * 60 * 1000;
export const MAX_TRACKED_EMAILS = 10_000;

interface Entry {
  // Timestamps of failures still inside the window, oldest first.
  failures: number[];
  lockedUntil: number | null;
  // Attempts reserved by beginAttempt whose outcome is not known yet.
  inFlight: number;
}

export type AttemptOutcome = "failure" | "success" | "neutral";

export type AttemptStart = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export class LoginThrottle {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly maxTracked: number = MAX_TRACKED_EMAILS) {}

  static key(email: string): string {
    return email.trim().toLowerCase();
  }

  // Seconds until this email's lock lifts; 0 when it is not locked. An expired
  // lock is cleared here, so the email starts from a clean count.
  retryAfterSeconds(email: string, now: number): number {
    const key = LoginThrottle.key(email);
    const entry = this.entries.get(key);
    if (!entry || entry.lockedUntil === null) return 0;
    if (now >= entry.lockedUntil) {
      entry.lockedUntil = null;
      entry.failures = [];
      this.dropIfIdle(key, entry);
      return 0;
    }
    return Math.ceil((entry.lockedUntil - now) / 1000);
  }

  // Reserves one attempt, or refuses it. Refused when the email is locked, or
  // when its failures plus the attempts already in flight reach the limit:
  // those in-flight attempts are guesses too, and if they fail the email will
  // be locked, so the refusal says to wait the full lock period.
  beginAttempt(email: string, now: number): AttemptStart {
    const locked = this.retryAfterSeconds(email, now);
    if (locked > 0) return { allowed: false, retryAfterSeconds: locked };

    const key = LoginThrottle.key(email);
    const entry = this.entries.get(key) ?? { failures: [], lockedUntil: null, inFlight: 0 };
    entry.failures = entry.failures.filter((at) => now - at < FAILURE_WINDOW_MS);
    if (entry.failures.length + entry.inFlight >= MAX_FAILURES) {
      return { allowed: false, retryAfterSeconds: Math.ceil(LOCK_MS / 1000) };
    }

    entry.inFlight += 1;
    this.touch(key, entry, now);
    return { allowed: true };
  }

  // Releases a reservation with its outcome. Every allowed attempt must end
  // here exactly once, whatever happened, or its slot is never given back.
  endAttempt(email: string, outcome: AttemptOutcome, now: number): void {
    const key = LoginThrottle.key(email);
    const entry = this.entries.get(key) ?? { failures: [], lockedUntil: null, inFlight: 1 };
    entry.inFlight = Math.max(0, entry.inFlight - 1);

    if (outcome === "success") {
      // A successful sign-in clears the count. Attempts still in flight keep
      // their reservations and will report their own outcomes.
      entry.failures = [];
      entry.lockedUntil = null;
    } else if (outcome === "failure") {
      if (entry.lockedUntil === null) {
        entry.failures = entry.failures.filter((at) => now - at < FAILURE_WINDOW_MS);
        entry.failures.push(now);
        // The fifth failure inside the window locks the email from that moment.
        if (entry.failures.length >= MAX_FAILURES) {
          entry.lockedUntil = now + LOCK_MS;
          entry.failures = [];
        }
      }
    }

    if (!this.dropIfIdle(key, entry)) this.touch(key, entry, now);
  }

  // Shorthands for a whole attempt, used where nothing happens between the
  // reservation and its outcome.
  recordFailure(email: string, now: number): void {
    if (this.beginAttempt(email, now).allowed) this.endAttempt(email, "failure", now);
  }

  recordSuccess(email: string, now: number = Date.now()): void {
    if (this.beginAttempt(email, now).allowed) this.endAttempt(email, "success", now);
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  private dropIfIdle(key: string, entry: Entry): boolean {
    if (entry.failures.length === 0 && entry.lockedUntil === null && entry.inFlight === 0) {
      this.entries.delete(key);
      return true;
    }
    return false;
  }

  // Re-insert so the Map's order stays least recently used first, then trim.
  private touch(key: string, entry: Entry, now: number): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.evictIfFull(now);
  }

  // Over the cap, forget the least recently used email that is neither locked
  // nor mid-attempt. Evicting a lock would let anyone lift it early by failing
  // on enough other emails. Only when every tracked email is locked or busy
  // does the oldest go (D-24 records that cost).
  private evictIfFull(now: number): void {
    while (this.entries.size > this.maxTracked) {
      let victim: string | null = null;
      for (const [key, entry] of this.entries) {
        const locked = entry.lockedUntil !== null && now < entry.lockedUntil;
        if (!locked && entry.inFlight === 0) {
          victim = key;
          break;
        }
      }
      this.entries.delete(victim ?? this.entries.keys().next().value!);
    }
  }
}

// The one store the login endpoint uses.
export const loginThrottle = new LoginThrottle();

// Tests call this in beforeEach, so one test's failed logins cannot lock out
// the next test's account.
export function resetLoginThrottle(): void {
  loginThrottle.clear();
}
