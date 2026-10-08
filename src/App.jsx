import React, { useEffect, useMemo, useState } from "react";
import { ALL, CHIPS, DEMAND, POLICIES, ROUNDS, SHARE, TENANTS, run } from "./policy.js";

const COLOR = { A: "#0055a2", B: "#3d7cc9", C: "#8fb3e0", N: "#e5a823", idle: "#d2d2d2" };
const LABEL = { A: "tenant A · quiet", B: "tenant B · quiet", C: "tenant C · quiet", N: "tenant N · noisy" };
const POL_KEYS = Object.keys(POLICIES);

function Chips({ served, idle }) {
  // the bowl: eight chips, coloured by who got them this round; grey chips stayed in the bowl
  const chips = [];
  for (const k of TENANTS) for (let i = 0; i < served[k]; i++) chips.push(k);
  while (chips.length < CHIPS) chips.push("idle");
  return (
    <div className="bowl" aria-label={`chips this round: ${TENANTS.map((k) => `${k} ${served[k]}`).join(", ")}, ${idle} idle`}>
      {chips.map((k, i) => (
        <span key={i} className={`chip ${k === "idle" ? "idle" : ""}`} style={{ background: COLOR[k], color: k === "N" || k === "C" || k === "idle" ? "#1a1a1a" : "#fff" }}>
          {k === "idle" ? "" : k}
        </span>
      ))}
    </div>
  );
}

function Queue({ n, max = 16 }) {
  // units of work waiting after the round, drawn as hollow squares
  return (
    <span className="queue" aria-label={`${n} queued`}>
      {Array.from({ length: Math.min(n, max) }, (_, i) => <i key={i} />)}
      {n > max ? <small>+{n - max}</small> : null}
      {n === 0 ? <small className="muted">none</small> : null}
    </span>
  );
}

