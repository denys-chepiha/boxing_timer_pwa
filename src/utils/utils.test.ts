// Core
import { afterEach, describe, expect, it, vi } from 'vitest';
// Utils
import { confirmAction, notify } from '@/utils/dialog';
import { isNonEmptyString, isPositiveInteger } from '@/utils/guards';
import { createId } from '@/utils/id';
import { isUniformRounds, resolveRounds, sumRounds } from '@/utils/rounds';
import { formatSecondsToClock } from '@/utils/timeFormat';

describe('formatSecondsToClock', () => {
  it.each([
    [0, '00:00'],
    [5, '00:05'],
    [65, '01:05'],
    [600, '10:00'],
    [3599, '59:59'],
    [3661, '61:01'],
  ])('formats %i seconds as %s', (input, expected) => {
    expect(formatSecondsToClock(input)).toBe(expected);
  });

  it('floors fractional seconds and clamps negatives to zero', () => {
    expect(formatSecondsToClock(9.9)).toBe('00:09');
    expect(formatSecondsToClock(-5)).toBe('00:00');
  });

  it('returns 00:00 for non-finite input', () => {
    expect(formatSecondsToClock(Number.NaN)).toBe('00:00');
    expect(formatSecondsToClock(Number.POSITIVE_INFINITY)).toBe('00:00');
  });
});

describe('guards', () => {
  it('isPositiveInteger only accepts integers >= 1', () => {
    expect(isPositiveInteger(1)).toBe(true);
    expect(isPositiveInteger(42)).toBe(true);
    expect(isPositiveInteger(0)).toBe(false);
    expect(isPositiveInteger(-1)).toBe(false);
    expect(isPositiveInteger(1.5)).toBe(false);
    expect(isPositiveInteger(Number.NaN)).toBe(false);
  });

  it('isNonEmptyString ignores surrounding whitespace', () => {
    expect(isNonEmptyString('hello')).toBe(true);
    expect(isNonEmptyString('  x  ')).toBe(true);
    expect(isNonEmptyString('')).toBe(false);
    expect(isNonEmptyString('   ')).toBe(false);
  });
});

describe('createId', () => {
  it('produces unique, timestamp-prefixed ids', () => {
    const ids = new Set(Array.from({ length: 200 }, () => createId()));
    expect(ids.size).toBe(200);
    for (const id of ids) {
      expect(id).toMatch(/^\d+-[a-z0-9]+$/);
    }
  });
});

describe('dialog', () => {
  afterEach(() => vi.restoreAllMocks());

  it('notify forwards to window.alert', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    notify('hi');
    expect(alertSpy).toHaveBeenCalledWith('hi');
  });

  it('confirmAction returns the window.confirm result', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(confirmAction('ok?')).toBe(true);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(confirmAction('ok?')).toBe(false);
  });
});

