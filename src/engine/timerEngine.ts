// Types
import { RoundConfig, TimerPhase, TimerStatus } from '@/types/models';

export type TimerConfig = {
  /** One entry per round, in order. `restSeconds` is the rest after that round. */
  rounds: RoundConfig[];
  prepSeconds: number;
};

export type TimerSnapshot = {
  status: TimerStatus;
  phase: TimerPhase;
  prepTargetPhase: Extract<TimerPhase, 'work' | 'rest' | 'finished'>;
  currentRound: number;
  remainingSeconds: number;
  phaseStartedAt: number | null;
  phaseDurationSeconds: number;
  elapsedBeforePauseSeconds: number;
};

export type TimerEvent = {
  type: 'phase_started';
  phase: Extract<TimerPhase, 'work' | 'rest'>;
};

const roundCount = (config: TimerConfig): number => config.rounds.length;

/** Work duration for a 1-based round number. */
const workOf = (config: TimerConfig, round: number): number =>
  config.rounds[round - 1]?.workSeconds ?? 0;

/** Rest-after duration for a 1-based round number. */
const restOf = (config: TimerConfig, round: number): number =>
  config.rounds[round - 1]?.restSeconds ?? 0;

export const createInitialSnapshot = (config: TimerConfig): TimerSnapshot => {
  const firstWork = workOf(config, 1);
  const hasPrep = config.prepSeconds > 0;
  return {
    status: 'idle',
    phase: hasPrep ? 'prep' : 'work',
    prepTargetPhase: 'work',
    currentRound: 1,
    remainingSeconds: hasPrep ? config.prepSeconds : firstWork,
    phaseStartedAt: null,
    phaseDurationSeconds: hasPrep ? config.prepSeconds : firstWork,
    elapsedBeforePauseSeconds: 0,
  };
};

const toRemaining = (duration: number, elapsedSec: number): number => {
  const value = Math.ceil(duration - elapsedSec);
  return value > 0 ? value : 0;
};

const beginPhase = (
  snapshot: TimerSnapshot,
  phase: TimerPhase,
  now: number,
  durationSeconds: number,
  nextRound?: number,
): TimerSnapshot => ({
  ...snapshot,
  phase,
  prepTargetPhase: phase === 'prep' ? snapshot.prepTargetPhase : 'work',
  status: phase === 'finished' ? 'finished' : snapshot.status,
  currentRound: nextRound ?? snapshot.currentRound,
  phaseStartedAt: phase === 'finished' ? null : now,
  phaseDurationSeconds: durationSeconds,
  elapsedBeforePauseSeconds: 0,
  remainingSeconds: phase === 'finished' ? 0 : durationSeconds,
});

const toFinished = (snapshot: TimerSnapshot): TimerSnapshot => ({
  ...snapshot,
  phase: 'finished',
  prepTargetPhase: 'finished',
  status: 'finished',
  remainingSeconds: 0,
  phaseStartedAt: null,
  phaseDurationSeconds: 0,
  elapsedBeforePauseSeconds: 0,
});

const startTargetFromPrep = (
  snapshot: TimerSnapshot,
  config: TimerConfig,
  now: number,
): { snapshot: TimerSnapshot; event?: TimerEvent } => {
  if (snapshot.prepTargetPhase === 'finished') {
    return { snapshot: toFinished(snapshot) };
  }

  if (snapshot.prepTargetPhase === 'rest') {
    const next = beginPhase(snapshot, 'rest', now, restOf(config, snapshot.currentRound));
    return { snapshot: next, event: { type: 'phase_started', phase: 'rest' } };
  }

  const next = beginPhase(snapshot, 'work', now, workOf(config, snapshot.currentRound));
  return { snapshot: next, event: { type: 'phase_started', phase: 'work' } };
};

const advancePhase = (
  snapshot: TimerSnapshot,
  config: TimerConfig,
  now: number,
): { snapshot: TimerSnapshot; event?: TimerEvent } => {
  if (snapshot.phase === 'prep') {
    return startTargetFromPrep(snapshot, config, now);
  }

  if (snapshot.phase === 'work') {
    const rest = restOf(config, snapshot.currentRound);

    // A configured rest after the current round always plays — including after
    // the final round, after which the session ends.
    if (rest > 0) {
      const next = beginPhase(snapshot, 'rest', now, rest);
      return { snapshot: next, event: { type: 'phase_started', phase: 'rest' } };
    }

    if (snapshot.currentRound >= roundCount(config)) {
      return { snapshot: toFinished(snapshot) };
    }

    const nextRound = snapshot.currentRound + 1;
    const next = beginPhase(snapshot, 'work', now, workOf(config, nextRound), nextRound);
    return { snapshot: next, event: { type: 'phase_started', phase: 'work' } };
  }

  if (snapshot.phase === 'rest') {
    if (snapshot.currentRound >= roundCount(config)) {
      return { snapshot: toFinished(snapshot) };
    }

    const nextRound = snapshot.currentRound + 1;
    const next = beginPhase(snapshot, 'work', now, workOf(config, nextRound), nextRound);
    return { snapshot: next, event: { type: 'phase_started', phase: 'work' } };
  }

  return { snapshot };
};

