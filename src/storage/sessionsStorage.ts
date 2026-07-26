// Storage
import { localStore } from '@/storage/localStore';

// Types
import { Entrant, Participant, RoundConfig, Session, SoundId } from '@/types/models';

// Utils
import { createId } from '@/utils/id';

const SESSIONS_KEY = 'box_timer_sessions_v1';
const SOUND_IDS: SoundId[] = ['boxing-gong', 'classic-gong', 'gong', 'beep', 'bell', 'tick', 'chime'];

const parseRoundsConfig = (value: unknown): RoundConfig[] | undefined => {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }

  const cleaned = value
    .filter(
      (round): round is RoundConfig =>
        !!round && typeof (round as RoundConfig).workSeconds === 'number',
    )
    .map((round) => {
      const cleanedRound: RoundConfig = {
        workSeconds: Math.max(1, Math.floor(round.workSeconds)),
        restSeconds: Math.max(0, Math.floor(round.restSeconds ?? 0)),
      };
      if (typeof round.description === 'string' && round.description.length > 0) {
        cleanedRound.description = round.description;
      }
      return cleanedRound;
    });

  return cleaned.length > 0 ? cleaned : undefined;
};

const parseEntrants = (value: unknown): Entrant[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry): Entrant | null => {
      // Back-compat: earlier builds stored a plain name string per entrant.
      if (typeof entry === 'string') {
        return entry.trim().length > 0 ? { name: entry } : null;
      }
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const raw = entry as Partial<Entrant>;
      if (typeof raw.name !== 'string' || raw.name.trim().length === 0) {
        return null;
      }
      const entrant: Entrant = { name: raw.name };
      if (typeof raw.description === 'string' && raw.description.length > 0) {
        entrant.description = raw.description;
      }
      if (typeof raw.workSeconds === 'number') {
        entrant.workSeconds = Math.max(1, Math.floor(raw.workSeconds));
      }
      if (typeof raw.restSeconds === 'number') {
        entrant.restSeconds = Math.max(0, Math.floor(raw.restSeconds));
      }
      return entrant;
    })
    .filter((entrant): entrant is Entrant => entrant !== null);
};

const parseParticipants = (value: unknown): Participant[] | undefined => {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }

  const cleaned = value
    .map((entry): Participant | null => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const raw = entry as Partial<Participant> & { names?: unknown };
      // Back-compat: earlier builds stored `names: string[]` instead of `entrants`.
      const entrants = parseEntrants(raw.entrants ?? raw.names);
      if (entrants.length === 0) {
        return null;
      }

      const participant: Participant = {
        id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : createId(),
        entrants,
      };
      if (typeof raw.description === 'string' && raw.description.length > 0) {
        participant.description = raw.description;
      }
      if (typeof raw.workSeconds === 'number') {
        participant.workSeconds = Math.max(1, Math.floor(raw.workSeconds));
      }
      if (typeof raw.restSeconds === 'number') {
        participant.restSeconds = Math.max(0, Math.floor(raw.restSeconds));
      }
      return participant;
    })
    .filter((participant): participant is Participant => participant !== null);

  return cleaned.length > 0 ? cleaned : undefined;
};

const parseSessions = (raw: string | null): Session[] => {
  if (!raw) {
    return [];
  }

  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) {
      return [];
    }

    return (value as Session[]).map((session) => ({
      ...session,
      roundsConfig: parseRoundsConfig((session as Session).roundsConfig),
      participants: parseParticipants((session as Session).participants),
      trainingMode:
        session.trainingMode === 'group' || session.trainingMode === 'pair'
          ? session.trainingMode
          : undefined,
      description:
        typeof session.description === 'string' && session.description.length > 0
          ? session.description
          : undefined,
      soundId: SOUND_IDS.includes(session.soundId as SoundId)
        ? (session.soundId as SoundId)
        : 'boxing-gong',
    }));
  } catch {
    return [];
  }
};

export const sessionsStorage = {
  async getAll(): Promise<Session[]> {
    const raw = await localStore.getItem(SESSIONS_KEY);
    return parseSessions(raw);
  },

  async saveAll(sessions: Session[]): Promise<void> {
    await localStore.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  },
};
