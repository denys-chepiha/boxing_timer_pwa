// Core
import { useCallback, useEffect, useRef, useState } from 'react';
// Hooks
import { SOUND_FILES } from '@/hooks/useSound';
// Engine
import { AudioCue } from '@/engine/timerEngine';
// Types
import { SoundId, TimerStatus } from '@/types/models';

const base = import.meta.env.BASE_URL;

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

type Params = {
  /** Run screen is active. */
  enabled: boolean;
  status: TimerStatus;
  /** Selected gong sound. */
  soundId: SoundId;
  /**
   * Changes whenever the audio timeline must be rebuilt (start / resume / skip /
   * repeat, sound change, or once the restored session's config has loaded).
   */
  revision: string;
  /** Returns every remaining cue for the session, with absolute timestamps. */
  getTimeline: () => AudioCue[];
};

/**
 * Builds a short looping near-silent WAV used to keep the audio session — and,
 * crucially on iOS, the routed AudioContext — alive while the screen is locked.
 * Pure-zero PCM can be deprioritised by the OS, so samples sit one step off the
 * mid value: inaudible, but a real (non-silent) signal.
 */
const createKeepAliveTrackUrl = (): string => {
  const sampleRate = 8000;
  const numSamples = sampleRate; // 1 second
  const dataSize = numSamples * 2; // 16-bit mono → 2 bytes/sample
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (sampleRate * blockAlign)
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  // Amplitude of 1 in 16-bit (~-90 dB): inaudible, but a real non-zero signal so
  // the OS doesn't deprioritise the track and let the context suspend.
  for (let i = 0; i < numSamples; i += 1) {
    view.setInt16(44 + i * 2, 1, true);
  }

  return URL.createObjectURL(new Blob([view], { type: 'audio/wav' }));
};

/**
 * Owns the single AudioContext for a running session and is responsible for all
 * of its audio:
 *
 * 1. A near-silent loop is routed through the context (MediaElement → context),
 *    which keeps the context running in the background — including while the
 *    phone is locked — so scheduled cues still fire (the previous design let the
 *    context get suspended, which silenced the countdown after a few rounds).
 * 2. The entire remaining timeline (gongs + final-10s ticks) is scheduled on the
 *    Web Audio clock in one pass, so cadence is sample-accurate and independent
 *    of the JS interval (which the OS throttles or freezes when backgrounded).
 */
