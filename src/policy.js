// The model behind Activity Thirteen, ported line for line from the course's verify.py
// (CS 218 Session 15). One host, 8 chips a round, 8 rounds, four tenants who each bought 2 chips a round.
// This file is the answer key: npm run check compares it with the numbers on the lecture slides.

export const ROUNDS = 8;
export const CHIPS = 8;
export const SHARE = 2; // chips each tenant bought per round, a quarter of the host
export const TENANTS = ["A", "B", "C", "N"];

// Demand cards. A, B and C are quiet (2, 1, 2, 1, ...). N is noisy: 16 in round 1, then nothing.
export function demand(tenant, round) {
  if (tenant === "N") return round === 0 ? 16 : 0;
  return round % 2 === 0 ? 2 : 1;
}
export const DEMAND = Object.fromEntries(TENANTS.map((k) => [k, Array.from({ length: ROUNDS }, (_, r) => demand(k, r))]));

export const POLICIES = {
  fifo: {
    name: "Policy 1: first come, first served",
    short: "First come, first served",
    rule: "Serve work in the order it arrived. In round 1, N's 16 arrived first.",
    kernel: "no isolation at all",
  },
  caps: {
    name: "Policy 2: hard caps, 2 each",
    short: "Hard caps, 2 each",
    rule: "Nobody gets more than 2 chips a round, even when chips are left in the bowl.",
    kernel: "cgroup v2 cpu.max (Session 9)",
  },
  shares: {
    name: "Policy 3: equal shares, nothing wasted",
    short: "Equal shares, nothing wasted",
    rule: "One chip at a time, round-robin, to anyone with work, until the bowl is empty or nobody needs more.",
    kernel: "cgroup v2 cpu.weight; work-conserving",
  },
};

// Decide one round's allocation under a policy. queues: {A: [arrivalRound, ...], ...} (after this round's
// arrivals were appended). gq: the global FIFO of [arrivalRound, tenant] in arrival order (N first on its
// burst round, as the key places it). Returns {A: n, B: n, C: n, N: n}.
export function allocate(policy, queues, gq) {
  const a = Object.fromEntries(TENANTS.map((k) => [k, 0]));
  if (policy === "fifo") {
    for (const [, k] of gq.slice(0, CHIPS)) a[k] += 1;
    return a;
  }
  const d = Object.fromEntries(TENANTS.map((k) => [k, queues[k].length]));
  if (policy === "caps") {
    for (const k of TENANTS) a[k] = Math.min(d[k], SHARE);
    return a;
  }
  // equal shares, work-conserving: round-robin one chip at a time to anyone with work
  let left = CHIPS;
  while (left > 0 && TENANTS.some((k) => a[k] < d[k])) {
    for (const k of TENANTS) {
      if (left > 0 && a[k] < d[k]) { a[k] += 1; left -= 1; }
    }
  }
  return a;
}

// Run eight rounds. If `plan` is given (an array of eight allocations, one per round), it is used instead of
// the policy: that is Play mode, the student as scheduler. Returns the round log and the scoreboard.
export function run(policy, plan = null) {
  const queues = Object.fromEntries(TENANTS.map((k) => [k, []]));
  const waits = Object.fromEntries(TENANTS.map((k) => [k, []]));
  let gq = [];
  let idleWhileWaiting = 0;
  const log = [];
  for (let t = 0; t < ROUNDS; t++) {
    for (const k of ["N", "A", "B", "C"]) {
      for (let i = 0; i < demand(k, t); i++) { queues[k].push(t); gq.push([t, k]); }
    }
    const queuedBefore = Object.fromEntries(TENANTS.map((k) => [k, queues[k].length]));
    const served = plan ? (plan[t] || {}) : allocate(policy, queues, gq);
    let total = 0;
    for (const k of TENANTS) {
      const n = Math.min(served[k] || 0, queues[k].length);
      for (let i = 0; i < n; i++) {
        const at = queues[k].shift();
        waits[k].push(t - at);
        total += 1;
      }
      // keep the global FIFO in step: drop the first n entries of tenant k
      let dropped = 0;
      gq = gq.filter(([, kk]) => { if (kk === k && dropped < n) { dropped += 1; return false; } return true; });
    }
    const idle = CHIPS - total;
    const anyWaiting = TENANTS.some((k) => queues[k].length > 0);
    if (anyWaiting) idleWhileWaiting += idle;
    log.push({
      round: t + 1,
      demand: Object.fromEntries(TENANTS.map((k) => [k, demand(k, t)])),
      queuedBefore,
      served: Object.fromEntries(TENANTS.map((k) => [k, Math.min(served[k] || 0, queuedBefore[k])])),
      idle,
      idleWhileWaiting: anyWaiting ? idle : 0,
      queued: Object.fromEntries(TENANTS.map((k) => [k, queues[k].length])),
    });
  }
  const longest = Object.fromEntries(TENANTS.map((k) => [k, waits[k].length ? Math.max(...waits[k]) : 0]));
  const nDone = log.findIndex((r) => r.queued.N === 0 && r.round >= 1);
  const finishedN = nDone >= 0 ? log[nDone].round : null;
  const leftover = TENANTS.reduce((s, k) => s + queues[k].length, 0);
  return { log, longest, idleWhileWaiting, finishedN, leftover, waits };
}

export const ALL = Object.fromEntries(Object.keys(POLICIES).map((p) => [p, run(p)]));
