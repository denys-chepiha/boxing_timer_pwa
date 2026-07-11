// Core
import { describe, expect, it } from 'vitest';
// Engine
import {
  AudioCue,
  TimerConfig,
  TimerSnapshot,
  buildAudioTimeline,
  createInitialSnapshot,
  jumpToRound,
  pauseTimer,
  resetTimer,
  resumeTimer,
  skipRestPhase,
  skipWorkPhase,
  startTimer,
  tickTimer,
} from '@/engine/timerEngine';

const config = (
  rounds: { workSeconds: number; restSeconds: number }[],
  prepSeconds = 0,
): TimerConfig => ({ rounds, prepSeconds });

// 2-round program: R1 work 3 / rest 2, R2 work 3 / no rest.
const twoRounds = config([
  { workSeconds: 3, restSeconds: 2 },
  { workSeconds: 3, restSeconds: 0 },
]);

describe('createInitialSnapshot', () => {
  it('starts in prep when a prep countdown is configured', () => {
    const snap = createInitialSnapshot(config([{ workSeconds: 5, restSeconds: 2 }], 3));
    expect(snap).toMatchObject({
      status: 'idle',
      phase: 'prep',
      prepTargetPhase: 'work',
      currentRound: 1,
      remainingSeconds: 3,
      phaseDurationSeconds: 3,
      phaseStartedAt: null,
    });
  });

  it('starts straight in work when there is no prep', () => {
    const snap = createInitialSnapshot(twoRounds);
    expect(snap).toMatchObject({ phase: 'work', remainingSeconds: 3, phaseDurationSeconds: 3 });
  });
});

describe('startTimer', () => {
  it('begins work immediately and emits a work event when prep is 0', () => {
    const { snapshot, events } = startTimer(createInitialSnapshot(twoRounds), twoRounds, 1000);
    expect(snapshot).toMatchObject({ status: 'running', phase: 'work', phaseStartedAt: 1000 });
    expect(events).toEqual([{ type: 'phase_started', phase: 'work' }]);
  });

  it('begins in prep with no event when prep is configured', () => {
    const cfg = config([{ workSeconds: 3, restSeconds: 1 }], 5);
    const { snapshot, events } = startTimer(createInitialSnapshot(cfg), cfg, 1000);
    expect(snapshot).toMatchObject({ status: 'running', phase: 'prep', remainingSeconds: 5 });
    expect(events).toEqual([]);
  });

  it('is a no-op when already running', () => {
    const running = startTimer(createInitialSnapshot(twoRounds), twoRounds, 1000).snapshot;
    const { snapshot, events } = startTimer(running, twoRounds, 2000);
    expect(snapshot).toBe(running);
    expect(events).toEqual([]);
  });
});

describe('pause / resume', () => {
  it('captures elapsed time on pause and restores the anchor on resume', () => {
    const running = startTimer(createInitialSnapshot(twoRounds), twoRounds, 1000).snapshot;
    const paused = pauseTimer(running, 2500); // 1.5s elapsed of a 3s phase
    expect(paused.status).toBe('paused');
    expect(paused.elapsedBeforePauseSeconds).toBeCloseTo(1.5);
    expect(paused.remainingSeconds).toBe(2); // ceil(3 - 1.5)
    expect(paused.phaseStartedAt).toBeNull();

    const resumed = resumeTimer(paused, 10000);
    expect(resumed.status).toBe('running');
    // Anchor is shifted back so the same 1.5s remains elapsed.
    expect(resumed.phaseStartedAt).toBe(10000 - 1500);
  });

  it('ignores pause when not running and resume when not paused', () => {
    const idle = createInitialSnapshot(twoRounds);
    expect(pauseTimer(idle, 1000)).toBe(idle);
    expect(resumeTimer(idle, 1000)).toBe(idle);
  });
});

describe('resetTimer', () => {
  it('returns a fresh idle snapshot', () => {
    const running = startTimer(createInitialSnapshot(twoRounds), twoRounds, 1000).snapshot;
    expect(resetTimer(twoRounds)).toMatchObject({ status: 'idle', currentRound: 1 });
    expect(running.status).toBe('running'); // original untouched
  });
});

