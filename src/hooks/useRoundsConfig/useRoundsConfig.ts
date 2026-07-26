// Core
import { useMemo, useState } from 'react';

// Types
import { Participant, RoundConfig, Session } from '@/types/models';

// Utils
import { createId } from '@/utils/id';
import { resolveRounds, sumRounds } from '@/utils/rounds';

export type TimingMode = 'uniform' | 'custom' | 'group' | 'pair';

const initialModeFor = (current?: Session): TimingMode => {
  if (current?.participants?.length) {
    if (current.trainingMode) {
      return current.trainingMode;
    }
    return current.participants.every((participant) => participant.entrants.length === 2)
      ? 'pair'
      : 'group';
  }
  return current?.roundsConfig?.length ? 'custom' : 'uniform';
};

type ParticipantTemplate = Pick<Participant, 'workSeconds' | 'restSeconds' | 'description'>;

/**
 * A fresh first round for the named training list.
 */
const blankParticipant = (
  mode: TimingMode,
  template: ParticipantTemplate,
): Participant => {
  const entrantCount = mode === 'pair' ? 2 : 1;

  return {
    id: createId(),
    entrants: Array.from({ length: entrantCount }, () => ({ name: '' })),
    workSeconds: template.workSeconds,
    restSeconds: template.restSeconds,
    description: template.description,
  };
};

const participantsForEditing = (current?: Session): Participant[] => {
  if (!current?.participants?.length) {
    return [];
  }

  const initialMode = initialModeFor(current);

  return current.participants.map((participant) => {
    const roundWorkSeconds = participant.workSeconds ?? current.workSeconds;
    const roundRestSeconds = participant.restSeconds ?? current.restSeconds;
    const roundDescription =
      participant.description ??
      current.description ??
      (initialMode === 'group'
        ? participant.entrants.find((entrant) => entrant.description?.trim())
            ?.description
        : undefined);

    return {
      ...participant,
      workSeconds: roundWorkSeconds,
      restSeconds: roundRestSeconds,
      description: roundDescription,
      entrants: participant.entrants.map((entrant) => ({
        ...entrant,
        // Older builds eagerly copied round defaults into every Group Training
        // partner. Collapse equal values back to inheritance while preserving
        // genuine per-partner overrides.
        description:
          initialMode === 'group' &&
          entrant.description === roundDescription
            ? undefined
            : entrant.description,
        workSeconds:
          initialMode === 'group' &&
          entrant.workSeconds === roundWorkSeconds
            ? undefined
            : entrant.workSeconds,
        restSeconds:
          initialMode === 'group' &&
          entrant.restSeconds === roundRestSeconds
            ? undefined
            : entrant.restSeconds,
      })),
    };
  });
};

/**
 * Owns every piece of state behind the round-timing selector: uniform/custom
 * timing, per-round overrides, and the named training list (group/pair
 * modes). Extracted out of the editor screen so the screen only wires state
 * to UI.
 */
