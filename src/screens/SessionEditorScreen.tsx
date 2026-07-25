// Core
import { useEffect, useMemo, useState } from 'react';

// App
import { useSessions } from '@/app/SessionsProvider';

// Components
import { NameCombobox } from '@/components/NameCombobox';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TimeWheelField } from '@/components/TimeWheelField';

// Hooks
import { soundOptions, useSound } from '@/hooks/useSound';

// Navigation
import { ScreenProps } from '@/navigation/RootNavigator';

// Storage
import { rosterStorage } from '@/storage/rosterStorage';
import { settingsStorage } from '@/storage/settingsStorage';

// Theme
import { useTheme } from '@/theme/ThemeProvider';

// Types
import { Participant, RoundConfig, SessionCategory, SoundId } from '@/types/models';

// Utils
import { createId } from '@/utils/id';
import { notify } from '@/utils/dialog';
import { resolveRounds, sumRounds } from '@/utils/rounds';
import { formatSecondsToClock } from '@/utils/timeFormat';
// Consts
import { plainTextInputProps } from '@/consts/forms';

type TimingMode = 'uniform' | 'custom';

/** A participant is "customized" once any of its round overrides has a value. */
const isCustomized = (participant: Participant): boolean =>
  participant.workSeconds !== undefined ||
  participant.restSeconds !== undefined ||
  participant.description !== undefined;

const categoryOptions: { label: string; value: SessionCategory }[] = [
  { label: 'Boxing', value: 'boxing' },
  { label: 'Running', value: 'running' },
  { label: 'Custom', value: 'custom' },
];