export const startTimer = (
  prev: TimerSnapshot,
  config: TimerConfig,
  now: number,
): { snapshot: TimerSnapshot; events: TimerEvent[] } => {
  if (prev.status === 'running') {
    return { snapshot: prev, events: [] };
  }

  const base = createInitialSnapshot(config);

  if (config.prepSeconds <= 0) {
    return {
      snapshot: {
        ...base,
        status: 'running',
        phase: 'work',
        phaseStartedAt: now,
        phaseDurationSeconds: workOf(config, 1),
        remainingSeconds: workOf(config, 1),
      },
      events: [{ type: 'phase_started', phase: 'work' }],
    };
  }

  return {
    snapshot: {
      ...base,
      status: 'running',
      phaseStartedAt: now,
      remainingSeconds: config.prepSeconds,
    },
    events: [],
  };
};

export const pauseTimer = (prev: TimerSnapshot, now: number): TimerSnapshot => {
  if (prev.status !== 'running' || prev.phaseStartedAt === null) {
    return prev;
  }

  const elapsed = (now - prev.phaseStartedAt) / 1000;
  return {
    ...prev,
    status: 'paused',
    elapsedBeforePauseSeconds: elapsed,
    remainingSeconds: toRemaining(prev.phaseDurationSeconds, elapsed),
    phaseStartedAt: null,
  };
};

export const resumeTimer = (prev: TimerSnapshot, now: number): TimerSnapshot => {
  if (prev.status !== 'paused') {
    return prev;
  }

  return {
    ...prev,
    status: 'running',
    phaseStartedAt: now - prev.elapsedBeforePauseSeconds * 1000,
  };
};

export const resetTimer = (config: TimerConfig): TimerSnapshot => createInitialSnapshot(config);

export const skipWorkPhase = (
  prev: TimerSnapshot,
  config: TimerConfig,
  now: number,
  prepSeconds: number,
): TimerSnapshot => {
  if (prev.phase !== 'work' || prev.status === 'finished') {
    return prev;
  }

  const rest = restOf(config, prev.currentRound);
  const isLastRound = prev.currentRound >= roundCount(config);

  // What comes after the skipped work block: its rest, the next round, or end.
  const target: Extract<TimerPhase, 'work' | 'rest' | 'finished'> =
    rest > 0 ? 'rest' : isLastRound ? 'finished' : 'work';

  // When skipping straight to the next round (no rest), advance the round number.
  const targetRound = target === 'work' ? prev.currentRound + 1 : prev.currentRound;

  if (prepSeconds <= 0) {
    if (target === 'finished') {
      return toFinished(prev);
    }

    if (target === 'rest') {
      return {
        ...prev,
        phase: 'rest',
        prepTargetPhase: 'work',
        status: 'running',
        phaseStartedAt: now,
        phaseDurationSeconds: rest,
        elapsedBeforePauseSeconds: 0,
        remainingSeconds: rest,
      };
    }

    return {
      ...prev,
      phase: 'work',
      prepTargetPhase: 'work',
      status: 'running',
      phaseStartedAt: now,
      phaseDurationSeconds: workOf(config, targetRound),
      elapsedBeforePauseSeconds: 0,
      remainingSeconds: workOf(config, targetRound),
      currentRound: targetRound,
    };
  }

  return {
    ...prev,
    status: 'running',
    phase: 'prep',
    prepTargetPhase: target,
    currentRound: targetRound,
    phaseStartedAt: now,
    phaseDurationSeconds: prepSeconds,
    elapsedBeforePauseSeconds: 0,
    remainingSeconds: prepSeconds,
  };
};

export const skipRestPhase = (
  prev: TimerSnapshot,
  config: TimerConfig,
  now: number,
  prepSeconds: number,
): TimerSnapshot => {
  if (prev.phase !== 'rest' || prev.status === 'finished') {
    return prev;
  }

  // A rest after the final round just ends the session when skipped.
  if (prev.currentRound >= roundCount(config)) {
    return toFinished(prev);
  }

  const nextRound = prev.currentRound + 1;

  if (prepSeconds <= 0) {
    return {
      ...prev,
      phase: 'work',
      prepTargetPhase: 'work',
      status: 'running',
      phaseStartedAt: now,
      phaseDurationSeconds: workOf(config, nextRound),
      elapsedBeforePauseSeconds: 0,
      remainingSeconds: workOf(config, nextRound),
      currentRound: nextRound,
    };
  }

  return {
    ...prev,
    status: 'running',
    phase: 'prep',
    prepTargetPhase: 'work',
    phaseStartedAt: now,
    phaseDurationSeconds: prepSeconds,
    elapsedBeforePauseSeconds: 0,
    remainingSeconds: prepSeconds,
    currentRound: nextRound,
  };
};

