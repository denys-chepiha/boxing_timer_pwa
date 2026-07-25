// Core
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
// Navigation
import { ScreenProps } from '@/navigation/RootNavigator';
// Screens
import { SessionEditorScreen } from '@/screens/SessionEditorScreen';
import { SessionRunScreen } from '@/screens/SessionRunScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
// Storage
import { rosterStorage } from '@/storage/rosterStorage';
import { runStateStorage } from '@/storage/runStateStorage';
import { sessionsStorage } from '@/storage/sessionsStorage';
import { settingsStorage } from '@/storage/settingsStorage';
// Test
import { makeSession, renderWithProviders } from '@/test/utils';

const fakeNav = () => ({ navigate: vi.fn(), goBack: vi.fn() });

const editorProps = (
  nav: ReturnType<typeof fakeNav>,
  sessionId?: string,
): ScreenProps<'SessionEditor'> => ({
  navigation: nav,
  route: { name: 'SessionEditor', params: sessionId ? { sessionId } : undefined },
});

afterEach(() => vi.restoreAllMocks());

describe('SessionEditorScreen', () => {
  it('blocks saving without a name', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(alertSpy).toHaveBeenCalledWith('Name is required');
    expect(nav.goBack).not.toHaveBeenCalled();
  });

  it('keeps the name input free of iOS autofill/autocorrect interference', () => {
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    const input = screen.getByPlaceholderText('Heavy Bag Drill');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).toHaveAttribute('autocorrect', 'off');
    expect(input).toHaveAttribute('autocapitalize', 'off');
    expect(input).toHaveAttribute('spellcheck', 'false');
  });

  it('creates a uniform session', async () => {
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.type(screen.getByPlaceholderText('Heavy Bag Drill'), 'My Workout');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(nav.goBack).toHaveBeenCalled());
    const saved = await sessionsStorage.getAll();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ name: 'My Workout', rounds: 3, roundsConfig: undefined });
  });

  it('supports per-round timing with add / remove', async () => {
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.type(screen.getByPlaceholderText('Heavy Bag Drill'), 'Intervals');
    await user.click(screen.getByRole('button', { name: 'Per round' }));

    // Default seeds 3 rounds; add one, then remove one → back to 3.
    expect(screen.getByText('Rounds (3)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Add round' }));
    expect(screen.getByText('Rounds (4)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove round 4' }));
    expect(screen.getByText('Rounds (3)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(nav.goBack).toHaveBeenCalled());
    const [saved] = await sessionsStorage.getAll();
    expect(saved.roundsConfig).toHaveLength(3);
  });

  it('saves a description shown independently of participants', async () => {
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.type(screen.getByPlaceholderText('Heavy Bag Drill'), 'Combos');
    await user.type(
      screen.getByPlaceholderText('e.g. Jab-cross-hook combos, light footwork'),
      'Jab-cross combos',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(nav.goBack).toHaveBeenCalled());
    const [saved] = await sessionsStorage.getAll();
    expect(saved.description).toBe('Jab-cross combos');
    expect(saved.participants).toBeUndefined();
  });

  it('adds named participants, one round per person, replacing round-count controls', async () => {
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.type(screen.getByPlaceholderText('Heavy Bag Drill'), 'Group Circuit');
    await user.click(screen.getByRole('button', { name: '+ Add person' }));
    await user.type(screen.getByLabelText('Name 1 for round 1'), 'Denys');
    expect(screen.getByText("Who's training (1)")).toBeInTheDocument();
    expect(screen.queryByText('Round timing')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Add person' }));
    await user.type(screen.getByLabelText('Name 1 for round 2'), 'Vlad');
    expect(screen.getByText(/Rounds: 2/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(nav.goBack).toHaveBeenCalled());

    const [saved] = await sessionsStorage.getAll();
    expect(saved.rounds).toBe(2);
    expect(saved.roundsConfig).toBeUndefined();
    expect(saved.participants).toEqual([
      { id: expect.any(String), entrants: [{ name: 'Denys' }] },
      { id: expect.any(String), entrants: [{ name: 'Vlad' }] },
    ]);
    // Both names are registered for the roster picker on future workouts.
    expect(await rosterStorage.getAll()).toEqual(['Denys', 'Vlad']);
  });

  it('adds a second name to a round for pair training under one clock', async () => {
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.type(screen.getByPlaceholderText('Heavy Bag Drill'), 'Pairs');
    await user.click(screen.getByRole('button', { name: '+ Add person' }));
    await user.type(screen.getByLabelText('Name 1 for round 1'), 'Denys');
    await user.click(screen.getByRole('button', { name: '+ Add partner' }));
    await user.type(screen.getByLabelText('Name 2 for round 1'), 'Vlad');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(nav.goBack).toHaveBeenCalled());

    const [saved] = await sessionsStorage.getAll();
    expect(saved.rounds).toBe(1);
    expect(saved.participants).toEqual([
      { id: expect.any(String), entrants: [{ name: 'Denys' }, { name: 'Vlad' }] },
    ]);
  });

  it('lets one partner in a pair have their own note, while the other keeps the round default', async () => {
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.type(screen.getByPlaceholderText('Heavy Bag Drill'), 'Pairs with notes');
    await user.click(screen.getByRole('button', { name: '+ Add person' }));
    await user.type(screen.getByLabelText('Name 1 for round 1'), 'Denys');
    await user.click(screen.getByRole('button', { name: '+ Add partner' }));
    await user.type(screen.getByLabelText('Name 2 for round 1'), 'Vlad');

    // A per-partner note field only appears once a round has 2+ people.
    await user.type(screen.getByLabelText('Note for Vlad in round 1'), '1-2');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(nav.goBack).toHaveBeenCalled());

    const [saved] = await sessionsStorage.getAll();
    expect(saved.participants).toEqual([
      {
        id: expect.any(String),
        entrants: [{ name: 'Denys' }, { name: 'Vlad', description: '1-2' }],
      },
    ]);
  });

  it('lets a participant override timing and description, inheriting session defaults otherwise', async () => {
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.type(screen.getByPlaceholderText('Heavy Bag Drill'), 'Overrides');
    await user.click(screen.getByRole('button', { name: '+ Add person' }));
    await user.type(screen.getByLabelText('Name 1 for round 1'), 'Denys');
    await user.click(screen.getByRole('button', { name: 'Customize timing & description' }));
    await user.type(screen.getByLabelText('Description for round 1'), 'Mitts');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(nav.goBack).toHaveBeenCalled());

    const [saved] = await sessionsStorage.getAll();
    // Customizing seeds the current session defaults (180/60) as this round's
    // explicit override, on top of the typed description.
    expect(saved.participants).toEqual([
      {
        id: expect.any(String),
        entrants: [{ name: 'Denys' }],
        workSeconds: 180,
        restSeconds: 60,
        description: 'Mitts',
      },
    ]);
  });

  it('blocks saving when a participant is left without a name', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.type(screen.getByPlaceholderText('Heavy Bag Drill'), 'Incomplete');
    await user.click(screen.getByRole('button', { name: '+ Add person' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(alertSpy).toHaveBeenCalledWith('Every person needs a name');
    expect(nav.goBack).not.toHaveBeenCalled();
  });

  it('edits an existing session (already loaded in the provider)', async () => {
    await sessionsStorage.saveAll([makeSession({ id: 'e1', name: 'Old Name' })]);
    const user = userEvent.setup();
    // Render App so the provider has finished loading before the editor opens.
    const { default: App } = await import('@/app/App');
    render(<App />);

    await waitFor(() => expect(screen.getByText('Old Name')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    const input = screen.getByDisplayValue('Old Name');
    expect(screen.getByRole('heading', { name: 'Edit workout' })).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, 'New Name');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sessionsStorage.getAll()).resolves.toHaveLength(1));
    const [saved] = await sessionsStorage.getAll();
    expect(saved.name).toBe('New Name');
  });
});