const timingModeOptions: { label: string; value: TimingMode }[] = [
  { label: 'Same for all', value: 'uniform' },
  { label: 'Per round', value: 'custom' },
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
  const [category, setCategory] = useState<SessionCategory>(current?.category ?? 'boxing');
  const [rounds, setRounds] = useState(current?.rounds ?? 3);
  const [workSeconds, setWorkSeconds] = useState(current?.workSeconds ?? 180);
  const [restSeconds, setRestSeconds] = useState(current?.restSeconds ?? 60);
  const [soundId, setSoundId] = useState<SoundId>(current?.soundId ?? 'boxing-gong');
  const [mode, setMode] = useState<TimingMode>(current?.roundsConfig?.length ? 'custom' : 'uniform');
  const [roundList, setRoundList] = useState<RoundConfig[]>(() =>
    current?.roundsConfig?.length
      ? current.roundsConfig.map((round) => ({ ...round }))
      : resolveRounds({
          rounds: current?.rounds ?? 3,
          workSeconds: current?.workSeconds ?? 180,
          restSeconds: current?.restSeconds ?? 60,
        }),
  );
  const [description, setDescription] = useState(current?.description ?? '');
  const [participants, setParticipants] = useState<Participant[]>(
    () => current?.participants?.map((participant) => ({ ...participant, names: [...participant.names] })) ?? [],
  );
  const [roster, setRoster] = useState<string[]>([]);

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

  const totals = useMemo(() => sumRounds(roundList), [roundList]);

  const addParticipant = () => {
    setParticipants((list) => [...list, { id: createId(), names: [''] }]);
  };

  const removeParticipant = (id: string) => {
    setParticipants((list) => list.filter((participant) => participant.id !== id));
  };

  const moveParticipant = (index: number, direction: -1 | 1) => {
    setParticipants((list) => {
      const target = index + direction;
      if (target < 0 || target >= list.length) {
        return list;
      }
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const updateParticipant = (id: string, patch: Partial<Participant>) => {
    setParticipants((list) =>
      list.map((participant) => (participant.id === id ? { ...participant, ...patch } : participant)),
    );
  };

  const updateParticipantName = (id: string, nameIndex: number, value: string) => {
    setParticipants((list) =>
      list.map((participant) =>
        participant.id === id
          ? { ...participant, names: participant.names.map((name, i) => (i === nameIndex ? value : name)) }
          : participant,
      ),
    );
  };

  const addNameToParticipant = (id: string) => {
    setParticipants((list) =>
      list.map((participant) =>
        participant.id === id ? { ...participant, names: [...participant.names, ''] } : participant,
      ),
    );
  };

  const removeNameFromParticipant = (id: string, nameIndex: number) => {
    setParticipants((list) =>
      list.map((participant) =>
        participant.id === id && participant.names.length > 1
          ? { ...participant, names: participant.names.filter((_, i) => i !== nameIndex) }
          : participant,
      ),
    );
  };

  const toggleCustomize = (participant: Participant) => {
    if (isCustomized(participant)) {
      updateParticipant(participant.id, {
        workSeconds: undefined,
        restSeconds: undefined,
        description: undefined,
      });
    } else {
      updateParticipant(participant.id, { workSeconds, restSeconds });
    }
  };

  const handleRemoveFromRoster = async (nameToRemove: string) => {
    const next = await rosterStorage.remove(nameToRemove);
    setRoster(next);
  };

  const handleModeChange = (next: TimingMode) => {
    if (next === mode) {
      return;
    }

    if (next === 'custom') {
      // Seed the per-round list from the uniform values for continuity.
      setRoundList(resolveRounds({ rounds, workSeconds, restSeconds }));
    } else if (roundList[0]) {
      // Collapse back to uniform using the first round as the template.
      setRounds(roundList.length);
      setWorkSeconds(roundList[0].workSeconds);
      setRestSeconds(Math.max(1, roundList[0].restSeconds || 60));
    }

    setMode(next);
  };

  const updateRound = (index: number, patch: Partial<RoundConfig>) => {
    setRoundList((list) => list.map((round, i) => (i === index ? { ...round, ...patch } : round)));
  };

  const addRound = () => {
    setRoundList((list) => {
      const last = list[list.length - 1] ?? { workSeconds: 180, restSeconds: 60 };
      return [...list, { workSeconds: last.workSeconds, restSeconds: last.restSeconds }];
    });
  };

  const removeRound = (index: number) => {
    setRoundList((list) => (list.length <= 1 ? list : list.filter((_, i) => i !== index)));
  };

  const save = async () => {
    if (!name.trim()) {
      notify('Name is required');
      return;
    }

    const trimmedDescription = description.trim() || undefined;

    if (participants.length > 0) {
      const cleanedParticipants = participants.map((participant) => ({
        ...participant,
        names: participant.names.map((n) => n.trim()).filter(Boolean),
      }));

      if (cleanedParticipants.some((participant) => participant.names.length === 0)) {
        notify('Every person needs a name');
        return;
      }

      const draft = {
        name: name.trim(),
        category,
        rounds: cleanedParticipants.length,
        workSeconds,
        restSeconds,
        roundsConfig: undefined,
        description: trimmedDescription,
        participants: cleanedParticipants,
        soundId,
      };

      if (!current) {
        await createSession(draft);
      } else {
        await updateSession(current.id, draft);
      }

      await rosterStorage.addMany(cleanedParticipants.flatMap((participant) => participant.names));

      navigation.goBack();
      return;
    }

    if (mode === 'custom') {
      if (roundList.length < 1) {
        notify('Add at least one round');
        return;
      }
      if (roundList.some((round) => round.workSeconds < 1)) {
        notify('Each round needs at least 1 second of work');
        return;
      }

      const draft = {
        name: name.trim(),
        category,
        rounds: roundList.length,
        workSeconds: roundList[0].workSeconds,
        restSeconds: roundList[0].restSeconds,
        roundsConfig: roundList,
        description: trimmedDescription,
        participants: undefined,
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

    if (rounds < 1 || workSeconds < 1 || restSeconds < 1) {
      notify('Values must be at least 1 second');
      return;
    }

    const draft = {
      name: name.trim(),
      category,
      rounds,
      workSeconds,
      restSeconds,
      roundsConfig: undefined,
      description: trimmedDescription,
      participants: undefined,
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
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
    color: theme.colors.textMuted,
  };

  const sectionStyle = {
    borderWidth: 1,
    borderStyle: 'solid' as const,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 16,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    boxShadow: theme.isDark ? 'none' : '0 12px 28px rgba(17, 24, 39, 0.06)',
  };

  const stepperButtonStyle = {
    width: 44,
    height: 42,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 26,
    fontWeight: 900,
    backgroundColor: theme.colors.surfaceStrong,
    color: theme.colors.text,
  } as const;

  const roundGhostButtonStyle = {
    minWidth: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'solid' as const,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    color: theme.colors.textMuted,
    fontSize: 15,
    fontWeight: 900,
  };

  return (
    <div
      className="app-shell scroll-area"
      style={{
        backgroundColor: theme.colors.background,
        padding: '42px 14px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
          borderRadius: 8,
          padding: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <PrimaryButton label="Close" variant="secondary" size="sm" onPress={() => navigation.goBack()} />
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.1, color: theme.colors.textMuted }}>
            PROGRAM
          </div>
          <h1
            style={{
              margin: '2px 0 0',
              fontSize: 22,
              fontWeight: 950,
              lineHeight: 1.05,
              color: theme.colors.text,
            }}
          >
            {current ? 'Edit workout' : 'New workout'}
          </h1>
        </div>
        <PrimaryButton label="Save" size="sm" onPress={save} />
      </div>

      <div style={sectionStyle}>
        <span style={labelStyle}>Session Name</span>
        <input
          {...plainTextInputProps}
          type="text"
          enterKeyHint="done"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Heavy Bag Drill"
          style={{
            height: 58,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.input,
            borderRadius: 8,
            padding: '0 16px',
            fontSize: 17,
            fontWeight: 800,
            color: theme.colors.text,
          }}
        />
      </div>

      <div style={sectionStyle}>
        <span style={labelStyle}>Category</span>
        <SegmentedControl value={category} onChange={setCategory} options={categoryOptions} maxPerRow={3} />
      </div>

      <div style={sectionStyle}>
        <div>
          <span style={labelStyle}>Description</span>
          <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: theme.colors.textMuted }}>
            Shown under the timer while this workout runs.
          </div>
        </div>
        <textarea
          {...plainTextInputProps}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="e.g. Jab-cross-hook combos, light footwork"
          rows={2}
          style={{
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.input,
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 15,
            fontWeight: 700,
            fontFamily: 'inherit',
            color: theme.colors.text,
            resize: 'vertical',
          }}
        />
      </div>

      <div style={sectionStyle}>
        <div>
          <span style={labelStyle}>Who's training ({participants.length})</span>
          <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: theme.colors.textMuted }}>
            Add boxers to name each round. Add more than one name to a round for pair or group
            training under one clock.
          </div>
        </div>

        {participants.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {participants.map((participant, index) => {
              const customized = isCustomized(participant);
              return (
                <div
                  key={participant.id}
                  style={{
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                    borderRadius: 8,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: 0.6, color: theme.colors.text }}>
                      ROUND {index + 1}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => moveParticipant(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move person ${index + 1} up`}
                        style={{ ...roundGhostButtonStyle, opacity: index === 0 ? 0.4 : 1 }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveParticipant(index, 1)}
                        disabled={index === participants.length - 1}
                        aria-label={`Move person ${index + 1} down`}
                        style={{
                          ...roundGhostButtonStyle,
                          opacity: index === participants.length - 1 ? 0.4 : 1,
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeParticipant(participant.id)}
                        aria-label={`Remove person ${index + 1}`}
                        style={roundGhostButtonStyle}
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {participant.names.map((personName, nameIndex) => (
                      <div key={nameIndex} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <NameCombobox
                          value={personName}
                          onChange={(next) => updateParticipantName(participant.id, nameIndex, next)}
                          suggestions={roster}
                          onRemoveSuggestion={handleRemoveFromRoster}
                          placeholder={nameIndex === 0 ? 'Name' : 'Partner name'}
                          ariaLabel={`Name ${nameIndex + 1} for round ${index + 1}`}
                        />
                        {participant.names.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeNameFromParticipant(participant.id, nameIndex)}
                            aria-label={`Remove name ${nameIndex + 1} from round ${index + 1}`}
                            style={roundGhostButtonStyle}
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    ))}
                    <PrimaryButton
                      label="+ Add partner"
                      variant="secondary"
                      size="sm"
                      onPress={() => addNameToParticipant(participant.id)}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleCustomize(participant)}
                    style={{
                      alignSelf: 'flex-start',
                      fontSize: 13,
                      fontWeight: 800,
                      color: theme.colors.primary,
                      background: 'transparent',
                      border: 'none',
                    }}
                  >
                    {customized ? 'Using custom timing/description' : 'Customize timing & description'}
                  </button>

                  {customized ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                        <TimeWheelField
                          label="WORK"
                          valueSeconds={participant.workSeconds ?? workSeconds}
                          onChange={(value) => updateParticipant(participant.id, { workSeconds: value })}
                          minSeconds={1}
                        />
                        <TimeWheelField
                          label="REST"
                          valueSeconds={participant.restSeconds ?? restSeconds}
                          onChange={(value) => updateParticipant(participant.id, { restSeconds: value })}
                          minSeconds={0}
                        />
                      </div>
                      <input
                        {...plainTextInputProps}
                        type="text"
                        enterKeyHint="done"
                        aria-label={`Description for round ${index + 1}`}
                        value={participant.description ?? ''}
                        onChange={(event) =>
                          updateParticipant(participant.id, { description: event.target.value })
                        }
                        placeholder={description || 'What to do this round'}
                        style={{
                          height: 48,
                          borderWidth: 1,
                          borderStyle: 'solid',
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.input,
                          borderRadius: 8,
                          padding: '0 14px',
                          fontSize: 14,
                          fontWeight: 700,
                          color: theme.colors.text,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <PrimaryButton label="+ Add person" variant="secondary" onPress={addParticipant} />
      </div>

      {participants.length === 0 ? (
        <div style={sectionStyle}>
          <div>
            <span style={labelStyle}>Round timing</span>
            <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: theme.colors.textMuted }}>
              Use one interval for every round, or set each round and rest individually.
            </div>
          </div>
          <SegmentedControl value={mode} onChange={handleModeChange} options={timingModeOptions} maxPerRow={2} />
        </div>
      ) : (
        <div style={sectionStyle}>
          <div>
            <span style={labelStyle}>Default timing</span>
            <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: theme.colors.textMuted }}>
              Each person uses this unless customized above. Rounds: {participants.length} — one per
              person.
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <TimeWheelField label="WORK" valueSeconds={workSeconds} onChange={setWorkSeconds} minSeconds={1} />
            <TimeWheelField label="REST" valueSeconds={restSeconds} onChange={setRestSeconds} minSeconds={1} />
          </div>
        </div>
      )}

      {participants.length === 0 && mode === 'uniform' ? (
        <>
          <div
            style={{
              ...sectionStyle,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: theme.colors.text }}>Rounds</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: theme.colors.textMuted }}>Total work cycles</div>
            </div>

            <div
              style={{
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                borderRadius: 8,
                minHeight: 52,
                padding: 5,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <button type="button" onClick={() => setRounds((value) => Math.max(1, value - 1))} style={stepperButtonStyle}>
                -
              </button>
              <span style={{ minWidth: 44, textAlign: 'center', fontSize: 21, fontWeight: 950, color: theme.colors.text }}>
                {rounds}
              </span>
              <button type="button" onClick={() => setRounds((value) => value + 1)} style={stepperButtonStyle}>
                +
              </button>
            </div>
          </div>

          <div style={sectionStyle}>
            <div>
              <span style={labelStyle}>Timing</span>
              <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: theme.colors.textMuted }}>
                Set the active interval and recovery interval.
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <TimeWheelField label="WORK" valueSeconds={workSeconds} onChange={setWorkSeconds} minSeconds={1} />
              <TimeWheelField label="REST" valueSeconds={restSeconds} onChange={setRestSeconds} minSeconds={1} />
            </div>
          </div>
        </>
      ) : null}

      {participants.length === 0 && mode === 'custom' ? (
        <div style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <span style={labelStyle}>Rounds ({roundList.length})</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: theme.colors.textMuted }}>
              Total {formatSecondsToClock(totals.total)}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {roundList.map((round, index) => {
              const isLast = index === roundList.length - 1;
              return (
                <div
                  key={index}
                  style={{
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                    borderRadius: 8,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: 0.6, color: theme.colors.text }}>
                      ROUND {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeRound(index)}
                      disabled={roundList.length <= 1}
                      aria-label={`Remove round ${index + 1}`}
                      style={{
                        minWidth: 36,
                        height: 32,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderStyle: 'solid',
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.card,
                        color: theme.colors.textMuted,
                        fontSize: 18,
                        fontWeight: 900,
                        opacity: roundList.length <= 1 ? 0.4 : 1,
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                    <TimeWheelField
                      label="WORK"
                      valueSeconds={round.workSeconds}
                      onChange={(value) => updateRound(index, { workSeconds: value })}
                      minSeconds={1}
                    />
                    <TimeWheelField
                      label={isLast ? 'REST AFTER' : 'REST'}
                      valueSeconds={round.restSeconds}
                      onChange={(value) => updateRound(index, { restSeconds: value })}
                      minSeconds={0}
                    />
                  </div>
                  {isLast ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: theme.colors.textMuted }}>
                      Rest after the last round is optional — set 00:00 to finish right away.
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          <PrimaryButton label="+ Add round" variant="secondary" onPress={addRound} />
        </div>
      ) : null}

      <div style={sectionStyle}>
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
      </div>
    </div>
  );
};
