// Core
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
// Hooks
import { useRunAudio } from '@/hooks/useRunAudio';
// Engine
import { AudioCue } from '@/engine/timerEngine';
// Test
import { MockAudioContext } from '@/test/setup';

const ctx = () => MockAudioContext.instances[0];

// Simulates the user gesture that unlocks (resumes) the audio context.
const unlock = async () => {
  await act(async () => {
    window.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve();
  });
};

const baseProps = (overrides: Partial<Parameters<typeof useRunAudio>[0]> = {}) => ({
  enabled: true,
  status: 'running' as const,
  soundId: 'beep' as const,
  revision: 'r1',
  getTimeline: (): AudioCue[] => [
    { atMs: Date.now(), kind: 'gong' },
    { atMs: Date.now() + 5000, kind: 'tick' },
  ],
  ...overrides,
});

describe('useRunAudio', () => {
  it('creates one audio context and routes a keep-alive element through it', async () => {
    const playSpy = window.HTMLMediaElement.prototype.play as ReturnType<typeof vi.fn>;
    renderHook(() => useRunAudio(baseProps()));

    await waitFor(() => expect(MockAudioContext.instances).toHaveLength(1));
    expect(ctx().createMediaElementSource).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(playSpy).toHaveBeenCalled()); // keep-alive loop started
  });

  it('schedules a buffer source per cue once decoded and running', async () => {
    renderHook(() => useRunAudio(baseProps()));
    await unlock();
    await waitFor(() => expect(ctx()?.sources.length).toBe(2));
    expect(ctx().sources.every((s) => s.connected && s.startedAt !== null)).toBe(true);
  });

  it('does not schedule anything while paused', async () => {
    renderHook(() => useRunAudio(baseProps({ status: 'paused' })));
    await waitFor(() => expect(MockAudioContext.instances).toHaveLength(1));
    // Give decode promises a chance to resolve.
    await act(async () => {
      await Promise.resolve();
    });
    expect(ctx().sources).toHaveLength(0);
  });

  it('reschedules on revision change: cancels pending cues, lets started ones ring out', async () => {
    const { rerender } = renderHook((props) => useRunAudio(props), {
      initialProps: baseProps(),
    });
    await unlock();
    await waitFor(() => expect(ctx().sources.length).toBe(2));
    const first = ctx().sources.slice();
    // baseProps schedules a gong at offset ~0 (already started) and a tick 5s out.
    const started = first.find((s) => s.startedAt === 0);
    const pending = first.find((s) => s.startedAt !== null && s.startedAt > 0.02);

    rerender(baseProps({ revision: 'r2' }));
    // The still-pending cue is cancelled; the already-started one is left to play.
    await waitFor(() => expect(pending?.stopped).toBe(true));
    expect(started?.stopped).toBe(false);
  });

  it('schedules a source for a restWarn cue', async () => {
    const getTimeline = (): AudioCue[] => [{ atMs: Date.now() + 1000, kind: 'restWarn' }];
    renderHook(() => useRunAudio(baseProps({ getTimeline })));
    await unlock();
    await waitFor(() => expect(ctx().sources.length).toBe(1));
    expect(ctx().sources[0].connected).toBe(true);
  });

  it('schedules a countdown cue and cuts it off at the phase-end time', async () => {
    const getTimeline = (): AudioCue[] => [
      { atMs: Date.now() + 1000, kind: 'countdown', stopAtMs: Date.now() + 3000 },
    ];
    renderHook(() => useRunAudio(baseProps({ getTimeline })));
    await unlock();
    await waitFor(() => expect(ctx().sources.length).toBe(1));
    expect(ctx().sources[0].connected).toBe(true);
    expect(ctx().sources[0].stopped).toBe(true);
  });

  it('skips cues that are already in the past', async () => {
    const getTimeline = (): AudioCue[] => [
      { atMs: Date.now() - 10000, kind: 'gong' }, // well past → skipped
      { atMs: Date.now() + 2000, kind: 'tick' },
    ];
    renderHook(() => useRunAudio(baseProps({ getTimeline })));
    await unlock();
    await waitFor(() => expect(ctx().sources.length).toBe(1));
  });
});