export const useRoundsConfig = (current?: Session) => {
  const [mode, setModeState] = useState<TimingMode>(() => initialModeFor(current));
  const [rounds, setRounds] = useState(current?.rounds ?? 3);
  const [workSeconds, setWorkSeconds] = useState(current?.workSeconds ?? 180);
  const [restSeconds, setRestSeconds] = useState(current?.restSeconds ?? 60);
  const [roundList, setRoundList] = useState<RoundConfig[]>(() =>
    current?.roundsConfig?.length
      ? current.roundsConfig.map((round) => ({ ...round }))
      : resolveRounds({
          rounds: current?.rounds ?? 3,
          workSeconds: current?.workSeconds ?? 180,
          restSeconds: current?.restSeconds ?? 60,
        }),
  );
  const [participants, setParticipants] = useState<Participant[]>(() =>
    participantsForEditing(current),
  );

  const totals = useMemo(() => sumRounds(roundList), [roundList]);

  // A boxer may return in every new round, but not appear twice in the same
  // round. Scope availability to the round instead of the whole workout.
  const usedNamesForParticipant = (id: string) => {
    const set = new Set<string>();
    participants
      .find((participant) => participant.id === id)
      ?.entrants.forEach((entrant) => {
        const trimmed = entrant.name.trim();
        if (trimmed) {
          set.add(trimmed.toLowerCase());
        }
      });
    return set;
  };

  const setMode = (next: TimingMode) => {
    if (next === mode) {
      return;
    }

    if (next === 'custom') {
      // Seed the per-round list from the uniform values for continuity.
      setRoundList(resolveRounds({ rounds, workSeconds, restSeconds }));
    } else if (next === 'uniform' && mode === 'custom' && roundList[0]) {
      // Collapse back to uniform using the first round as the template.
      setRounds(roundList.length);
      setWorkSeconds(roundList[0].workSeconds);
      setRestSeconds(Math.max(1, roundList[0].restSeconds || 60));
    }

    if (next === 'group' || next === 'pair') {
      if (participants.length === 0) {
        // Land straight in a round to name, rather than an empty list.
        setParticipants([
          blankParticipant(next, {
            workSeconds,
            restSeconds,
            description: current?.description,
          }),
        ]);
      } else if (next === 'pair') {
        // A pair is locked at two people — top up any round left with just one
        // from Group Training (padding only; never drops an existing name).
        setParticipants((list) =>
          list.map((participant) =>
            participant.entrants.length < 2
              ? {
                  ...participant,
                  entrants: [
                    ...participant.entrants,
                    ...Array.from({ length: 2 - participant.entrants.length }, () => ({ name: '' })),
                  ],
                }
              : participant,
          ),
        );
      }
    }

    setModeState(next);
  };

  const updateRound = (index: number, patch: Partial<RoundConfig>) => {
    setRoundList((list) => list.map((round, i) => (i === index ? { ...round, ...patch } : round)));
  };

  const addRound = () => {
    setRoundList((list) => {
      const last = list[list.length - 1] ?? { workSeconds: 180, restSeconds: 60 };
      // Carries the previous round's description over so a new round starts
      // from the same instructions instead of blank.
      return [
        ...list,
        { workSeconds: last.workSeconds, restSeconds: last.restSeconds, description: last.description },
      ];
    });
  };

  const removeRound = (index: number) => {
    setRoundList((list) => (list.length <= 1 ? list : list.filter((_, i) => i !== index)));
  };

  const addParticipant = () => {
    const previous = participants[participants.length - 1];
    const participant = previous
      ? {
          ...previous,
          id: createId(),
          entrants: previous.entrants.map((entrant) => ({ ...entrant })),
        }
      : blankParticipant(mode, {
          workSeconds,
          restSeconds,
          description: current?.description,
        });

    setParticipants((list) => [...list, participant]);
    return participant.id;
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

  const updateEntrantName = (id: string, entrantIndex: number, value: string) => {
    setParticipants((list) =>
      list.map((participant) =>
        participant.id === id
          ? {
              ...participant,
              entrants: participant.entrants.map((entrant, i) =>
                i === entrantIndex ? { ...entrant, name: value } : entrant,
              ),
            }
          : participant,
      ),
    );
  };

  const updateEntrantDescription = (id: string, entrantIndex: number, value: string) => {
    setParticipants((list) =>
      list.map((participant) =>
        participant.id === id
          ? {
              ...participant,
              entrants: participant.entrants.map((entrant, i) =>
                i === entrantIndex ? { ...entrant, description: value || undefined } : entrant,
              ),
            }
          : participant,
      ),
    );
  };

  const updateEntrantWorkSeconds = (id: string, entrantIndex: number, value: number) => {
    setParticipants((list) =>
      list.map((participant) =>
        participant.id === id
          ? {
              ...participant,
              entrants: participant.entrants.map((entrant, i) =>
                i === entrantIndex
                  ? { ...entrant, workSeconds: Math.max(1, Math.floor(value)) }
                  : entrant,
              ),
            }
          : participant,
      ),
    );
  };

  const updateEntrantRestSeconds = (id: string, entrantIndex: number, value: number) => {
    setParticipants((list) =>
      list.map((participant) =>
        participant.id === id
          ? {
              ...participant,
              entrants: participant.entrants.map((entrant, i) =>
                i === entrantIndex
                  ? { ...entrant, restSeconds: Math.max(0, Math.floor(value)) }
                  : entrant,
              ),
            }
          : participant,
      ),
    );
  };

  const resetEntrantOverrides = (id: string, entrantIndex: number) => {
    setParticipants((list) =>
      list.map((participant) =>
        participant.id === id
          ? {
              ...participant,
              entrants: participant.entrants.map((entrant, i) =>
                i === entrantIndex
                  ? {
                      name: entrant.name,
                      description: undefined,
                      workSeconds: undefined,
                      restSeconds: undefined,
                    }
                  : entrant,
              ),
            }
          : participant,
      ),
    );
  };

  const addEntrant = (id: string) => {
    setParticipants((list) =>
      list.map((participant) =>
        participant.id === id
          ? {
              ...participant,
              entrants: [...participant.entrants, { name: '' }],
            }
          : participant,
      ),
    );
  };

  const removeEntrant = (id: string, entrantIndex: number) => {
    setParticipants((list) =>
      list.map((participant) =>
        participant.id === id
          ? { ...participant, entrants: participant.entrants.filter((_, i) => i !== entrantIndex) }
          : participant,
      ),
    );
  };

  return {
    mode,
    setMode,
    rounds,
    setRounds,
    workSeconds,
    setWorkSeconds,
    restSeconds,
    setRestSeconds,
    roundList,
    updateRound,
    addRound,
    removeRound,
    totals,
    participants,
    usedNamesForParticipant,
    addParticipant,
    removeParticipant,
    moveParticipant,
    updateParticipant,
    updateEntrantName,
    updateEntrantDescription,
    updateEntrantWorkSeconds,
    updateEntrantRestSeconds,
    resetEntrantOverrides,
    addEntrant,
    removeEntrant,
  };
};

export type UseRoundsConfigResult = ReturnType<typeof useRoundsConfig>;
