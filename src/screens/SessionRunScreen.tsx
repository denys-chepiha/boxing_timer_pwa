// Core
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// App
import { useSessions } from '@/app/SessionsProvider';

// Components
import { IconButton } from '@/components/IconButton';
import {
  ArrowLeftIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  SkipForwardIcon,
  StopIcon,
} from '@/components/Icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundTiles } from '@/components/RoundTiles';
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
        trainingMode: session?.trainingMode,
      }),
    [
      session?.restSeconds,
      session?.rounds,
      session?.workSeconds,
      session?.roundsConfig,
      session?.description,
      session?.participants,
      session?.trainingMode,
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
    const nextRound = rounds[engine.currentRound];
    const nextWorkLabel = nextRound?.label
      ? `${nextRound.label} (${formatSecondsToClock(nextWorkSeconds)})`
      : `Round ${engine.currentRound + 1} - Work (${formatSecondsToClock(nextWorkSeconds)})`;

    if (engine.phase === 'work') {
      const restSeconds = rounds[currentIndex]?.restSeconds ?? 0;
      if (restSeconds > 0) return `UP NEXT: Rest (${formatSecondsToClock(restSeconds)})`;
      if (engine.currentRound >= count) return 'UP NEXT: Finish';
      return `UP NEXT: ${nextWorkLabel}`;
    }
    if (engine.phase === 'rest') {
      if (engine.currentRound >= count) return 'UP NEXT: Finish';
      return `UP NEXT: ${nextWorkLabel}`;
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
  const counterRoundInfo =
    currentRoundInfo ??
    rounds[Math.min(engine.currentRound, rounds.length) - 1] ??
    null;
  const currentGroupRound = counterRoundInfo?.groupRound;
  const currentGroupRoundCount = counterRoundInfo?.groupRoundCount;
  const headerRoundText =
    currentGroupRound && currentGroupRoundCount
      ? `${currentGroupRound} / ${currentGroupRoundCount}`
      : `${Math.min(engine.currentRound, rounds.length)} / ${rounds.length}`;
  const timerRoundLabel =
    currentGroupRound && currentGroupRoundCount
      ? `Round ${currentGroupRound} / ${currentGroupRoundCount}${
          counterRoundInfo.partnerCount && counterRoundInfo.partnerCount > 1
            ? ` · Partner ${counterRoundInfo.partnerPosition} / ${counterRoundInfo.partnerCount}`
            : ''
        }`
      : `Round ${Math.min(engine.currentRound, rounds.length)} / ${rounds.length}`;
  return (
    <main
      className="app-shell session-run-shell"
      data-phase={engine.phase}
      data-critical={isCriticalCountdown}
    >
      <header className="session-run-header">
        <IconButton ariaLabel="Back" icon={<ArrowLeftIcon />} onPress={handleBack} />
        <div className="session-run-header__copy">
          <div className="session-run-header__status">
            LIVE SESSION
          </div>
          <div className="session-run-header__name">{session.name}</div>
        </div>
        <span className="session-run-header__round">{headerRoundText}</span>
      </header>

      <section className="session-run-content">
        <div className="session-run-rounds">
          <RoundTiles
            rounds={rounds}
            currentRound={engine.currentRound}
            onSelect={engine.goToRound}
          />
        </div>
        <TimerDisplay
          phase={engine.phase}
          remainingSeconds={engine.remainingSeconds}
          roundLabel={timerRoundLabel}
          isCritical={isCriticalCountdown}
          phaseProgress={phaseProgress}
          criticalColor={isRestPhase ? '#2FB874' : '#F05454'}
          restColor="#2FB874"
        />
        {currentRoundInfo?.label ? (
          <div className="session-run-round-label">
            {currentRoundInfo.label}
          </div>
        ) : null}
        {roundNotes.length > 0 ? (
          <div className="session-run-round-description">
            {roundNotes.map((note, index) => (
              <div key={'name' in note ? note.name : index}>
                {'name' in note ? (
                  <strong>{note.name}: </strong>
                ) : null}
                <span>{note.description}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <footer className="session-run-controls">
        {nextPhaseText ? (
          <div className="session-run-next">{nextPhaseText}</div>
        ) : null}

        <div className="session-run-actions">
          <PrimaryButton
            label="Stop"
            icon={<StopIcon />}
            variant="secondary"
            onPress={engine.reset}
          />
          {showStart ? (
            <PrimaryButton label="Start" icon={<PlayIcon />} onPress={engine.start} size="lg" />
          ) : null}
          {showPause ? (
            <PrimaryButton label="Pause" icon={<PauseIcon />} onPress={engine.pause} size="lg" />
          ) : null}
          {showResume ? (
            <PrimaryButton label="Resume" icon={<PlayIcon />} onPress={engine.resume} size="lg" />
          ) : null}
          {showRepeat ? (
            <PrimaryButton
              label="Repeat"
              icon={<RepeatIcon />}
              onPress={engine.repeat}
              size="lg"
            />
          ) : null}
        </div>

        {showSkipRound ? (
          <PrimaryButton
            label="Skip round to 3s"
            icon={<SkipForwardIcon />}
            className="session-run-skip"
            variant="secondary"
            onPress={engine.skipRound}
          />
        ) : null}
        {showSkipRest ? (
          <PrimaryButton
            label="Skip rest to 3s"
            icon={<SkipForwardIcon />}
            className="session-run-skip"
            variant="secondary"
            onPress={engine.skipRest}
          />
        ) : null}
      </footer>
    </main>
  );
};
