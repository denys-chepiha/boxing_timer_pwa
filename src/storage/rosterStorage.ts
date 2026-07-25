// Storage
import { localStore } from '@/storage/localStore';

const ROSTER_KEY = 'box_timer_roster_v1';

const parseRoster = (raw: string | null): string[] => {
  if (!raw) {
    return [];
  }

  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((name): name is string => typeof name === 'string' && name.trim().length > 0);
  } catch {
    return [];
  }
};

/** Dedupes case-insensitively (first-seen casing wins) and sorts alphabetically. */
const normalize = (names: string[]): string[] => {
  const byLowerCase = new Map<string, string>();
  names.forEach((name) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    const key = trimmed.toLowerCase();
    if (!byLowerCase.has(key)) {
      byLowerCase.set(key, trimmed);
    }
  });
  return Array.from(byLowerCase.values()).sort((a, b) => a.localeCompare(b));
};

/** A saved roster of boxer names, remembered across workouts for the name picker. */
export const rosterStorage = {
  async getAll(): Promise<string[]> {
    const raw = await localStore.getItem(ROSTER_KEY);
    return normalize(parseRoster(raw));
  },

  async add(name: string): Promise<string[]> {
    if (!name.trim()) {
      return rosterStorage.getAll();
    }
    const current = await rosterStorage.getAll();
    const next = normalize([...current, name]);
    await localStore.setItem(ROSTER_KEY, JSON.stringify(next));
    return next;
  },

  async remove(name: string): Promise<string[]> {
    const current = await rosterStorage.getAll();
    const key = name.trim().toLowerCase();
    const next = current.filter((existing) => existing.toLowerCase() !== key);
    await localStore.setItem(ROSTER_KEY, JSON.stringify(next));
    return next;
  },
};