describe('resolveRounds', () => {
  it('expands a uniform session, with no rest after the final round', () => {
    const rounds = resolveRounds({ rounds: 3, workSeconds: 180, restSeconds: 60 });
    expect(rounds).toEqual([
      { workSeconds: 180, restSeconds: 60 },
      { workSeconds: 180, restSeconds: 60 },
      { workSeconds: 180, restSeconds: 0 },
    ]);
  });

  it('uses an explicit roundsConfig when present, sanitising values', () => {
    const rounds = resolveRounds({
      rounds: 1,
      workSeconds: 1,
      restSeconds: 1,
      roundsConfig: [
        { workSeconds: 10.7, restSeconds: 5.9 },
        { workSeconds: 0, restSeconds: -3 },
      ],
    });
    expect(rounds).toEqual([
      { workSeconds: 10, restSeconds: 5 },
      { workSeconds: 1, restSeconds: 0 }, // work floored to a minimum of 1
    ]);
  });

  it('strips any rest configured after the final round', () => {
    const rounds = resolveRounds({
      rounds: 1,
      workSeconds: 1,
      restSeconds: 1,
      roundsConfig: [
        { workSeconds: 30, restSeconds: 15 },
        { workSeconds: 30, restSeconds: 15 }, // trailing rest dropped
      ],
    });
    expect(rounds).toEqual([
      { workSeconds: 30, restSeconds: 15 },
      { workSeconds: 30, restSeconds: 0 },
    ]);
  });

  it('always yields at least one round', () => {
    expect(resolveRounds({ rounds: 0, workSeconds: 5, restSeconds: 2 })).toHaveLength(1);
  });

  it('carries the session description onto every round when set', () => {
    const rounds = resolveRounds({
      rounds: 2,
      workSeconds: 60,
      restSeconds: 30,
      description: 'Jab-cross combos',
    });
    expect(rounds.every((round) => round.description === 'Jab-cross combos')).toBe(true);
  });

  it('resolves one round per participant, labelled by name, overriding rounds/roundsConfig', () => {
    const rounds = resolveRounds({
      rounds: 99,
      workSeconds: 180,
      restSeconds: 60,
      description: 'Default drill',
      roundsConfig: [{ workSeconds: 1, restSeconds: 1 }],
      participants: [
        { id: 'p1', names: ['Denys'] },
        { id: 'p2', names: ['Vlad'] },
        { id: 'p3', names: ['Piter'] },
      ],
    });
    expect(rounds).toEqual([
      { workSeconds: 180, restSeconds: 60, label: 'Denys', description: 'Default drill' },
      { workSeconds: 180, restSeconds: 60, label: 'Vlad', description: 'Default drill' },
      { workSeconds: 180, restSeconds: 0, label: 'Piter', description: 'Default drill' },
    ]);
  });

  it('lets a participant override work/rest/description, falling back to session defaults', () => {
    const rounds = resolveRounds({
      rounds: 1,
      workSeconds: 180,
      restSeconds: 60,
      description: 'Default drill',
      participants: [
        { id: 'p1', names: ['Denys'], workSeconds: 120, restSeconds: 45, description: 'Mitts' },
        { id: 'p2', names: ['Vlad'] },
      ],
    });
    expect(rounds).toEqual([
      { workSeconds: 120, restSeconds: 45, label: 'Denys', description: 'Mitts' },
      { workSeconds: 180, restSeconds: 0, label: 'Vlad', description: 'Default drill' },
    ]);
  });

  it('labels a pair round by joining every name sharing that round', () => {
    const rounds = resolveRounds({
      rounds: 1,
      workSeconds: 90,
      restSeconds: 30,
      participants: [{ id: 'p1', names: ['Denys', 'Vlad'] }],
    });
    expect(rounds[0].label).toBe('Denys & Vlad');
  });
});

describe('sumRounds', () => {
  it('totals work and rest separately', () => {
    const totals = sumRounds([
      { workSeconds: 180, restSeconds: 60 },
      { workSeconds: 120, restSeconds: 0 },
    ]);
    expect(totals).toEqual({ work: 300, rest: 60, total: 360 });
  });
});

describe('isUniformRounds', () => {
  it('treats a single round as uniform', () => {
    expect(isUniformRounds([{ workSeconds: 10, restSeconds: 5 }])).toBe(true);
  });

  it('ignores the final round rest when comparing', () => {
    expect(
      isUniformRounds([
        { workSeconds: 10, restSeconds: 5 },
        { workSeconds: 10, restSeconds: 0 },
      ]),
    ).toBe(true);
  });

  it('flags differing work durations as non-uniform', () => {
    expect(
      isUniformRounds([
        { workSeconds: 10, restSeconds: 5 },
        { workSeconds: 20, restSeconds: 5 },
      ]),
    ).toBe(false);
  });

  it('flags differing mid rests as non-uniform', () => {
    expect(
      isUniformRounds([
        { workSeconds: 10, restSeconds: 5 },
        { workSeconds: 10, restSeconds: 9 },
        { workSeconds: 10, restSeconds: 0 },
      ]),
    ).toBe(false);
  });
});
