export type SessionCategory = 'boxing' | 'running' | 'custom';

export type SoundId =
  | 'boxing-gong'
  | 'classic-gong'
  | 'gong'
  | 'beep'
  | 'bell'
  | 'tick'
  | 'chime';

/**
 * Per-round timing. `restSeconds` is the recovery interval that follows this
 * round (0 = go straight to the next round / finish). When a session has a
 * `roundsConfig`, these values override the uniform `workSeconds`/`restSeconds`.
 * `description` overrides the session's shared description for this round.
 */
export type RoundConfig = {
  workSeconds: number;
  restSeconds: number;
  description?: string;
};

/**
 * One person assigned to a configured round. Group Training runs entrants in
 * order. Work, rest, and instructions inherit from the configured round unless
 * this person has an explicit override. Pair Training keeps its shared round
 * clock and only uses the description override.
 */
export type Entrant = {
  name: string;
  description?: string;
  workSeconds?: number;
  restSeconds?: number;
};

/**
 * One configured round and its ordered people. Group Training runs `entrants`
 * sequentially; Pair Training keeps them under the round's shared clock.
 * Round-level work, rest, and instructions are the defaults inherited by every
 * entrant.
 */
export type Participant = {
  id: string;
  entrants: Entrant[];
  description?: string;
  workSeconds?: number;
  restSeconds?: number;
};

export type Session = {
  id: string;
  name: string;
  category: SessionCategory;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  /** Optional individual timing for each round. Length equals `rounds`. */
  roundsConfig?: RoundConfig[];
  /** Default description shown under the timer; overridable per participant. */
  description?: string;
  /**
   * When set and non-empty, one configured round per entry (in order) and this
   * supersedes `roundsConfig`.
   */
  participants?: Participant[];
  /**
   * Group entrants work one after another; pair entrants share the same clock.
   * Missing values are treated as legacy data and inferred from entrant count.
   */
  trainingMode?: 'group' | 'pair';
  soundId: SoundId;
  createdAt: number;
  updatedAt: number;
};

export type TimerPhase = 'prep' | 'work' | 'rest' | 'finished';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export type ThemeMode = 'system' | 'light' | 'dark';

export type AppSettings = {
  themeMode: ThemeMode;
  defaultSoundId: SoundId;
  keepScreenAwake: boolean;
  prepSeconds: number;
};
