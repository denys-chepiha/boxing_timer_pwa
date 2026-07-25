// Core
import { describe, expect, it } from 'vitest';
// Engine
import { TimerSnapshot } from '@/engine/timerEngine';
// Storage
import { localStore } from '@/storage/localStore';
import { rosterStorage } from '@/storage/rosterStorage';
import { runStateStorage } from '@/storage/runStateStorage';
import { sessionsStorage } from '@/storage/sessionsStorage';
import { defaultSettings, settingsStorage } from '@/storage/settingsStorage';
// Types
import { Session } from '@/types/models';

const sampleSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'a',
  name: 'Test',
  category: 'boxing',
  rounds: 3,
  workSeconds: 180,
  restSeconds: 60,
  soundId: 'boxing-gong',
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const runningSnapshot: TimerSnapshot = {
  status: 'running',
  phase: 'work',
  prepTargetPhase: 'work',
  currentRound: 2,
  remainingSeconds: 10,
  phaseStartedAt: 1000,
  phaseDurationSeconds: 180,
  elapsedBeforePauseSeconds: 0,
};

describe('localStore', () => {
  it('round-trips values and removes them', async () => {
    await localStore.setItem('k', 'v');
    expect(await localStore.getItem('k')).toBe('v');
    await localStore.removeItem('k');
    expect(await localStore.getItem('k')).toBeNull();
  });

  it('returns null for a missing key', async () => {
    expect(await localStore.getItem('nope')).toBeNull();
  });
});

describe('settingsStorage', () => {
  it('returns defaults when nothing is stored', async () => {
    expect(await settingsStorage.get()).toEqual(defaultSettings);
  });

  it('round-trips saved settings', async () => {
    await settingsStorage.save({ ...defaultSettings, prepSeconds: 7, keepScreenAwake: true });
    const loaded = await settingsStorage.get();
    expect(loaded.prepSeconds).toBe(7);
    expect(loaded.keepScreenAwake).toBe(true);
  });

  it('falls back to the default sound for an unknown id', async () => {
    await localStore.setItem('box_timer_settings_v1', JSON.stringify({ defaultSoundId: 'bogus' }));
    expect((await settingsStorage.get()).defaultSoundId).toBe(defaultSettings.defaultSoundId);
  });

  it('returns defaults on malformed JSON', async () => {
    await localStore.setItem('box_timer_settings_v1', '{not json');
    expect(await settingsStorage.get()).toEqual(defaultSettings);
  });
});

describe('sessionsStorage', () => {
  it('returns an empty list when empty', async () => {
    expect(await sessionsStorage.getAll()).toEqual([]);
  });

  it('round-trips sessions', async () => {
    const session = sampleSession();
    await sessionsStorage.saveAll([session]);
    expect(await sessionsStorage.getAll()).toEqual([session]);
  });

  it('sanitises roundsConfig and unknown sounds on read', async () => {
    await localStore.setItem(
      'box_timer_sessions_v1',
      JSON.stringify([
        sampleSession({
          soundId: 'bogus' as Session['soundId'],
          roundsConfig: [
            { workSeconds: 5.8, restSeconds: 2.9 },
            { workSeconds: 0, restSeconds: -1 },
          ],
        }),
      ]),
    );
    const [loaded] = await sessionsStorage.getAll();
    expect(loaded.soundId).toBe('boxing-gong');
    expect(loaded.roundsConfig).toEqual([
      { workSeconds: 5, restSeconds: 2 },
      { workSeconds: 1, restSeconds: 0 },
    ]);
  });

  it('drops an empty roundsConfig to undefined', async () => {
    await localStore.setItem(
      'box_timer_sessions_v1',
      JSON.stringify([sampleSession({ roundsConfig: [] })]),
    );
    const [loaded] = await sessionsStorage.getAll();
    expect(loaded.roundsConfig).toBeUndefined();
  });

  it('round-trips participants and a description', async () => {
    const session = sampleSession({
      description: 'Heavy bag combos',
      participants: [
        { id: 'p1', names: ['Denys'], workSeconds: 120, restSeconds: 45, description: 'Mitts' },
        { id: 'p2', names: ['Vlad', 'Piter'] },
      ],
    });
    await sessionsStorage.saveAll([session]);
    expect(await sessionsStorage.getAll()).toEqual([session]);
  });

  it('sanitises malformed participants on read', async () => {
    await localStore.setItem(
      'box_timer_sessions_v1',
      JSON.stringify([
        sampleSession({
          participants: [
            { id: 'p1', names: ['  Denys  '], workSeconds: 12.9, restSeconds: -4 },
            { names: [] }, // no names -> dropped
            { names: ['', '  '] }, // blank names -> dropped
            { id: 'p2', names: ['Vlad'] },
            'not-an-object',
          ] as unknown as Session['participants'],
        }),
      ]),
    );
    const [loaded] = await sessionsStorage.getAll();
    expect(loaded.participants).toEqual([
      { id: 'p1', names: ['  Denys  '], workSeconds: 12, restSeconds: 0 },
      { id: 'p2', names: ['Vlad'] },
    ]);
  });

  it('drops an empty participants list to undefined', async () => {
    await localStore.setItem(
      'box_timer_sessions_v1',
      JSON.stringify([sampleSession({ participants: [] })]),
    );
    const [loaded] = await sessionsStorage.getAll();
    expect(loaded.participants).toBeUndefined();
  });

  it('drops a blank description to undefined', async () => {
    await localStore.setItem(
      'box_timer_sessions_v1',
      JSON.stringify([sampleSession({ description: '' })]),
    );
    const [loaded] = await sessionsStorage.getAll();
    expect(loaded.description).toBeUndefined();
  });

  it('returns an empty list on malformed JSON or non-array data', async () => {
    await localStore.setItem('box_timer_sessions_v1', '{nope');
    expect(await sessionsStorage.getAll()).toEqual([]);
    await localStore.setItem('box_timer_sessions_v1', JSON.stringify({ a: 1 }));
    expect(await sessionsStorage.getAll()).toEqual([]);
  });
});