describe('tickTimer', () => {
  it('decrements remaining within a phase without events', () => {
    const running = startTimer(createInitialSnapshot(twoRounds), twoRounds, 0).snapshot;
    const { snapshot, events } = tickTimer(running, twoRounds, 1200);
    expect(snapshot.remainingSeconds).toBe(2); // ceil(3 - 1.2)
    expect(snapshot.phase).toBe('work');
    expect(events).toEqual([]);
  });

  it('does nothing when not running', () => {
    const idle = createInitialSnapshot(twoRounds);
    expect(tickTimer(idle, twoRounds, 5000).snapshot).toBe(idle);
  });

  it('advances work -> rest at the boundary and emits a rest event', () => {
    const running = startTimer(createInitialSnapshot(twoRounds), twoRounds, 0).snapshot;
    const { snapshot, events } = tickTimer(running, twoRounds, 3000);
    expect(snapshot.phase).toBe('rest');
    expect(snapshot.phaseStartedAt).toBe(3000);
    expect(snapshot.remainingSeconds).toBe(2);
    expect(events).toEqual([{ type: 'phase_started', phase: 'rest' }]);
  });

  it('advances rest -> next round work and increments the round', () => {
    const running = startTimer(createInitialSnapshot(twoRounds), twoRounds, 0).snapshot;
    const { snapshot, events } = tickTimer(running, twoRounds, 5000); // past work(3)+rest(2)
    expect(snapshot.phase).toBe('work');
    expect(snapshot.currentRound).toBe(2);
    expect(events).toEqual([
      { type: 'phase_started', phase: 'rest' },
      { type: 'phase_started', phase: 'work' },
    ]);
  });

  it('finishes after the final round when it has no rest', () => {
    const running = startTimer(createInitialSnapshot(twoRounds), twoRounds, 0).snapshot;
    const { snapshot } = tickTimer(running, twoRounds, 999000);
    expect(snapshot.status).toBe('finished');
    expect(snapshot.phase).toBe('finished');
    expect(snapshot.remainingSeconds).toBe(0);
  });

  it('advances work -> next round directly when rest is 0', () => {
    const cfg = config([
      { workSeconds: 2, restSeconds: 0 },
      { workSeconds: 2, restSeconds: 0 },
    ]);
    const running = startTimer(createInitialSnapshot(cfg), cfg, 0).snapshot;
    const { snapshot, events } = tickTimer(running, cfg, 2000);
    expect(snapshot.phase).toBe('work');
    expect(snapshot.currentRound).toBe(2);
    expect(events).toEqual([{ type: 'phase_started', phase: 'work' }]);
  });

  it('plays a configured rest after the final round, then finishes', () => {
    const cfg = config([{ workSeconds: 2, restSeconds: 2 }]);
    const running = startTimer(createInitialSnapshot(cfg), cfg, 0).snapshot;
    const afterWork = tickTimer(running, cfg, 2000).snapshot;
    expect(afterWork.phase).toBe('rest');
    const afterRest = tickTimer(afterWork, cfg, 4000).snapshot;
    expect(afterRest.status).toBe('finished');
  });

  it('transitions prep -> work and emits the work event', () => {
    const cfg = config([{ workSeconds: 3, restSeconds: 0 }], 2);
    const running = startTimer(createInitialSnapshot(cfg), cfg, 0).snapshot;
    expect(running.phase).toBe('prep');
    const { snapshot, events } = tickTimer(running, cfg, 2000);
    expect(snapshot.phase).toBe('work');
    expect(events).toEqual([{ type: 'phase_started', phase: 'work' }]);
  });
});

describe('skipWorkPhase', () => {
  it('jumps to a prep countdown targeting the upcoming rest', () => {
    const running = startTimer(createInitialSnapshot(twoRounds), twoRounds, 0).snapshot;
    const skipped = skipWorkPhase(running, twoRounds, 5000, 3);
    expect(skipped).toMatchObject({
      phase: 'prep',
      prepTargetPhase: 'rest',
      remainingSeconds: 3,
      phaseStartedAt: 5000,
    });
  });

  it('jumps straight into rest when prep is 0', () => {
    const running = startTimer(createInitialSnapshot(twoRounds), twoRounds, 0).snapshot;
    const skipped = skipWorkPhase(running, twoRounds, 5000, 0);
    expect(skipped).toMatchObject({ phase: 'rest', remainingSeconds: 2, phaseStartedAt: 5000 });
  });

  it('finishes when skipping the last round that has no rest (prep 0)', () => {
    const cfg = config([{ workSeconds: 3, restSeconds: 0 }]);
    const running = startTimer(createInitialSnapshot(cfg), cfg, 0).snapshot;
    expect(skipWorkPhase(running, cfg, 1000, 0).status).toBe('finished');
  });

  it('advances to the next round when current round has no rest (prep 0)', () => {
    const cfg = config([
      { workSeconds: 3, restSeconds: 0 },
      { workSeconds: 4, restSeconds: 0 },
    ]);
    const running = startTimer(createInitialSnapshot(cfg), cfg, 0).snapshot;
    const skipped = skipWorkPhase(running, cfg, 1000, 0);
    expect(skipped).toMatchObject({ phase: 'work', currentRound: 2, remainingSeconds: 4 });
  });

  it('does nothing outside a work phase', () => {
    const rest = tickTimer(startTimer(createInitialSnapshot(twoRounds), twoRounds, 0).snapshot, twoRounds, 3000).snapshot;
    expect(skipWorkPhase(rest, twoRounds, 4000, 0)).toBe(rest);
  });
});

