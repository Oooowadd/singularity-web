import type { ErrorKind, ProxySession, SessionOutcome } from "./types";

type Health = {
  consecutive403: number;
  consecutiveErr: number;
  dead: boolean;
  outcome: SessionOutcome;
};

// 403 is a "session-fatal" signal (IP blocked by YouTube); other errors are softer.
const FATAL_403_THRESHOLD = 3;
const SOFT_ERR_THRESHOLD = 5;

export class ProxyPool {
  private readonly sessions: ProxySession[];
  private readonly health = new Map<string, Health>();
  private cursor = 0;

  constructor(sessions: ProxySession[]) {
    this.sessions = sessions;
    for (const s of sessions) {
      this.health.set(s.id, this.freshHealth());
    }
  }

  get size(): number {
    return this.sessions.length;
  }

  get aliveCount(): number {
    let n = 0;
    for (const h of this.health.values()) if (!h.dead) n++;
    return n;
  }

  checkout(opts?: { excludeProvider?: string }): ProxySession {
    const start = this.cursor;
    for (let i = 0; i < this.sessions.length; i++) {
      const idx = (start + i) % this.sessions.length;
      const session = this.sessions[idx]!;
      const h = this.health.get(session.id)!;
      if (h.dead) continue;
      if (opts?.excludeProvider && session.provider === opts.excludeProvider) continue;
      this.cursor = (idx + 1) % this.sessions.length;
      return session;
    }
    throw new Error(
      `ProxyPool: no healthy sessions (${this.sessions.length} total, all dead in this run)`,
    );
  }

  reportOk(session: ProxySession, bytesUsed: number): void {
    const h = this.health.get(session.id)!;
    h.consecutive403 = 0;
    h.consecutiveErr = 0;
    h.outcome.okDelta++;
    h.outcome.bytesDelta += bytesUsed;
  }

  reportErr(session: ProxySession, error: string, kind: ErrorKind): void {
    const h = this.health.get(session.id)!;
    h.outcome.errDelta++;
    h.outcome.lastError = error.slice(0, 500);
    if (kind === "auth_failed") {
      this.markDead(h, "auth_failed");
      return;
    }
    if (kind === "consecutive_403") {
      h.consecutive403++;
      if (h.consecutive403 >= FATAL_403_THRESHOLD) {
        this.markDead(h, "consecutive_403");
      }
      return;
    }
    h.consecutiveErr++;
    if (h.consecutiveErr >= SOFT_ERR_THRESHOLD) {
      this.markDead(h, "consecutive_errors");
    }
  }

  flush(): Map<string, SessionOutcome> {
    const out = new Map<string, SessionOutcome>();
    for (const [id, h] of this.health.entries()) {
      if (h.outcome.okDelta === 0 && h.outcome.errDelta === 0 && !h.outcome.newlyDisabled) {
        continue;
      }
      out.set(id, h.outcome);
    }
    return out;
  }

  stats(): {
    total: number;
    alive: number;
    deadInRun: number;
    bytesByProvider: Record<string, number>;
    okByProvider: Record<string, number>;
    errByProvider: Record<string, number>;
  } {
    const bytesByProvider: Record<string, number> = {};
    const okByProvider: Record<string, number> = {};
    const errByProvider: Record<string, number> = {};
    let deadInRun = 0;
    for (const s of this.sessions) {
      const h = this.health.get(s.id)!;
      bytesByProvider[s.provider] = (bytesByProvider[s.provider] ?? 0) + h.outcome.bytesDelta;
      okByProvider[s.provider] = (okByProvider[s.provider] ?? 0) + h.outcome.okDelta;
      errByProvider[s.provider] = (errByProvider[s.provider] ?? 0) + h.outcome.errDelta;
      if (h.outcome.newlyDisabled) deadInRun++;
    }
    return {
      total: this.sessions.length,
      alive: this.aliveCount,
      deadInRun,
      bytesByProvider,
      okByProvider,
      errByProvider,
    };
  }

  private markDead(h: Health, reason: string): void {
    if (h.dead) return;
    h.dead = true;
    h.outcome.newlyDisabled = true;
    h.outcome.disabledReason = reason;
  }

  private freshHealth(): Health {
    return {
      consecutive403: 0,
      consecutiveErr: 0,
      dead: false,
      outcome: {
        okDelta: 0,
        errDelta: 0,
        bytesDelta: 0,
        newlyDisabled: false,
        disabledReason: null,
        lastError: null,
      },
    };
  }
}
