// npm run check: re-runs the three policies and compares every round with the course's answer key
// (the Session 15 verify.py and the tables on slides 9 to 11). Exits non-zero on any mismatch.
import { ALL, run, DEMAND } from "../src/policy.js";

const q = (A, B, C, N) => ({ A, B, C, N });
// rows: [to A, to B, to C, to N, idle, queued after the round]
const WANT = {
  fifo: {
    rows: [[0, 0, 0, 8, 0, q(2, 2, 2, 8)], [0, 0, 0, 8, 0, q(3, 3, 3, 0)], [3, 3, 2, 0, 0, q(2, 2, 3, 0)], [3, 2, 3, 0, 0, q(0, 1, 1, 0)],
      [2, 3, 3, 0, 0, q(0, 0, 0, 0)], [1, 1, 1, 0, 5, q(0, 0, 0, 0)], [2, 2, 2, 0, 2, q(0, 0, 0, 0)], [1, 1, 1, 0, 5, q(0, 0, 0, 0)]],
    longest: q(2, 2, 2, 1), idleWhileWaiting: 0, finishedN: 2,
  },
  caps: {
    rows: [[2, 2, 2, 2, 0, q(0, 0, 0, 14)], [1, 1, 1, 2, 3, q(0, 0, 0, 12)], [2, 2, 2, 2, 0, q(0, 0, 0, 10)], [1, 1, 1, 2, 3, q(0, 0, 0, 8)],
      [2, 2, 2, 2, 0, q(0, 0, 0, 6)], [1, 1, 1, 2, 3, q(0, 0, 0, 4)], [2, 2, 2, 2, 0, q(0, 0, 0, 2)], [1, 1, 1, 2, 3, q(0, 0, 0, 0)]],
    longest: q(0, 0, 0, 7), idleWhileWaiting: 9, finishedN: 8,
  },
  shares: {
    rows: [[2, 2, 2, 2, 0, q(0, 0, 0, 14)], [1, 1, 1, 5, 0, q(0, 0, 0, 9)], [2, 2, 2, 2, 0, q(0, 0, 0, 7)], [1, 1, 1, 5, 0, q(0, 0, 0, 2)],
      [2, 2, 2, 2, 0, q(0, 0, 0, 0)], [1, 1, 1, 0, 5, q(0, 0, 0, 0)], [2, 2, 2, 0, 2, q(0, 0, 0, 0)], [1, 1, 1, 0, 5, q(0, 0, 0, 0)]],
    longest: q(0, 0, 0, 4), idleWhileWaiting: 0, finishedN: 5,
  },
};
let fails = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${JSON.stringify(got)}${ok ? "" : `  (wanted ${JSON.stringify(want)})`}`);
  if (!ok) fails++;
};
check("demand cards A", DEMAND.A, [2, 1, 2, 1, 2, 1, 2, 1]);
check("demand cards N", DEMAND.N, [16, 0, 0, 0, 0, 0, 0, 0]);
check("each tenant bought a quarter of the host", 8 / 4, 2);
for (const [pol, w] of Object.entries(WANT)) {
  const r = ALL[pol];
  console.log(`\n== ${pol}`);
  check("rows (to A, B, C, N, idle, queued after)", r.log.map((x) => [x.served.A, x.served.B, x.served.C, x.served.N, x.idle, x.queued]), w.rows);
  check("longest wait per tenant, rounds", r.longest, w.longest);
  check("chips idle while anyone waited", r.idleWhileWaiting, w.idleWhileWaiting);
  check("round N's queue is first empty", r.finishedN, w.finishedN);
  check("nothing left queued after round 8", r.leftover, 0);
  check("chips served over eight rounds = total demand 12 x 3 + 16", r.log.reduce((s, x) => s + 8 - x.idle, 0), 52);
}
// Play mode: handing the policy's own allocations back in as a plan reproduces the policy
for (const pol of Object.keys(WANT)) {
  const plan = ALL[pol].log.map((x) => x.served);
  check(`play mode replays ${pol}`, run(null, plan).log.map((x) => x.served), ALL[pol].log.map((x) => x.served));
}
console.log(`\n${fails} failed`);
process.exit(fails ? 1 : 0);
