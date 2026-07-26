// Core
import { useEffect, useMemo, useState } from 'react';

// App
import { useSessions } from '@/app/SessionsProvider';

// Components
import { IconButton } from '@/components/IconButton';
import { ArrowLeftIcon, CheckIcon, CopyIcon } from '@/components/Icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SessionDetailsPanel } from '@/components/SessionDetailsPanel';
import { TimeWheelField } from '@/components/TimeWheelField';
import { TrainingTypeSheet } from '@/components/TrainingTypeSheet/TrainingTypeSheet';

// Hooks
import { TimingMode, useRoundsConfig } from '@/hooks/useRoundsConfig/useRoundsConfig';
import { soundOptions, useSound } from '@/hooks/useSound';

// Navigation
import { ScreenProps } from '@/navigation/RootNavigator';

// Storage
import { rosterStorage } from '@/storage/rosterStorage';
import { settingsStorage } from '@/storage/settingsStorage';

// Theme
import { useTheme } from '@/theme/ThemeProvider';

// Types
import { SessionCategory, SoundId } from '@/types/models';

// Utils
import { copyToClipboard } from '@/utils/clipboard';
import { notify } from '@/utils/dialog';
import { formatSecondsToClock } from '@/utils/timeFormat';
// Consts
import { plainTextInputProps } from '@/consts/forms';

const categoryOptions: { label: string; value: SessionCategory }[] = [
  { label: 'Boxing', value: 'boxing' },
  { label: 'Running', value: 'running' },
  { label: 'Custom', value: 'custom' },
];

const timingModeOptions: { label: string; value: TimingMode }[] = [
  { label: 'Same for all', value: 'uniform' },
  { label: 'Per round', value: 'custom' },
  { label: 'Group Training', value: 'group' },
  { label: 'Pair Training', value: 'pair' },
];

const soundLabel = (label: string) =>
  label
    .replace('Boxing Gong (Default)', 'Boxing')
    .replace('Classic Gong', 'Classic')
    .replace('Gong (Legacy)', 'Gong');

