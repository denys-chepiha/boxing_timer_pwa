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
 */
export type RoundConfig = {
  workSeconds: number;
  restSeconds: number;
};

/**
 * One round's worth of people. `names` holds everyone sharing that round
 * under a single clock — one name is a solo turn, two or more is a pair/group
 * training together. `description`/`workSeconds`/`restSeconds` override the
 * session defaults for this round; `undefined` means "inherit".
 */
export type Participant = {
  id: string;
  names: string[];
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
   * When set and non-empty, one round per entry (in order) and this
   * supersedes `roundsConfig` — round count becomes `participants.length`.
   */
  participants?: Participant[];
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
