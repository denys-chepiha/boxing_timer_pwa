// Types
import { Entrant, Participant, RoundConfig, Session } from '@/types/models';

type RoundsSource = Pick<
  Session,
  'rounds' | 'workSeconds' | 'restSeconds' | 'roundsConfig' | 'description' | 'participants'
>;

/** An entrant with its description resolved (entrant override, else the round's, else the session's). */
export type ResolvedEntrant = {
  name: string;
  description?: string;
};

/** A resolved round, plus who it's for and what to do (when the session names people). */
export type ResolvedRound = RoundConfig & {
  label?: string;
  description?: string;
  /** Present when the session names participants — one entry per person sharing this round. */
  entrants?: ResolvedEntrant[];
};

const resolveParticipantRounds = (
  participants: Participant[],
  session: Pick<RoundsSource, 'workSeconds' | 'restSeconds' | 'description'>,
): ResolvedRound[] => {
  const last = participants.length - 1;
  return participants.map((participant, index) => {
    const roundDescription = participant.description ?? session.description;
    const entrants: ResolvedEntrant[] = participant.entrants.map((entrant: Entrant) => ({
      name: entrant.name,
      description: entrant.description ?? roundDescription,
    }));

    return {
      workSeconds: Math.max(1, Math.floor(participant.workSeconds ?? session.workSeconds)),
      // The final round never has a trailing rest — the session ends on its work.
      restSeconds:
        index < last ? Math.max(0, Math.floor(participant.restSeconds ?? session.restSeconds)) : 0,
      label: entrants.map((entrant) => entrant.name).join(' & '),
      description: roundDescription,
      entrants,
    };
  });
};

/**
 * Resolves a session to its concrete per-round timing. Sessions with named
 * `participants` use one round per person/pair (in order); sessions with an
 * explicit `roundsConfig` use it directly; legacy/uniform sessions expand to N
 * identical rounds with rest between them (no rest after the final round).
 */
export const resolveRounds = (session: RoundsSource): ResolvedRound[] => {
  if (session.participants && session.participants.length > 0) {
    return resolveParticipantRounds(session.participants, session);
  }

  if (session.roundsConfig && session.roundsConfig.length > 0) {
    const last = session.roundsConfig.length - 1;
    return session.roundsConfig.map((round, index) => ({
      workSeconds: Math.max(1, Math.floor(round.workSeconds)),
      // The final round never has a trailing rest — the session ends on its work.
      restSeconds: index < last ? Math.max(0, Math.floor(round.restSeconds)) : 0,
      description: session.description,
    }));
  }

  const count = Math.max(1, Math.floor(session.rounds));
  return Array.from({ length: count }, (_, index) => ({
    workSeconds: Math.max(1, Math.floor(session.workSeconds)),
    restSeconds: index < count - 1 ? Math.max(0, Math.floor(session.restSeconds)) : 0,
    description: session.description,
  }));
};

export const sumRounds = (
  rounds: RoundConfig[],
): { work: number; rest: number; total: number } => {
  const work = rounds.reduce((sum, round) => sum + round.workSeconds, 0);
  const rest = rounds.reduce((sum, round) => sum + round.restSeconds, 0);
  return { work, rest, total: work + rest };
};

/** True when every round shares the same work and rest timing. */
export const isUniformRounds = (rounds: RoundConfig[]): boolean => {
  if (rounds.length <= 1) {
    return true;
  }
  const [first] = rounds;
  return rounds.every(
    (round, index) =>
      round.workSeconds === first.workSeconds &&
      // The final round's rest is conventionally 0, so ignore it when comparing.
      (round.restSeconds === first.restSeconds || index === rounds.length - 1),
  );
};