export const SessionEditorScreen = ({ navigation, route }: ScreenProps<'SessionEditor'>) => {
  const { theme } = useTheme();
  const { createSession, updateSession, getById } = useSessions();
  const { play } = useSound();

  const current = useMemo(() => {
    if (!route.params?.sessionId) {
      return undefined;
    }
    return getById(route.params.sessionId);
  }, [getById, route.params?.sessionId]);

  const [name, setName] = useState(current?.name ?? '');
  const [category, setCategory] = useState<SessionCategory>(
    current?.category ?? route.params?.category ?? 'boxing',
  );
  const [soundId, setSoundId] = useState<SoundId>(current?.soundId ?? 'boxing-gong');
  const [description, setDescription] = useState(current?.description ?? '');
  const [roster, setRoster] = useState<string[]>([]);
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);
  const [copiedRoundIndex, setCopiedRoundIndex] = useState<number | null>(null);

  const training = useRoundsConfig(current);

  useEffect(() => {
    if (current) {
      return;
    }

    let mounted = true;

    const loadDefaultSound = async () => {
      const settings = await settingsStorage.get();
      if (!mounted) {
        return;
      }
      setSoundId(settings.defaultSoundId);
    };

    void loadDefaultSound();

    return () => {
      mounted = false;
    };
  }, [current]);

  useEffect(() => {
    let mounted = true;

    const loadRoster = async () => {
      const names = await rosterStorage.getAll();
      if (mounted) {
        setRoster(names);
      }
    };

    void loadRoster();

    return () => {
      mounted = false;
    };
  }, []);

  const rosterOptionsFor = (participantId: string, currentName: string) => {
    const currentKey = currentName.trim().toLowerCase();
    const usedNames = training.usedNamesForParticipant(participantId);
    return roster.filter(
      (savedName) =>
        savedName.toLowerCase() === currentKey ||
        !usedNames.has(savedName.toLowerCase()),
    );
  };

  const handleModeChange = (next: TimingMode) => {
    training.setMode(next);
  };

  const handleCopyRoundDescription = async (index: number) => {
    const text = training.roundList[index]?.description?.trim();
    if (!text) {
      return;
    }
    if (!(await copyToClipboard(text))) {
      return;
    }
    setCopiedRoundIndex(index);
    window.setTimeout(() => {
      setCopiedRoundIndex((current) => (current === index ? null : current));
    }, 1500);
  };

  const save = async () => {
    if (!name.trim()) {
      notify('Name is required');
      return;
    }

    const trimmedDescription = description.trim() || undefined;

    if (training.mode === 'group' || training.mode === 'pair') {
      if (
        training.mode === 'group' &&
        training.participants.some(
          (participant) => !participant.description?.trim(),
        )
      ) {
        notify('Add workout instructions to every group round');
        return;
      }

      const cleanedParticipants = training.participants.map((participant) => ({
        ...participant,
        description: participant.description?.trim() || undefined,
        workSeconds: Math.max(
          1,
          Math.floor(participant.workSeconds ?? training.workSeconds),
        ),
        restSeconds: Math.max(
          0,
          Math.floor(participant.restSeconds ?? training.restSeconds),
        ),
        entrants: participant.entrants
          .map((entrant) => ({
            ...entrant,
            name: entrant.name.trim(),
            description: entrant.description?.trim() || undefined,
            workSeconds:
              training.mode === 'group' &&
              entrant.workSeconds !== undefined
                ? Math.max(1, Math.floor(entrant.workSeconds))
                : undefined,
            restSeconds:
              training.mode === 'group' &&
              entrant.restSeconds !== undefined
                ? Math.max(0, Math.floor(entrant.restSeconds))
                : undefined,
          }))
          .filter((entrant) => entrant.name.length > 0),
      }));

      if (cleanedParticipants.length === 0) {
        notify('Add at least one round');
        return;
      }

      if (cleanedParticipants.some((participant) => participant.entrants.length === 0)) {
        notify('Every person needs a name');
        return;
      }

      const draft = {
        name: name.trim(),
        category,
        rounds: cleanedParticipants.length,
        workSeconds: training.workSeconds,
        restSeconds: training.restSeconds,
        roundsConfig: undefined,
        // Named training stores instructions on each configured round.
        description: undefined,
        participants: cleanedParticipants,
        trainingMode: training.mode,
        soundId,
      };

      if (!current) {
        await createSession(draft);
      } else {
        await updateSession(current.id, draft);
      }

      navigation.goBack();
      return;
    }

    if (training.mode === 'custom') {
      if (training.roundList.length < 1) {
        notify('Add at least one round');
        return;
      }
      if (training.roundList.some((round) => round.workSeconds < 1)) {
        notify('Each round needs at least 1 second of work');
        return;
      }

      const lastRoundIndex = training.roundList.length - 1;
      const cleanedRoundList = training.roundList.map((round, index) => ({
        ...round,
        // The last round never rests — there's no next round to recover for.
        restSeconds: index === lastRoundIndex ? 0 : round.restSeconds,
        description: round.description?.trim() || undefined,
      }));

      const draft = {
        name: name.trim(),
        category,
        rounds: cleanedRoundList.length,
        workSeconds: cleanedRoundList[0].workSeconds,
        restSeconds: cleanedRoundList[0].restSeconds,
        roundsConfig: cleanedRoundList,
        // Per-round mode stores instructions on each configured round.
        description: undefined,
        participants: undefined,
        trainingMode: undefined,
        soundId,
      };

      if (!current) {
        await createSession(draft);
      } else {
        await updateSession(current.id, draft);
      }

      navigation.goBack();
      return;
    }

    if (training.rounds < 1 || training.workSeconds < 1 || training.restSeconds < 1) {
      notify('Values must be at least 1 second');
      return;
    }

    const draft = {
      name: name.trim(),
      category,
      rounds: training.rounds,
      workSeconds: training.workSeconds,
      restSeconds: training.restSeconds,
      roundsConfig: undefined,
      description: trimmedDescription,
      participants: undefined,
      trainingMode: undefined,
      soundId,
    };

    if (!current) {
      await createSession(draft);
    } else {
      await updateSession(current.id, draft);
    }

    navigation.goBack();
  };

  const labelStyle = {
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: 0,
    color: theme.colors.textMuted,
  };

  const sectionStyle = {
    borderWidth: 1,
    borderStyle: 'solid' as const,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 18,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 14,
    boxShadow: theme.isDark ? 'none' : '0 1px 2px rgba(21, 24, 32, 0.05), 0 12px 34px rgba(21, 24, 32, 0.07)',
  };

  const stepperButtonStyle = {
    width: 44,
    height: 42,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    fontWeight: 700,
    backgroundColor: theme.colors.card,
    color: theme.colors.text,
  } as const;

  const isTraining = training.mode === 'group' || training.mode === 'pair';
  const currentModeLabel =
    timingModeOptions.find((option) => option.value === training.mode)?.label ?? 'Type';

  return (
    <main className="app-shell editor-screen screen-enter">
      <header className="editor-header">
        <div className="editor-header__bar">
          <IconButton
            ariaLabel="Close"
            icon={<ArrowLeftIcon />}
            onPress={() => navigation.goBack()}
          />
          <div className="editor-header__identity">
            <h1>
              {current ? 'Edit workout' : 'New workout'}
            </h1>
            <p>{current ? 'Update your program' : 'Build a repeatable session'}</p>
          </div>
          <PrimaryButton label="Save" size="sm" onPress={save} />
        </div>

        <div className="editor-header__fields">
          <input
            {...plainTextInputProps}
            className="text-field editor-header__name"
            type="text"
            enterKeyHint="done"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Heavy Bag Drill"
          />
          <button
            type="button"
            aria-label="Type"
            className="type-picker"
            onClick={() => setTypeSheetOpen(true)}
          >
            <span className="type-picker__label">Type</span>
            <span className="type-picker__value">
              {currentModeLabel}
            </span>
          </button>
        </div>
      </header>

      <div className="scroll-area editor-content">
      <section className="surface-section" style={sectionStyle}>
        <span style={labelStyle}>Category</span>
        <SegmentedControl value={category} onChange={setCategory} options={categoryOptions} maxPerRow={3} />
      </section>

      {training.mode === 'uniform' ? (
        <>
          <div
            className="rounds-stepper-section"
            style={{
              ...sectionStyle,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div className="rounds-stepper-section__copy">
              <h2>Rounds</h2>
              <p>Total work cycles</p>
            </div>

            <div className="stepper">
              <button
                type="button"
                className="stepper__button"
                onClick={() => training.setRounds((value) => Math.max(1, value - 1))}
                style={stepperButtonStyle}
              >
                -
              </button>
              <span className="stepper__value">
                {training.rounds}
              </span>
              <button
                type="button"
                className="stepper__button"
                onClick={() => training.setRounds((value) => value + 1)}
                style={stepperButtonStyle}
              >
                +
              </button>
            </div>
          </div>

          <section className="surface-section" style={sectionStyle}>
            <div>
              <span style={labelStyle}>Timing</span>
              <div className="section-description">
                Set the active interval and recovery interval.
              </div>
            </div>
            <div className="timing-grid">
              <TimeWheelField label="WORK" valueSeconds={training.workSeconds} onChange={training.setWorkSeconds} minSeconds={1} />
              <TimeWheelField label="REST" valueSeconds={training.restSeconds} onChange={training.setRestSeconds} minSeconds={1} />
            </div>
          </section>
        </>
      ) : null}

      {training.mode === 'custom' ? (
        <section className="surface-section" style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <span style={labelStyle}>Rounds ({training.roundList.length})</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: theme.colors.textMuted }}>
              Total {formatSecondsToClock(training.totals.total)}
            </span>
          </div>

          <div className="round-config-list">
            {training.roundList.map((round, index) => {
              const isLast = index === training.roundList.length - 1;
              return (
                <div
                  key={index}
                  className="round-config"
                >
                  <div className="round-config__header">
                    <span className="round-config__title">
                      ROUND {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => training.removeRound(index)}
                      disabled={training.roundList.length <= 1}
                      aria-label={`Remove round ${index + 1}`}
                      className="round-action"
                    >
                      ×
                    </button>
                  </div>

                  <div className="timing-grid" data-single={isLast}>
                    <TimeWheelField
                      label="WORK"
                      valueSeconds={round.workSeconds}
                      onChange={(value) => training.updateRound(index, { workSeconds: value })}
                      minSeconds={1}
                    />
                    {!isLast ? (
                      <TimeWheelField
                        label="REST"
                        valueSeconds={round.restSeconds}
                        onChange={(value) => training.updateRound(index, { restSeconds: value })}
                        minSeconds={0}
                      />
                    ) : null}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <label htmlFor={`round-${index}-description`} className="field-label" style={{ marginBottom: 0 }}>
                        Description
                      </label>
                      <button
                        type="button"
                        onClick={() => handleCopyRoundDescription(index)}
                        disabled={!round.description?.trim()}
                        aria-label={`Copy round ${index + 1} description`}
                        className="round-action"
                      >
                        {copiedRoundIndex === index ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
                      </button>
                    </div>
                    <textarea
                      {...plainTextInputProps}
                      id={`round-${index}-description`}
                      aria-label={`Description for round ${index + 1}`}
                      value={round.description ?? ''}
                      onChange={(event) => training.updateRound(index, { description: event.target.value })}
                      placeholder="e.g. Jab-cross-hook combos, light footwork"
                      rows={2}
                      className="text-field"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <PrimaryButton label="+ Add round" variant="secondary" onPress={training.addRound} />
        </section>
      ) : null}

      {isTraining ? (
        <SessionDetailsPanel
          training={training}
          rosterOptionsFor={rosterOptionsFor}
          onManageRoster={() => navigation.navigate('Settings')}
        />
      ) : null}

      {training.mode === 'uniform' ? (
        <section className="surface-section" style={sectionStyle}>
          <div>
            <span style={labelStyle}>Description</span>
            <div className="section-description">
              Shown under the timer while this workout runs.
            </div>
          </div>
          <textarea
            {...plainTextInputProps}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="e.g. Jab-cross-hook combos, light footwork"
            rows={2}
            className="text-field"
          />
        </section>
      ) : null}

      <section className="surface-section" style={sectionStyle}>
        <span style={labelStyle}>Alert Sound</span>
        <SegmentedControl
          value={soundId}
          onChange={(next) => {
            setSoundId(next);
            void play(next, { vibrate: false });
          }}
          options={soundOptions.map((option) => ({ label: soundLabel(option.label), value: option.id }))}
          maxPerRow={3}
        />
      </section>
      </div>

      <TrainingTypeSheet
        open={typeSheetOpen}
        value={training.mode}
        options={timingModeOptions}
        onSelect={(next) => {
          handleModeChange(next);
          setTypeSheetOpen(false);
        }}
        onClose={() => setTypeSheetOpen(false)}
      />
    </main>
  );
};
