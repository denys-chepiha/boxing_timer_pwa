// Core
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// App
import { useSessions } from '@/app/SessionsProvider';

// Components
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundTiles, roundColor } from '@/components/RoundTiles';
import { TimerDisplay } from '@/components/TimerDisplay';

// Hooks
import { useKeepAwake } from '@/hooks/useKeepAwake';
import { useRunAudio } from '@/hooks/useRunAudio';
import { useTimerEngine } from '@/hooks/useTimerEngine';

// Engine
import { buildAudioTimeline, TimerSnapshot } from '@/engine/timerEngine';

// Navigation
import { ScreenProps, useIsFocused } from '@/navigation/RootNavigator';

// Storage
import { runStateStorage } from '@/storage/runStateStorage';
import { defaultSettings, settingsStorage } from '@/storage/settingsStorage';

// Theme
import { useTheme } from '@/theme/ThemeProvider';

// Utils
import { resolveRounds } from '@/utils/rounds';
import { formatSecondsToClock } from '@/utils/timeFormat';

const toGradient = (colors: readonly string[]): string =>
  `linear-gradient(135deg, ${colors.join(', ')})`;

const vibrate = (durationMs: number) => {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(durationMs);
    } catch {
      // Vibration unsupported / blocked — ignore.
    }
  }
};

