export class RateLimitManager {
  private limits: Map<string, { count: number; resetTime: number }> = new Map();

  async checkLimit(provider: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const state = this.limits.get(provider) || { count: 0, resetTime: now + windowMs };

    if (state.resetTime < now) {
      state.count = 0;
      state.resetTime = now + windowMs;
    }

    if (state.count >= limit) {
      return false; // Rate limit exceeded
    }

    state.count++;
    this.limits.set(provider, state);
    return true; // Request allowed
  }
}