function RoundPanel({ row, highlight }) {
  // one round under one policy: demand, chips served, queue after
  return (
    <div className={`round ${highlight ? "hl" : ""}`}>
      <div className="round-head"><b>Round {row.round}</b><span className="muted">{row.idle} idle{row.idleWhileWaiting ? " while someone waited" : ""}</span></div>
      <Chips served={row.served} idle={row.idle} />
      <table className="tenants">
        <tbody>
          {TENANTS.map((k) => (
            <tr key={k}>
              <td className="tn"><span className="dot" style={{ background: COLOR[k] }} />{k}</td>
              <td className="num">asks {row.demand[k]}</td>
              <td className="num">waiting {row.queuedBefore[k]}</td>
              <td className="num"><b>gets {row.served[k]}</b></td>
              <td className="q">left <Queue n={row.queued[k]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogTable({ log, upto }) {
  return (
    <table className="log">
      <thead><tr><th>round</th><th>to A</th><th>to B</th><th>to C</th><th>to N</th><th>idle</th><th>still queued after the round</th></tr></thead>
      <tbody>
        {log.slice(0, upto).map((r) => (
          <tr key={r.round} className={r.idleWhileWaiting ? "waste" : ""}>
            <td>{r.round}</td><td>{r.served.A}</td><td>{r.served.B}</td><td>{r.served.C}</td><td>{r.served.N}</td><td>{r.idle}</td>
            <td className="left">{TENANTS.filter((k) => r.queued[k] > 0).map((k) => `${k} ${r.queued[k]}`).join(", ") || "nothing"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Score({ res, title }) {
  return (
    <div className="score">
      {title ? <h3>{title}</h3> : null}
      <div className="score-grid">
        <div><small>quiet tenant A, longest wait</small><b>{res.longest.A} round{res.longest.A === 1 ? "" : "s"}</b></div>
        <div><small>noisy tenant N, longest wait</small><b>{res.longest.N} round{res.longest.N === 1 ? "" : "s"}</b></div>
        <div><small>chips idle while anyone waited</small><b>{res.idleWhileWaiting}</b></div>
        <div><small>N's queue empty after round</small><b>{res.finishedN ?? "never"}</b></div>
      </div>
    </div>
  );
}

function Watch() {
  const [mode, setMode] = useState("all"); // "all" or a policy key
  const [round, setRound] = useState(0); // rounds revealed, 0..8
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1800);
  useEffect(() => {
    if (!playing) return;
    if (round >= ROUNDS) { setPlaying(false); return; }
    const id = setTimeout(() => setRound((r) => Math.min(ROUNDS, r + 1)), speed);
    return () => clearTimeout(id);
  }, [playing, round, speed]);
  const shown = mode === "all" ? POL_KEYS : [mode];
  return (
    <section>
      <div className="controls">
        <label>Show
          <select value={mode} onChange={(e) => { setMode(e.target.value); }}>
            <option value="all">all three policies side by side</option>
            {POL_KEYS.map((p) => <option key={p} value={p}>{POLICIES[p].name}</option>)}
          </select>
        </label>
        <button className="primary" onClick={() => setRound((r) => Math.min(ROUNDS, r + 1))} disabled={round >= ROUNDS}>Next round</button>
        <button onClick={() => setPlaying((p) => !p)} disabled={round >= ROUNDS}>{playing ? "Pause" : "Play"}</button>
        <button onClick={() => { setRound(0); setPlaying(false); }}>Reset</button>
        <label>Speed
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            <option value={3000}>slow</option><option value={1800}>normal</option><option value={800}>fast</option>
          </select>
        </label>
        <span className="phase">{round === 0 ? "Before round 1. Predict: under which policy does N wait longest?" : round < ROUNDS ? `After round ${round} of ${ROUNDS}` : "All eight rounds played"}</span>
      </div>
      <div className={`cols cols${shown.length}`}>
        {shown.map((p) => {
          const res = ALL[p];
          return (
            <div className="col" key={p}>
              <h2>{POLICIES[p].name}</h2>
              <p className="rule">{POLICIES[p].rule}</p>
              {round === 0 ? (
                <div className="round placeholder">
                  <div className="round-head"><b>Round 1 is about to start</b></div>
                  <table className="tenants"><tbody>
                    {TENANTS.map((k) => (
                      <tr key={k}><td className="tn"><span className="dot" style={{ background: COLOR[k] }} />{k}</td><td className="num">asks {DEMAND[k][0]}</td><td className="num">waiting 0</td><td className="num"><b>gets ?</b></td><td className="q" /></tr>
                    ))}
                  </tbody></table>
                </div>
              ) : (
                <RoundPanel row={res.log[round - 1]} highlight />
              )}
              <LogTable log={res.log} upto={round} />
              {round >= ROUNDS ? <Score res={res} /> : null}
            </div>
          );
        })}
      </div>
      {round >= ROUNDS && mode === "all" ? (
        <div className="debrief">
          <h2>Three policies, one table</h2>
          <table className="log">
            <thead><tr><th>policy</th><th>quiet A, longest wait</th><th>noisy N, longest wait</th><th>chips idle while anyone waited</th><th>N done after round</th><th>in the kernel</th></tr></thead>
            <tbody>
              {POL_KEYS.map((p) => (
                <tr key={p}><td className="left"><b>{POLICIES[p].short}</b></td><td>{ALL[p].longest.A}</td><td>{ALL[p].longest.N}</td><td>{ALL[p].idleWhileWaiting}</td><td>{ALL[p].finishedN}</td><td className="left">{POLICIES[p].kernel}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="ask">You are the provider. Which policy would you sell at a fixed price per chip?</p>
        </div>
      ) : null}
    </section>
  );
}

function Play() {
  // the student is the scheduler: hand out eight chips a round by hand
  const [plan, setPlan] = useState([]); // allocations for rounds already served
  const [alloc, setAlloc] = useState(() => Object.fromEntries(TENANTS.map((k) => [k, 0])));
  const t = plan.length; // current round index
  const partial = useMemo(() => run(null, [...plan, alloc]), [plan, alloc]);
  const state = partial.log[t]; // this round, as it would be with the current allocation
  const waiting = state.queuedBefore;
  const handed = TENANTS.reduce((s, k) => s + alloc[k], 0);
  const done = t >= ROUNDS;
  const result = useMemo(() => (done ? run(null, plan) : null), [done, plan]);
  const change = (k, d) => setAlloc((a) => {
    const v = a[k] + d;
    if (v < 0 || v > waiting[k]) return a;
    if (d > 0 && handed >= CHIPS) return a;
    return { ...a, [k]: v };
  });
  const serve = () => { setPlan((p) => [...p, alloc]); setAlloc(Object.fromEntries(TENANTS.map((k) => [k, 0]))); };
  const reset = () => { setPlan([]); setAlloc(Object.fromEntries(TENANTS.map((k) => [k, 0]))); };
  const preset = (p) => setAlloc(ALL[p].log[t] ? ALL[p].log[t].served : alloc);
  const matches = (res) => POL_KEYS.map((p) => [p, res.log.filter((r, i) => TENANTS.every((k) => r.served[k] === ALL[p].log[i].served[k])).length]);
  return (
    <section>
      <p className="muted">You are the host's scheduler. Each round, every tenant's demand joins its queue; you have {CHIPS} chips and one chip serves one unit of work. Anything you do not serve waits for the next round. Each tenant bought {SHARE} chips a round. Play all eight rounds and compare your score with the three policies.</p>
      {!done ? (
        <div className="playarea">
          <div className="round hl">
            <div className="round-head"><b>Round {t + 1} of {ROUNDS}</b><span className="muted">{CHIPS - handed} chip{CHIPS - handed === 1 ? "" : "s"} left in the bowl</span></div>
            <Chips served={alloc} idle={CHIPS - handed} />
            <table className="tenants play">
              <tbody>
                {TENANTS.map((k) => (
                  <tr key={k}>
                    <td className="tn"><span className="dot" style={{ background: COLOR[k] }} />{LABEL[k]}</td>
                    <td className="num">asks {state.demand[k]}</td>
                    <td className="num">waiting {waiting[k]}</td>
                    <td className="num ctl">
                      <button onClick={() => change(k, -1)} disabled={alloc[k] === 0}>−</button>
                      <b>{alloc[k]}</b>
                      <button onClick={() => change(k, +1)} disabled={alloc[k] >= waiting[k] || handed >= CHIPS}>+</button>
                    </td>
                    <td className="q">left <Queue n={waiting[k] - alloc[k]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="controls">
              <button className="primary" onClick={serve}>Serve round {t + 1}</button>
              <span className="muted">or fill in a policy's answer:</span>
              {POL_KEYS.map((p) => <button key={p} onClick={() => preset(p)}>{POLICIES[p].short}</button>)}
              <button onClick={reset}>Start over</button>
            </div>
          </div>
          {t > 0 ? <LogTable log={run(null, plan).log} upto={t} /> : null}
        </div>
      ) : (
        <div>
          <Score res={result} title="Your eight rounds" />
          <LogTable log={result.log} upto={ROUNDS} />
          <h2>Against the three policies</h2>
          <table className="log">
            <thead><tr><th>scheduler</th><th>quiet A, longest wait</th><th>noisy N, longest wait</th><th>chips idle while anyone waited</th><th>N done after round</th><th>rounds where you did the same</th></tr></thead>
            <tbody>
              <tr className="you"><td className="left"><b>you</b></td><td>{result.longest.A}</td><td>{result.longest.N}</td><td>{result.idleWhileWaiting}</td><td>{result.finishedN ?? "never"}</td><td></td></tr>
              {matches(result).map(([p, n]) => (
                <tr key={p}><td className="left">{POLICIES[p].short}</td><td>{ALL[p].longest.A}</td><td>{ALL[p].longest.N}</td><td>{ALL[p].idleWhileWaiting}</td><td>{ALL[p].finishedN}</td><td>{n} of {ROUNDS}</td></tr>
              ))}
            </tbody>
          </table>
          {result.leftover > 0 ? <p className="warn">{result.leftover} unit{result.leftover === 1 ? "" : "s"} of work never got served. Under all three policies everything is served by round 8.</p> : null}
          <div className="controls"><button className="primary" onClick={reset}>Play again</button></div>
        </div>
      )}
    </section>
  );
}

function About() {
  return (
    <section className="about">
      <h2>The game</h2>
      <p>One host with {CHIPS} chips a round; one chip serves one unit of work. Four tenants each bought {SHARE} chips a round, a quarter of the host. Every round, each tenant's demand joins its queue, the scheduler hands out chips by the round's policy, and anything unserved waits. Eight rounds. The queues reset between policies. Ungraded: there is a loser and it is worth nothing. The point is the policy.</p>
      <h2>The demand cards</h2>
      <table className="log">
        <thead><tr><th>round</th>{Array.from({ length: ROUNDS }, (_, i) => <th key={i}>{i + 1}</th>)}</tr></thead>
        <tbody>
          <tr><td className="left">A, B, C each (quiet)</td>{DEMAND.A.map((d, i) => <td key={i}>{d}</td>)}</tr>
          <tr><td className="left">N (noisy)</td>{DEMAND.N.map((d, i) => <td key={i}>{d}</td>)}</tr>
        </tbody>
      </table>
      <p className="muted">Total demand over eight rounds: 12 units from each quiet tenant and 16 from N, 52 in all, against 64 chips. The host is never short of chips over the game; the policy decides who waits.</p>
      <h2>The three policies</h2>
      <table className="log">
        <thead><tr><th>policy</th><th>rule</th><th>in the kernel</th></tr></thead>
        <tbody>
          {POL_KEYS.map((p) => <tr key={p}><td className="left"><b>{POLICIES[p].short}</b></td><td className="left">{POLICIES[p].rule}</td><td className="left">{POLICIES[p].kernel}</td></tr>)}
        </tbody>
      </table>
      <p>A <b>hard cap</b> is a limit on how much of a resource a group may use in a period, enforced whether or not anyone else wants the remainder (cgroup v2 <code>cpu.max</code>). A <b>proportional share</b> is a weight that divides a resource among groups in proportion to their weights when they contend, and lets any group use what is idle when they do not (cgroup v2 <code>cpu.weight</code>). A policy is <b>work-conserving</b> when it never leaves capacity idle while some group has work; proportional share is, a hard cap is not.</p>
      <h2>Where the numbers come from</h2>
      <p><code>src/policy.js</code> is the model and the answer key; <code>npm run check</code> compares every round with the tables in the CS 218 Session 15 deck (slides 9 to 11) and the course's <code>verify.py</code>. In first-come-first-served, N's 16 units are placed first in round 1, as the key does. Under equal shares the chips go round-robin in the order A, B, C, N.</p>
      <p className="muted">CS 218, Topics in Cloud Computing, San José State University, Fall 2026. Session 15, Activity Thirteen.</p>
    </section>
  );
}

export default function App() {
  const [tab, setTab] = useState("watch");
  return (
    <div className="app">
      <header>
        <div>
          <div className="kicker">CS 218 · SESSION 15 · ACTIVITY THIRTEEN</div>
          <h1>The Noisy Neighbour</h1>
          <p>One host, 8 chips a round. Four tenants who bought 2 each. One of them wants 16.</p>
        </div>
        <nav>
          {[["watch", "Watch"], ["play", "Play"], ["about", "About"]].map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
        </nav>
      </header>
      {tab === "watch" ? <Watch /> : tab === "play" ? <Play /> : <About />}
    </div>
  );
}
