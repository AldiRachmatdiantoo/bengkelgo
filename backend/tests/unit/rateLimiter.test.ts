import { MemorySlidingWindowStore } from '../../src/common/middlewares/rateLimiter';

describe('Sliding window rate limiter', () => {
  it('allows up to the limit then blocks within the window', async () => {
    const store = new MemorySlidingWindowStore();
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) {
      expect((await store.hit('k', 60_000, 10, t0 + i)).allowed).toBe(true);
    }
    const blocked = await store.hit('k', 60_000, 10, t0 + 100);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(60_000 - 100);
  });

  it('slides: capacity frees up as old hits leave the window', async () => {
    const store = new MemorySlidingWindowStore();
    await store.hit('k', 1000, 2, 0);
    await store.hit('k', 1000, 2, 500);
    expect((await store.hit('k', 1000, 2, 900)).allowed).toBe(false);
    expect((await store.hit('k', 1000, 2, 1001)).allowed).toBe(true); // first hit expired
    expect((await store.hit('k', 1000, 2, 1200)).allowed).toBe(false);
  });

  it('isolates keys', async () => {
    const store = new MemorySlidingWindowStore();
    await store.hit('a', 1000, 1, 0);
    expect((await store.hit('a', 1000, 1, 1)).allowed).toBe(false);
    expect((await store.hit('b', 1000, 1, 1)).allowed).toBe(true);
  });
});