export const SessionRunScreen = ({ route, navigation }: ScreenProps<'SessionRun'>) => {
  const { theme } = useTheme();
  const { getById, isLoading } = useSessions();
  const isFocused = useIsFocused('SessionRun');

  const session = getById(route.params.sessionId);

  // A session restored after the PWA was reloaded resumes from its saved state.
  const restoredSnapshot = useMemo<TimerSnapshot | null>(() => {
    if (!route.params.restored) {
      return null;
    }
    const saved = runStateStorage.read();
    return saved && saved.sessionId === route.params.sessionId ? saved.snapshot : null;
  }, [route.params.restored, route.params.sessionId]);

  const [prepSeconds, setPrepSeconds] = useState(defaultSettings.prepSeconds);
  const [keepAwakeEnabled, setKeepAwakeEnabled] = useState(defaultSettings.keepScreenAwake);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const settings = await settingsStorage.get();
      if (!mounted) {
        return;
      }
      setPrepSeconds(settings.prepSeconds);
      setKeepAwakeEnabled(settings.keepScreenAwake);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const rounds = useMemo(
    () =>
      resolveRounds({
        rounds: session?.rounds ?? 1,
        workSeconds: session?.workSeconds ?? 1,
        restSeconds: session?.restSeconds ?? 1,
        roundsConfig: session?.roundsConfig,
        description: session?.description,
        participants: session?.participants,
      }),
    [
      session?.restSeconds,
      session?.rounds,
      session?.workSeconds,
      session?.roundsConfig,
      session?.description,
      session?.participants,
    ],
  );

  const config = useMemo(() => ({ rounds, prepSeconds }), [rounds, prepSeconds]);

  const engine = useTimerEngine({
    config,
    initialSnapshot: restoredSnapshot,
    // Hold a restored session steady until the real session/config has loaded so
    // it can't false-advance against the placeholder fallback config.
    ticking: !!session && !isLoading,
    onEvent: (event) => {
      // Audio is scheduled ahead by useRunAudio; here we only add a haptic cue
      // (best-effort, foreground only).
      if (event.type === 'phase_started') {
        vibrate(180);
      }
    },
  });

  // Latest snapshot + config for building the audio timeline on demand.
  const timelineSnapshot: TimerSnapshot = {
    status: engine.status,
    phase: engine.phase,
    prepTargetPhase: engine.prepTargetPhase,
    currentRound: engine.currentRound,
    remainingSeconds: engine.remainingSeconds,
    phaseStartedAt: engine.phaseStartedAt,
    phaseDurationSeconds: engine.phaseDurationSeconds,
    elapsedBeforePauseSeconds: engine.elapsedBeforePauseSeconds,
  };
  const snapshotRef = useRef(timelineSnapshot);
  snapshotRef.current = timelineSnapshot;
  const configRef = useRef(config);
  configRef.current = config;
  const getTimeline = useCallback(() => buildAudioTimeline(snapshotRef.current, configRef.current), []);

  // Identifies the current timeline so the audio schedule re-anchors when it
  // genuinely changes (engine action, phase boundary, sound, or a restored
  // session's config arriving). It deliberately does NOT include the per-100ms
  // countdown, so a locked screen — where the JS interval is frozen — keeps the
  // already-scheduled cues instead of churning.
  const audioRevision = [
    engine.runEpoch,
    session ? 'ready' : 'wait',
    session?.soundId ?? '',
    engine.phase,
    engine.currentRound,
    engine.phaseStartedAt ?? 0,
  ].join(':');

  useRunAudio({
    enabled: isFocused && !!session,
    status: engine.status,
    soundId: session?.soundId ?? defaultSettings.defaultSoundId,
    revision: audioRevision,
    getTimeline,
  });

  // Persist an in-progress run so a PWA reload (e.g. after the phone was locked
  // and the app evicted from memory) resumes instead of dropping to the menu.
  useEffect(() => {
    if (!session) {
      return;
    }
    if (engine.status === 'running' || engine.status === 'paused') {
      void runStateStorage.save({
        sessionId: session.id,
        snapshot: snapshotRef.current,
        savedAt: Date.now(),
      });
    } else {
      void runStateStorage.clear();
    }
  }, [session, engine.status, engine.phase, engine.currentRound, engine.phaseStartedAt]);

  const handleBack = useCallback(() => {
    void runStateStorage.clear();
    navigation.goBack();
  }, [navigation]);

  useKeepAwake(
    isFocused &&
      keepAwakeEnabled &&
      (engine.status === 'running' || engine.status === 'paused'),
  );

  const isCriticalCountdown =
    engine.status === 'running' &&
    (engine.phase === 'work' || engine.phase === 'rest') &&
    engine.remainingSeconds <= 10 &&
    engine.remainingSeconds > 0;
  const isRestPhase = engine.phase === 'rest';
  const isRestCritical = isRestPhase && isCriticalCountdown;
  const isWorkCritical = engine.phase === 'work' && isCriticalCountdown;

  const phaseProgress = useMemo(() => {
    if (engine.phaseDurationSeconds <= 0) {
      return 0;
    }
    const elapsed = engine.phaseDurationSeconds - engine.remainingSeconds;
    const raw = elapsed / engine.phaseDurationSeconds;
    if (raw < 0) {
      return 0;
    }
    if (raw > 1) {
      return 1;
    }
    return raw;
  }, [engine.phaseDurationSeconds, engine.remainingSeconds]);

  const currentRoundInfo = useMemo(() => {
    if (!session || engine.status === 'idle') {
      return null;
    }
    const index = Math.min(engine.currentRound, rounds.length) - 1;
    return rounds[index] ?? null;
  }, [engine.currentRound, engine.status, rounds, session]);

  // One line per distinct instruction for the current round: a single shared
  // line when everyone has the same (or no override), otherwise one line per
  // entrant whose description differs from the rest (e.g. one partner drills
  // 1-1-2 while the other drills 1-2, under the same clock).
  const roundNotes = useMemo(() => {
    const entrants = currentRoundInfo?.entrants;
    if (!entrants || entrants.length === 0) {
      return currentRoundInfo?.description ? [{ description: currentRoundInfo.description }] : [];
    }

    const uniqueDescriptions = new Set(entrants.map((entrant) => entrant.description ?? ''));
    if (uniqueDescriptions.size <= 1) {
      const shared = entrants[0].description;
      return shared ? [{ description: shared }] : [];
    }

    return entrants
      .filter((entrant): entrant is { name: string; description: string } => !!entrant.description)
      .map((entrant) => ({ name: entrant.name, description: entrant.description }));
  }, [currentRoundInfo]);

  const nextPhaseText = useMemo(() => {
    if (!session || engine.status === 'idle' || engine.status === 'finished') return null;
    if (engine.phase === 'prep') return null;

    const count = rounds.length;
    const currentIndex = engine.currentRound - 1;
    const nextWorkSeconds = rounds[engine.currentRound]?.workSeconds ?? 0;

    if (engine.phase === 'work') {
      const restSeconds = rounds[currentIndex]?.restSeconds ?? 0;
      if (restSeconds > 0) return `UP NEXT: Rest (${formatSecondsToClock(restSeconds)})`;
      if (engine.currentRound >= count) return 'UP NEXT: Finish';
      return `UP NEXT: Round ${engine.currentRound + 1} - Work (${formatSecondsToClock(nextWorkSeconds)})`;
    }
    if (engine.phase === 'rest') {
      if (engine.currentRound >= count) return 'UP NEXT: Finish';
      return `UP NEXT: Round ${engine.currentRound + 1} - Work (${formatSecondsToClock(nextWorkSeconds)})`;
    }
    return null;
  }, [engine.currentRound, engine.phase, engine.status, rounds, session]);

  if (!session) {
    return (
      <div
        className="app-shell"
        style={{
          backgroundColor: theme.colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 16,
          flex: 1,
        }}
      >
        <p style={{ color: theme.colors.text, fontWeight: 800 }}>
          {isLoading ? 'Loading…' : 'Session not found'}
        </p>
        {!isLoading ? <PrimaryButton label="Back" onPress={handleBack} /> : null}
      </div>
    );
  }

  const showStart = engine.status === 'idle';
  const showPause = engine.status === 'running';
  const showResume = engine.status === 'paused';
  const showRepeat = engine.status === 'finished';
  const showSkipRound = (engine.status === 'running' || engine.status === 'paused') && engine.phase === 'work';
  const showSkipRest = (engine.status === 'running' || engine.status === 'paused') && engine.phase === 'rest';

  const lightModeBase = [theme.colors.background, '#EEF3FA', '#E8EEF7'] as const;
  const lightModeRest = ['#F2FAF6', '#E5F5EE', '#D8EFE6'] as const;
  const lightModeWorkCritical = ['#FFF3F4', '#FFE6EA', '#FFD6DD'] as const;
  const lightModeRestCritical = ['#F0FBF6', '#DFF6EA', '#CFEFDB'] as const;

  const gradientColors = theme.isDark
    ? isRestCritical
      ? ['#0D2D1F', '#114530', '#1B5D43']
      : isWorkCritical
        ? ['#2D1017', '#3A121C', '#591A27']
        : isRestPhase
          ? ['#0C111D', '#10261E', '#17382B']
          : [theme.colors.background, '#111827', '#172033']
    : isRestCritical
      ? [...lightModeRestCritical]
      : isWorkCritical
        ? [...lightModeWorkCritical]
        : isRestPhase
          ? [...lightModeRest]
          : [...lightModeBase];

  const controlBtnStyle = { minHeight: 58 };
  const phaseAccent = isRestPhase ? theme.colors.success : isWorkCritical ? theme.colors.danger : theme.colors.primary;

  return (
    <div
      className="app-shell session-run-shell"
      style={{
        background: toGradient(gradientColors),
        padding: '42px 14px 18px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flex: 1,
        height: '100dvh',
        minHeight: '100dvh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div
        className="session-run-header"
        style={{
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
          borderRadius: 8,
          padding: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: theme.isDark ? 'none' : '0 12px 30px rgba(17, 24, 39, 0.06)',
        }}
      >
        <PrimaryButton label="Back" variant="secondary" size="sm" onPress={handleBack} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: 1.1,
              color: phaseAccent,
            }}
          >
            LIVE SESSION
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 20,
              fontWeight: 950,
              color: theme.colors.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {session.name}
          </div>
        </div>
        <span
          style={{
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: roundColor(engine.currentRound),
            borderRadius: 999,
            padding: '7px 10px',
            backgroundColor: `${roundColor(engine.currentRound)}1F`,
            fontSize: 12,
            fontWeight: 900,
            color: roundColor(engine.currentRound),
            whiteSpace: 'nowrap',
          }}
        >
          {Math.min(engine.currentRound, session.rounds)} / {session.rounds}
        </span>
      </div>

      <div
        className="session-run-content"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: '18px 0',
        }}
      >
        <div className="session-run-rounds" style={{ width: '100%', maxWidth: 388, flex: '0 0 auto' }}>
          <RoundTiles
            rounds={rounds}
            currentRound={engine.currentRound}
            onSelect={engine.goToRound}
          />
        </div>
        <TimerDisplay
          phase={engine.phase}
          remainingSeconds={engine.remainingSeconds}
          roundLabel={`Round ${Math.min(engine.currentRound, rounds.length)} / ${rounds.length}`}
          isCritical={isCriticalCountdown}
          phaseProgress={phaseProgress}
          criticalColor={isRestPhase ? '#2FB874' : '#F05454'}
          restColor="#2FB874"
        />
        {currentRoundInfo?.label ? (
          <div
            className="session-run-round-label"
            style={{
              textAlign: 'center',
              fontSize: 17,
              fontWeight: 900,
              letterSpacing: 0.4,
              color: phaseAccent,
            }}
          >
            {currentRoundInfo.label}
          </div>
        ) : null}
        {roundNotes.length > 0 ? (
          <div
            className="session-run-round-description"
            style={{
              width: '100%',
              maxWidth: 388,
              padding: '0 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {roundNotes.map((note, index) => (
              <div
                key={'name' in note ? note.name : index}
                style={{
                  textAlign: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  color: theme.colors.textMuted,
                }}
              >
                {'name' in note ? (
                  <span style={{ fontWeight: 900, color: theme.colors.text }}>{note.name}: </span>
                ) : null}
                <span>{note.description}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div
        className="session-run-controls"
        style={{
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
          borderRadius: 8,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: theme.isDark ? 'none' : '0 12px 30px rgba(17, 24, 39, 0.08)',
        }}
      >
        {nextPhaseText ? (
          <div
            className="session-run-next"
            style={{
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: theme.colors.border,
              borderRadius: 8,
              backgroundColor: theme.colors.surface,
              padding: '11px 12px',
              textAlign: 'center',
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: 0.6,
              color: theme.colors.textMuted,
            }}
          >
            {nextPhaseText}
          </div>
        ) : null}

        <div className="session-run-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10 }}>
          <PrimaryButton label="Stop" variant="secondary" onPress={engine.reset} style={controlBtnStyle} />
          {showStart ? (
            <PrimaryButton label="Start" onPress={engine.start} size="lg" style={controlBtnStyle} />
          ) : null}
          {showPause ? (
            <PrimaryButton label="Pause" onPress={engine.pause} size="lg" style={controlBtnStyle} />
          ) : null}
          {showResume ? (
            <PrimaryButton label="Resume" onPress={engine.resume} size="lg" style={controlBtnStyle} />
          ) : null}
          {showRepeat ? (
            <PrimaryButton label="Repeat" onPress={engine.repeat} size="lg" style={controlBtnStyle} />
          ) : null}
        </div>

        {showSkipRound ? (
          <PrimaryButton label="Skip round to 3s" variant="secondary" onPress={engine.skipRound} />
        ) : null}
        {showSkipRest ? (
          <PrimaryButton label="Skip rest to 3s" variant="secondary" onPress={engine.skipRest} />
        ) : null}
      </div>
    </div>
  );
};