describe('skipRestPhase', () => {
  const restSnap = () =>
    tickTimer(startTimer(createInitialSnapshot(twoRounds), twoRounds, 0).snapshot, twoRounds, 3000).snapshot;

  it('jumps to a prep countdown for the next round', () => {
    const skipped = skipRestPhase(restSnap(), twoRounds, 9000, 3);
    expect(skipped).toMatchObject({ phase: 'prep', prepTargetPhase: 'work', currentRound: 2 });
  });

  it('jumps straight to the next round work when prep is 0', () => {
    const skipped = skipRestPhase(restSnap(), twoRounds, 9000, 0);
    expect(skipped).toMatchObject({ phase: 'work', currentRound: 2, remainingSeconds: 3 });
  });

  it('finishes when skipping a rest after the final round', () => {
    const cfg = config([{ workSeconds: 2, restSeconds: 2 }]);
    const rest = tickTimer(startTimer(createInitialSnapshot(cfg), cfg, 0).snapshot, cfg, 2000).snapshot;
    expect(skipRestPhase(rest, cfg, 3000, 0).status).toBe('finished');
  });

  it('does nothing outside a rest phase', () => {
    const work = startTimer(createInitialSnapshot(twoRounds), twoRounds, 0).snapshot;
    expect(skipRestPhase(work, twoRounds, 1000, 0)).toBe(work);
  });
});

describe('buildAudioTimeline', () => {
  it('returns no cues for an idle / unstarted snapshot', () => {
    expect(buildAudioTimeline(createInitialSnapshot(twoRounds), twoRounds)).toEqual([]);
  });

  it('returns no cues once finished', () => {
    const finished: TimerSnapshot = { ...createInitialSnapshot(twoRounds), status: 'finished', phaseStartedAt: 1 };
    expect(buildAudioTimeline(finished, twoRounds)).toEqual([]);
  });

  it('enumerates a gong per phase and ticks for the final seconds', () => {
    const running = startTimer(createInitialSnapshot(twoRounds), twoRounds, 0).snapshot;
    const cues = buildAudioTimeline(running, twoRounds);

    const gongs = cues.filter((c) => c.kind === 'gong').map((c) => c.atMs);
    const ticks = cues.filter((c) => c.kind === 'tick').map((c) => c.atMs);

    // Gong at the start of work R1 (0), rest R1 (3000), work R2 (5000).
    expect(gongs).toEqual([0, 3000, 5000]);
    // Ticks for the last 3s of work phases and last 2s of the rest phase.
    expect(ticks).toEqual([0, 1000, 2000, 3000, 4000, 5000, 6000, 7000]);
  });

  it('caps ticks to the trailing lastSeconds window', () => {
    const cfg = config([{ workSeconds: 60, restSeconds: 0 }]);
    const running = startTimer(createInitialSnapshot(cfg), cfg, 0).snapshot;
    const cues = buildAudioTimeline(running, cfg, 10);
    const ticks = cues.filter((c: AudioCue) => c.kind === 'tick');
    expect(ticks).toHaveLength(10);
    // First tick lands at duration - 10 = 50s.
    expect(ticks[0].atMs).toBe(50000);
  });

  it('honours an absolute phase start anchor', () => {
    const cfg = config([{ workSeconds: 3, restSeconds: 0 }]);
    const running = startTimer(createInitialSnapshot(cfg), cfg, 10000).snapshot;
    const cues = buildAudioTimeline(running, cfg);
    expect(cues.find((c) => c.kind === 'gong')?.atMs).toBe(10000);
  });

  it('ends with a single completion cue at the session end', () => {
    const running = startTimer(createInitialSnapshot(twoRounds), twoRounds, 0).snapshot;
    const completes = buildAudioTimeline(running, twoRounds).filter((c) => c.kind === 'complete');
    // R1 work 3 + rest 2 + R2 work 3 = 8000ms.
    expect(completes.map((c) => c.atMs)).toEqual([8000]);
  });

  it('ticks each second of the prep countdown', () => {
    const cfg = config([{ workSeconds: 3, restSeconds: 0 }], 3);
    const running = startTimer(createInitialSnapshot(cfg), cfg, 0).snapshot;
    const cues = buildAudioTimeline(running, cfg);
    // Prep ticks at 0s, 1s, 2s; then the work gong lands at 3000.
    const ticks = cues.filter((c) => c.kind === 'tick').map((c) => c.atMs);
    expect(ticks).toContain(0);
    expect(ticks).toContain(1000);
    expect(ticks).toContain(2000);
    expect(cues.find((c) => c.kind === 'gong')?.atMs).toBe(3000);
  });
});

