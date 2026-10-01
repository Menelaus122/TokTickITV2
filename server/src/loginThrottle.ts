// Login attempt throttling — Lab 3 BR-67, D-24.
//
// Failures are counted per normalised email, never per IP: behind one campus
// proxy or NAT every user shares an address, so an IP limit would lock out
// whole buildings. Unknown emails are counted exactly like real ones, because
// a 429 for one and a 401 for the other would reveal which emails exist
// (BR-16).
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
}

export class LoginThrottle {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly maxTracked: number = MAX_TRACKED_EMAILS) {}

  static key(email: string): string {
    return email.trim().toLowerCase();
  }

  // Seconds until this email may try again; 0 when it may try now. An expired
  // lock is cleared here, so the email starts from a clean count.
  retryAfterSeconds(email: string, now: number): number {
    const key = LoginThrottle.key(email);
    const entry = this.entries.get(key);
    if (!entry || entry.lockedUntil === null) return 0;
    if (now >= entry.lockedUntil) {
      this.entries.delete(key);
      return 0;
    }
    return Math.ceil((entry.lockedUntil - now) / 1000);
  }

  // The fifth failure inside the window locks the email for LOCK_MS from that
  // moment. A locked email is refused before its password is checked, so no
  // failure is recorded while the lock lasts.
  recordFailure(email: string, now: number): void {
    const key = LoginThrottle.key(email);
    const previous = this.entries.get(key);
    const entry: Entry =
      previous && (previous.lockedUntil === null || now < previous.lockedUntil)
        ? previous
        : { failures: [], lockedUntil: null };

    entry.failures = entry.failures.filter((at) => now - at < FAILURE_WINDOW_MS);
    entry.failures.push(now);
    if (entry.failures.length >= MAX_FAILURES) {
      entry.lockedUntil = now + LOCK_MS;
      entry.failures = [];
    }

    // Re-insert so the Map's order stays least recently failed first.
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.evictIfFull(now);
  }

  // A successful sign-in clears the email's count.
  recordSuccess(email: string): void {
    this.entries.delete(LoginThrottle.key(email));
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  // Over the cap, forget the least recently failed email that is NOT locked.
  // Evicting a lock would let anyone lift it early by failing on enough other
  // emails. Only when every tracked email is locked does the oldest lock go.
  private evictIfFull(now: number): void {
    while (this.entries.size > this.maxTracked) {
      let victim: string | null = null;
      for (const [key, entry] of this.entries) {
        if (entry.lockedUntil === null || now >= entry.lockedUntil) {
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
