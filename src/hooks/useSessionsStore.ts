// Core
import { useCallback, useEffect, useMemo, useState } from 'react';

// Storage
import { sessionsStorage } from '@/storage/sessionsStorage';

// Types
import { Participant, RoundConfig, Session, SessionCategory, SoundId } from '@/types/models';

// Utils
import { createId } from '@/utils/id';

type SessionDraft = {
  name: string;
  category: SessionCategory;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  roundsConfig?: RoundConfig[];
  description?: string;
  participants?: Participant[];
  soundId: SoundId;
};

const sortByUpdatedDesc = (items: Session[]): Session[] =>
  [...items].sort((a, b) => b.updatedAt - a.updatedAt);

export const useSessionsStore = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const value = await sessionsStorage.getAll();
      if (!mounted) {
        return;
      }

      setSessions(sortByUpdatedDesc(value));
      setIsLoading(false);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const persist = useCallback(async (next: Session[]) => {
    setSessions(next);
    await sessionsStorage.saveAll(next);
  }, []);

  const createSession = useCallback(
    async (draft: SessionDraft): Promise<Session> => {
      const now = Date.now();
      const next: Session = {
        id: createId(),
        createdAt: now,
        updatedAt: now,
        ...draft,
      };

      const updated = sortByUpdatedDesc([next, ...sessions]);
      await persist(updated);
      return next;
    },
    [persist, sessions],
  );

  const updateSession = useCallback(
    async (id: string, draft: SessionDraft): Promise<Session | null> => {
      const current = sessions.find((session) => session.id === id);
      if (!current) {
        return null;
      }

      const nextSession: Session = {
        ...current,
        ...draft,
        updatedAt: Date.now(),
      };

      const nextList = sortByUpdatedDesc(
        sessions.map((session) => (session.id === id ? nextSession : session)),
      );

      await persist(nextList);
      return nextSession;
    },
    [persist, sessions],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      const next = sessions.filter((session) => session.id !== id);
      await persist(next);
    },
    [persist, sessions],
  );

  const applySoundToAll = useCallback(
    async (soundId: SoundId) => {
      const now = Date.now();
      const next = sessions.map((session) => ({
        ...session,
        soundId,
        updatedAt: now,
      }));
      await persist(sortByUpdatedDesc(next));
    },
    [persist, sessions],
  );

  const getById = useCallback(
    (id: string): Session | undefined => sessions.find((session) => session.id === id),
    [sessions],
  );

  const sessionsCount = useMemo(() => sessions.length, [sessions]);

  return {
    sessions,
    sessionsCount,
    isLoading,
    createSession,
    updateSession,
    deleteSession,
    applySoundToAll,
    getById,
  };
};

export type UseSessionsStoreResult = ReturnType<typeof useSessionsStore>;