describe('jumpToRound', () => {
  it('jumps straight into a round (work) when there is no prep', () => {
    const idle = createInitialSnapshot(twoRounds);
    const next = jumpToRound(idle, twoRounds, 1000, 2, 0);
    expect(next.status).toBe('running');
    expect(next.phase).toBe('work');
    expect(next.currentRound).toBe(2);
    expect(next.remainingSeconds).toBe(3);
    expect(next.phaseStartedAt).toBe(1000);
  });

  it('runs the prep countdown toward the target round when prep is set', () => {
    const idle = createInitialSnapshot(twoRounds);
    const next = jumpToRound(idle, twoRounds, 1000, 2, 5);
    expect(next.phase).toBe('prep');
    expect(next.prepTargetPhase).toBe('work');
    expect(next.currentRound).toBe(2);
    expect(next.remainingSeconds).toBe(5);
  });

  it('clamps the target round to the available range', () => {
    const idle = createInitialSnapshot(twoRounds);
    expect(jumpToRound(idle, twoRounds, 0, 99, 0).currentRound).toBe(2);
    expect(jumpToRound(idle, twoRounds, 0, 0, 0).currentRound).toBe(1);
  });
});

describe('buildAudioTimeline — warnings & long sessions', () => {
  // 5 identical 60s work rounds, no rest.
  const longConfig = config(
    Array.from({ length: 5 }, () => ({ workSeconds: 60, restSeconds: 0 })),
  );

  it('keeps a full 10-second countdown on every round, not just the first', () => {
    const running = startTimer(createInitialSnapshot(longConfig), longConfig, 0).snapshot;
    const cues = buildAudioTimeline(running, longConfig);
    const ticks = cues.filter((c) => c.kind === 'tick');

    // 5 rounds × 10 trailing ticks.
    expect(ticks).toHaveLength(50);
    // Round 5 starts at 4×60s = 240s and still has its 10 ticks.
    const lastRoundTicks = ticks.filter((c) => c.atMs >= 240000);
    expect(lastRoundTicks).toHaveLength(10);
    expect(lastRoundTicks[0].atMs).toBe(290000); // 240s + (60-10)
  });

  it('adds a single 30s warning before each work round end', () => {
    const running = startTimer(createInitialSnapshot(longConfig), longConfig, 0).snapshot;
    const warns = buildAudioTimeline(running, longConfig)
      .filter((c) => c.kind === 'warn')
      .map((c) => c.atMs);

    // One per round, 30s before each 60s round's end: 30s, 90s, 150s, 210s, 270s.
    expect(warns).toEqual([30000, 90000, 150000, 210000, 270000]);
  });

  it('omits the 30s warning for rounds at or under 30s', () => {
    const shortCfg = config([{ workSeconds: 20, restSeconds: 0 }]);
    const running = startTimer(createInitialSnapshot(shortCfg), shortCfg, 0).snapshot;
    expect(buildAudioTimeline(running, shortCfg).some((c) => c.kind === 'warn')).toBe(false);
  });

  it('adds a single 30s warning before each rest phase ends', () => {
    // 3 rounds, 20s work (too short for its own warning) / 60s rest — no rest
    // after the final round, so the session ends right after round 3's work.
    const restCfg = config([
      { workSeconds: 20, restSeconds: 60 },
      { workSeconds: 20, restSeconds: 60 },
      { workSeconds: 20, restSeconds: 0 },
    ]);
    const running = startTimer(createInitialSnapshot(restCfg), restCfg, 0).snapshot;
    const restWarns = buildAudioTimeline(running, restCfg)
      .filter((c) => c.kind === 'restWarn')
      .map((c) => c.atMs);

    // Rest 1 starts at 20s, ends at 80s → warning at 50s.
    // Rest 2 starts at 100s, ends at 160s → warning at 130s.
    expect(restWarns).toEqual([50000, 130000]);
  });

  it('omits the 30s rest warning for rests at or under 30s', () => {
    const shortRestCfg = config([{ workSeconds: 20, restSeconds: 25 }]);
    const running = startTimer(createInitialSnapshot(shortRestCfg), shortRestCfg, 0).snapshot;
    expect(buildAudioTimeline(running, shortRestCfg).some((c) => c.kind === 'restWarn')).toBe(
      false,
    );
  });
});