export type AudioCue = {
  /** Absolute wall-clock time (ms) the cue should sound at. */
  atMs: number;
  /**
   * - `gong`: phase start (work / rest)
   * - `warn`: a single warning ~`warnSeconds` before a work round ends
   * - `restWarn`: a single warning ~`warnSeconds` before a rest phase ends
   * - `tick`: one of the final whole-second countdown beats
   * - `complete`: the session-finished melody
   */
  kind: 'gong' | 'warn' | 'restWarn' | 'tick' | 'complete';
};

/** Jumps straight to the start of a given (1-based) round, going through prep. */
export const jumpToRound = (
  prev: TimerSnapshot,
  config: TimerConfig,
  now: number,
  round: number,
  prepSeconds: number,
): TimerSnapshot => {
  const target = Math.min(Math.max(1, Math.floor(round)), roundCount(config));

  if (prepSeconds <= 0) {
    return {
      ...prev,
      phase: 'work',
      prepTargetPhase: 'work',
      status: 'running',
      currentRound: target,
      phaseStartedAt: now,
      phaseDurationSeconds: workOf(config, target),
      elapsedBeforePauseSeconds: 0,
      remainingSeconds: workOf(config, target),
    };
  }

  return {
    ...prev,
    phase: 'prep',
    prepTargetPhase: 'work',
    status: 'running',
    currentRound: target,
    phaseStartedAt: now,
    phaseDurationSeconds: prepSeconds,
    elapsedBeforePauseSeconds: 0,
    remainingSeconds: prepSeconds,
  };
};

/**
 * Enumerates every audio cue for the rest of the session from the current
 * snapshot: a gong at the start of each upcoming work/rest phase, plus a tick on
 * each of the final `lastSeconds` whole seconds of those phases.
 *
 * Because every cue carries an absolute timestamp, the whole remaining session
 * can be scheduled on the Web Audio clock in one pass. This is what keeps sound
 * playing while the screen is locked — once scheduled, cues no longer depend on
 * the (throttled / frozen) JS interval to fire.
 */
export const buildAudioTimeline = (
  snapshot: TimerSnapshot,
  config: TimerConfig,
  lastSeconds = 10,
  warnSeconds = 30,
): AudioCue[] => {
  const cues: AudioCue[] = [];
  if (snapshot.phaseStartedAt === null || snapshot.status === 'finished') {
    return cues;
  }

  let snap: TimerSnapshot = snapshot;
  let cursor = snapshot.phaseStartedAt;
  let guard = 0;

  while (guard < 2000) {
    guard += 1;
    const dur = snap.phaseDurationSeconds;

    if ((snap.phase === 'work' || snap.phase === 'rest') && dur > 0) {
      cues.push({ atMs: cursor, kind: 'gong' });
      // A single warning beat ~`warnSeconds` before a work/rest phase ends, but
      // only when it lands clear of the final countdown window.
      if (dur > warnSeconds && warnSeconds > lastSeconds) {
        const kind = snap.phase === 'work' ? 'warn' : 'restWarn';
        cues.push({ atMs: cursor + (dur - warnSeconds) * 1000, kind });
      }
      const maxMark = Math.min(lastSeconds, Math.floor(dur));
      for (let mark = maxMark; mark >= 1; mark -= 1) {
        cues.push({ atMs: cursor + (dur - mark) * 1000, kind: 'tick' });
      }
    } else if (snap.phase === 'prep' && dur > 0) {
      // A tick on each whole second of the prep countdown.
      const marks = Math.floor(dur);
      for (let mark = marks; mark >= 1; mark -= 1) {
        cues.push({ atMs: cursor + (dur - mark) * 1000, kind: 'tick' });
      }
    }

    const phaseEnd = cursor + dur * 1000;
    const { snapshot: next } = advancePhase(snap, config, phaseEnd);
    if (next.status === 'finished' || next.phase === 'finished' || next.phaseStartedAt === null) {
      // The whole session is done — play the completion melody.
      cues.push({ atMs: phaseEnd, kind: 'complete' });
      break;
    }
    snap = next;
    cursor = phaseEnd;
  }

  return cues;
};

export const tickTimer = (
  prev: TimerSnapshot,
  config: TimerConfig,
  now: number,
): { snapshot: TimerSnapshot; events: TimerEvent[] } => {
  if (prev.status !== 'running' || prev.phaseStartedAt === null) {
    return { snapshot: prev, events: [] };
  }

  let snapshot = prev;
  let startedAt = prev.phaseStartedAt;
  const events: TimerEvent[] = [];

  while (snapshot.status === 'running') {
    const elapsed = (now - startedAt) / 1000;
    if (elapsed < snapshot.phaseDurationSeconds) {
      snapshot = {
        ...snapshot,
        remainingSeconds: toRemaining(snapshot.phaseDurationSeconds, elapsed),
      };
      return { snapshot, events };
    }

    const phaseEnd = startedAt + snapshot.phaseDurationSeconds * 1000;
    const result = advancePhase(snapshot, config, phaseEnd);
    snapshot = result.snapshot;

    if (result.event) {
      events.push(result.event);
    }

    if (snapshot.status !== 'running' || snapshot.phaseStartedAt === null) {
      return { snapshot, events };
    }

    startedAt = snapshot.phaseStartedAt;
  }

  return { snapshot, events };
};