export const useRunAudio = ({ enabled, status, soundId, revision, getTimeline }: Params) => {
  const ctxRef = useRef<AudioContext | null>(null);
  const tickBufferRef = useRef<AudioBuffer | null>(null);
  const warnBufferRef = useRef<AudioBuffer | null>(null);
  const restWarnBufferRef = useRef<AudioBuffer | null>(null);
  const completeBufferRef = useRef<AudioBuffer | null>(null);
  const gongCacheRef = useRef<Map<SoundId, AudioBuffer>>(new Map());
  const keepAliveElRef = useRef<HTMLAudioElement | null>(null);
  // Each scheduled cue carries its Web Audio start time so re-anchoring can stop
  // only the still-pending sources and leave already-playing ones (the finish
  // melody) to ring out.
  const scheduledRef = useRef<{ source: AudioBufferSourceNode; startTime: number }[]>([]);

  const [unlocked, setUnlocked] = useState(false);
  const [tickReady, setTickReady] = useState(false);
  const [gongReady, setGongReady] = useState(false);

  const getTimelineRef = useRef(getTimeline);
  getTimelineRef.current = getTimeline;

  // Create the context + keep-alive element and decode the tick sample once.
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const AudioCtx = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!AudioCtx) {
      return;
    }

    const ctx = new AudioCtx();
    ctxRef.current = ctx;
    let cancelled = false;

    // Route a looping near-silent element through the context. While it plays the
    // OS keeps the context (and its scheduled cues) alive in the background.
    const url = createKeepAliveTrackUrl();
    const el = new Audio(url);
    el.loop = true;
    el.preload = 'auto';
    keepAliveElRef.current = el;
    try {
      const source = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      gain.gain.value = 1;
      source.connect(gain).connect(ctx.destination);
    } catch {
      // MediaElementSource unsupported — keep-alive degrades but cues still work.
    }

    void (async () => {
      try {
        const response = await fetch(`${base}sounds/tick.wav`);
        const decoded = await ctx.decodeAudioData(await response.arrayBuffer());
        if (!cancelled) {
          tickBufferRef.current = decoded;
          setTickReady(true);
        }
      } catch {
        // Best-effort — ticks are non-fatal.
      }
    })();

    void (async () => {
      try {
        const response = await fetch(`${base}sounds/round-warning.mp3`);
        const decoded = await ctx.decodeAudioData(await response.arrayBuffer());
        if (!cancelled) {
          warnBufferRef.current = decoded;
        }
      } catch {
        // Best-effort — the 30s warning is non-fatal.
      }
    })();

    void (async () => {
      try {
        const response = await fetch(`${base}sounds/rest-warning.mp3`);
        const decoded = await ctx.decodeAudioData(await response.arrayBuffer());
        if (!cancelled) {
          restWarnBufferRef.current = decoded;
        }
      } catch {
        // Best-effort — the rest-phase warning is non-fatal.
      }
    })();

    void (async () => {
      try {
        const response = await fetch(`${base}sounds/complete_training.mp3`);
        const decoded = await ctx.decodeAudioData(await response.arrayBuffer());
        if (!cancelled) {
          completeBufferRef.current = decoded;
        }
      } catch {
        // Best-effort — the completion melody is non-fatal.
      }
    })();

    const unlock = () => {
      void ctx
        .resume()
        .then(() => {
          if (!cancelled && ctx.state === 'running') {
            setUnlocked(true);
          }
        })
        .catch(() => undefined);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    return () => {
      cancelled = true;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      el.pause();
      el.src = '';
      URL.revokeObjectURL(url);
      void ctx.close().catch(() => undefined);
      ctxRef.current = null;
      tickBufferRef.current = null;
      warnBufferRef.current = null;
      restWarnBufferRef.current = null;
      completeBufferRef.current = null;
      gongCacheRef.current.clear();
      keepAliveElRef.current = null;
    };
  }, []);

  // Decode the selected gong sample (cached per sound id).
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) {
      return;
    }
    if (gongCacheRef.current.has(soundId)) {
      setGongReady(true);
      return;
    }

    let cancelled = false;
    setGongReady(false);
    void (async () => {
      try {
        const response = await fetch(SOUND_FILES[soundId]);
        const decoded = await ctx.decodeAudioData(await response.arrayBuffer());
        if (!cancelled) {
          gongCacheRef.current.set(soundId, decoded);
          setGongReady(true);
        }
      } catch {
        // Best-effort.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [soundId]);

  // Play / pause the keep-alive loop with the active timer, and re-assert it when
  // the page returns to the foreground (iOS can suspend the context / pause the
  // element while locked — resuming both keeps scheduled cues firing).
  useEffect(() => {
    const el = keepAliveElRef.current;
    if (!el) {
      return;
    }

    const shouldHold = enabled && (status === 'running' || status === 'paused');

    const assert = () => {
      const ctx = ctxRef.current;
      if (shouldHold) {
        if (ctx && ctx.state === 'suspended') {
          void ctx.resume().catch(() => undefined);
        }
        if (el.paused) {
          void el.play().catch(() => undefined);
        }
      } else if (!el.paused) {
        el.pause();
      }
    };

    assert();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        assert();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [enabled, status]);

  const clearScheduled = useCallback(() => {
    const ctx = ctxRef.current;
    const now = ctx ? ctx.currentTime : Infinity;
    scheduledRef.current.forEach(({ source, startTime }) => {
      // Only cancel cues that haven't started yet. A source already playing
      // (e.g. the finish melody, which begins exactly as the run ends and the
      // timeline re-anchors to empty) is left to ring out — its own `onended`
      // disconnects it.
      if (startTime > now + 0.02) {
        try {
          source.stop();
        } catch {
          // Already started/stopped.
        }
      }
    });
    scheduledRef.current = [];
  }, []);

  // Schedule the whole remaining timeline whenever it is re-anchored.
  useEffect(() => {
    const ctx = ctxRef.current;
    const tickBuffer = tickBufferRef.current;
    const gongBuffer = gongCacheRef.current.get(soundId);

    clearScheduled();

    if (!enabled || status !== 'running' || !tickReady || !gongReady) {
      return;
    }
    if (!ctx || !tickBuffer || !gongBuffer) {
      return;
    }
    if (ctx.state === 'suspended') {
      // Schedule only once unlocked — a suspended clock can't be aligned to.
      void ctx.resume().catch(() => undefined);
      return;
    }

    const now = Date.now();
    const cues = getTimelineRef.current();
    const completeBuffer = completeBufferRef.current;
    // The 30s warnings fall back to the gong sample if their own clip is missing.
    const warnBuffer = warnBufferRef.current ?? gongBuffer;
    const restWarnBuffer = restWarnBufferRef.current ?? gongBuffer;

    cues.forEach((cue) => {
      const offsetSec = (cue.atMs - now) / 1000;
      // Skip cues already (well) past — e.g. the current phase's own gong.
      if (offsetSec < -0.15) {
        return;
      }

      const buffer =
        cue.kind === 'gong'
          ? gongBuffer
          : cue.kind === 'warn'
            ? warnBuffer
            : cue.kind === 'restWarn'
              ? restWarnBuffer
              : cue.kind === 'complete'
                ? completeBuffer
                : tickBuffer;
      if (!buffer) {
        return;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      // Boost the completion melody so it lands clearly louder than the cues.
      if (cue.kind === 'complete') {
        const gain = ctx.createGain();
        gain.gain.value = 1.6;
        source.connect(gain).connect(ctx.destination);
      } else {
        source.connect(ctx.destination);
      }
      source.onended = () => source.disconnect();
      const startTime = ctx.currentTime + Math.max(0, offsetSec);
      source.start(startTime);
      scheduledRef.current.push({ source, startTime });
    });

    return clearScheduled;
  }, [enabled, status, revision, unlocked, tickReady, gongReady, soundId, clearScheduled]);
};