describe('SettingsScreen', () => {
  const settingsProps = (nav: ReturnType<typeof fakeNav>): ScreenProps<'Settings'> => ({
    navigation: nav,
    route: { name: 'Settings', params: undefined },
  });

  it('loads stored settings and saves changes', async () => {
    await settingsStorage.save({
      themeMode: 'system',
      defaultSoundId: 'beep',
      keepScreenAwake: false,
      prepSeconds: 5,
    });
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SettingsScreen {...settingsProps(nav)} />);

    // Prep time is now shown on the "Get ready" wheel field as mm:ss.
    await waitFor(() => expect(screen.getByText('00:05')).toBeInTheDocument());

    await user.click(screen.getByRole('checkbox')); // keep screen awake on
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => expect(nav.navigate).toHaveBeenCalledWith('SessionsList'));
    const stored = await settingsStorage.get();
    expect(stored.keepScreenAwake).toBe(true);
    expect(stored.prepSeconds).toBe(5);
  });
});

describe('SessionRunScreen', () => {
  const runProps = (nav: ReturnType<typeof fakeNav>, sessionId: string): ScreenProps<'SessionRun'> => ({
    navigation: nav,
    route: { name: 'SessionRun', params: { sessionId } },
  });

  it('renders a not-found state for a missing session', async () => {
    const nav = fakeNav();
    renderWithProviders(<SessionRunScreen {...runProps(nav, 'missing')} />);
    await waitFor(() => expect(screen.getByText('Session not found')).toBeInTheDocument());
  });

  it('shows who each round is for and its description under the timer', async () => {
    await settingsStorage.save({
      themeMode: 'system',
      defaultSoundId: 'boxing-gong',
      keepScreenAwake: false,
      prepSeconds: 0,
    });
    await sessionsStorage.saveAll([
      makeSession({
        id: 'r6',
        name: 'Named',
        description: 'Default drill',
        rounds: 2,
        participants: [
          { id: 'p1', entrants: [{ name: 'Denys' }] },
          { id: 'p2', entrants: [{ name: 'Vlad' }, { name: 'Piter' }], description: 'Mitts' },
        ],
      }),
    ]);
    const user = userEvent.setup();
    const nav = fakeNav();
    const { container } = renderWithProviders(<SessionRunScreen {...runProps(nav, 'r6')} />);
    const currentLabel = () => container.querySelector('.session-run-round-label')?.textContent;
    const currentDescription = () => container.querySelector('.session-run-round-description')?.textContent;

    await waitFor(() => expect(screen.getByText('Named')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(currentLabel()).toBe('Denys');
    expect(currentDescription()).toBe('Default drill');

    await user.click(screen.getByText('R2'));
    expect(currentLabel()).toBe('Vlad & Piter');
    expect(currentDescription()).toBe('Mitts');
  });

  it('breaks the description down per entrant when a pair round has different instructions', async () => {
    await settingsStorage.save({
      themeMode: 'system',
      defaultSoundId: 'boxing-gong',
      keepScreenAwake: false,
      prepSeconds: 0,
    });
    await sessionsStorage.saveAll([
      makeSession({
        id: 'r7',
        name: 'Split pair',
        rounds: 1,
        participants: [
          {
            id: 'p1',
            description: '1-1-2',
            entrants: [{ name: 'Denys' }, { name: 'Vlad', description: '1-2' }],
          },
        ],
      }),
    ]);
    const user = userEvent.setup();
    const nav = fakeNav();
    const { container } = renderWithProviders(<SessionRunScreen {...runProps(nav, 'r7')} />);

    await waitFor(() => expect(screen.getByText('Split pair')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Start' }));

    const description = container.querySelector('.session-run-round-description');
    expect(description?.textContent).toBe('Denys: 1-1-2Vlad: 1-2');
    expect(screen.getByText('1-1-2')).toBeInTheDocument();
    expect(screen.getByText('1-2')).toBeInTheDocument();
  });

  it('starts, pauses and persists an in-progress run', async () => {
    await sessionsStorage.saveAll([makeSession({ id: 'r1', name: 'Runner' })]);
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionRunScreen {...runProps(nav, 'r1')} />);

    await waitFor(() => expect(screen.getByText('Runner')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    await waitFor(() => expect(runStateStorage.read()).toMatchObject({ sessionId: 'r1' }));

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
  });

  it('skips the current round into the prep countdown', async () => {
    // No prep before start so the first phase is WORK straight away.
    await settingsStorage.save({
      themeMode: 'system',
      defaultSoundId: 'boxing-gong',
      keepScreenAwake: false,
      prepSeconds: 0,
    });
    await sessionsStorage.saveAll([makeSession({ id: 'r3', name: 'Skipper' })]);
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionRunScreen {...runProps(nav, 'r3')} />);

    await waitFor(() => expect(screen.getByText('Skipper')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(screen.getByText('WORK')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Skip round to 3s' }));
    expect(screen.getByText('GET READY')).toBeInTheDocument(); // 3s prep before the rest
  });

  it('Stop resets to the start state and clears the saved run', async () => {
    await sessionsStorage.saveAll([makeSession({ id: 'r4', name: 'Stopper' })]);
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionRunScreen {...runProps(nav, 'r4')} />);

    await waitFor(() => expect(screen.getByText('Stopper')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(runStateStorage.read()).not.toBeNull());

    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    await waitFor(() => expect(runStateStorage.read()).toBeNull());
  });

  it('jumps to a chosen round via the round tiles', async () => {
    await settingsStorage.save({
      themeMode: 'system',
      defaultSoundId: 'boxing-gong',
      keepScreenAwake: false,
      prepSeconds: 0,
    });
    await sessionsStorage.saveAll([makeSession({ id: 'r5', name: 'Jumper', rounds: 3 })]);
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionRunScreen {...runProps(nav, 'r5')} />);

    await waitFor(() => expect(screen.getByText('Jumper')).toBeInTheDocument());
    await user.click(screen.getByText('R3')); // jump straight to round 3
    expect(screen.getByText('Round 3 / 3')).toBeInTheDocument();
  });

  it('clears the persisted run when leaving via Back', async () => {
    await sessionsStorage.saveAll([makeSession({ id: 'r2', name: 'Leaver' })]);
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionRunScreen {...runProps(nav, 'r2')} />);

    await waitFor(() => expect(screen.getByText('Leaver')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(runStateStorage.read()).not.toBeNull());

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(nav.goBack).toHaveBeenCalled();
    expect(runStateStorage.read()).toBeNull();
  });
});