describe('rosterStorage', () => {
  it('returns an empty list when empty', async () => {
    expect(await rosterStorage.getAll()).toEqual([]);
  });

  it('adds names, sorted alphabetically', async () => {
    await rosterStorage.add('Vlad');
    await rosterStorage.add('Denys');
    expect(await rosterStorage.getAll()).toEqual(['Denys', 'Vlad']);
  });

  it('dedupes case-insensitively, keeping the first-seen casing', async () => {
    await rosterStorage.add('Denys');
    await rosterStorage.add('denys');
    await rosterStorage.add('DENYS');
    expect(await rosterStorage.getAll()).toEqual(['Denys']);
  });

  it('ignores a blank name', async () => {
    await rosterStorage.add('   ');
    expect(await rosterStorage.getAll()).toEqual([]);
  });

  it('removes a name case-insensitively', async () => {
    await rosterStorage.add('Denys');
    await rosterStorage.add('Vlad');
    await rosterStorage.remove('denys');
    expect(await rosterStorage.getAll()).toEqual(['Vlad']);
  });
});

describe('runStateStorage', () => {
  it('round-trips a fresh running session', async () => {
    await runStateStorage.save({ sessionId: 's1', snapshot: runningSnapshot, savedAt: Date.now() });
    expect(runStateStorage.read()).toMatchObject({ sessionId: 's1' });
  });

  it('clears a saved run', async () => {
    await runStateStorage.save({ sessionId: 's1', snapshot: runningSnapshot, savedAt: Date.now() });
    await runStateStorage.clear();
    expect(runStateStorage.read()).toBeNull();
  });

  it('treats a stale run as absent', async () => {
    await runStateStorage.save({
      sessionId: 's1',
      snapshot: runningSnapshot,
      savedAt: Date.now() - 7 * 60 * 60 * 1000,
    });
    expect(runStateStorage.read()).toBeNull();
  });

  it('ignores a run that is no longer running or paused', async () => {
    await runStateStorage.save({
      sessionId: 's1',
      snapshot: { ...runningSnapshot, status: 'finished' },
      savedAt: Date.now(),
    });
    expect(runStateStorage.read()).toBeNull();
  });

  it('returns null for malformed or incomplete data', () => {
    window.localStorage.setItem('box_timer_run_v1', '{bad');
    expect(runStateStorage.read()).toBeNull();
    window.localStorage.setItem('box_timer_run_v1', JSON.stringify({ sessionId: 's1' }));
    expect(runStateStorage.read()).toBeNull();
  });
});
