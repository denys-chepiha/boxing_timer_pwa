// Core
import { render, screen, waitFor, within } from '@testing-library/react';
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
// Utils
import { resolveRounds } from '@/utils/rounds';

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

  it('defaults to Same for all and opens the training type sheet from the Type button', async () => {
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    expect(screen.getByRole('button', { name: 'Type' })).toHaveTextContent('Same for all');
    expect(screen.getByText('Rounds')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Type' }));
    const dialog = screen.getByRole('dialog', { name: 'Training type' });
    expect(dialog.parentElement).toBe(document.body);
    expect(within(dialog).getByRole('button', { name: 'Same for all' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(dialog).getByRole('button', { name: 'Per round' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Group Training' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Pair Training' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Per round' }));

    expect(screen.getByRole('button', { name: 'Type' })).toHaveTextContent('Per round');
    expect(screen.getByText('Rounds (3)')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Training type' })).not.toBeInTheDocument(),
    );
  });

  it('closes the training type sheet without changing the mode when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('dialog', { name: 'Training type' }));

    expect(screen.getByRole('button', { name: 'Type' })).toHaveTextContent('Same for all');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Training type' })).not.toBeInTheDocument(),
    );
  });

  it('supports per-round timing with add / remove', async () => {
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.type(screen.getByPlaceholderText('Heavy Bag Drill'), 'Intervals');
    await user.click(screen.getByRole('button', { name: 'Type' }));
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

  it('drops the rest control from only the last round in Per round mode', async () => {
    const user = userEvent.setup();
    const nav = fakeNav();
    const { container } = renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('button', { name: 'Per round' }));

    const rounds = Array.from(container.querySelectorAll<HTMLElement>('.round-config'));
    expect(rounds).toHaveLength(3);
    expect(within(rounds[0]).getByText('REST')).toBeInTheDocument();
    expect(within(rounds[1]).getByText('REST')).toBeInTheDocument();
    expect(within(rounds[2]).queryByText('REST')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Add round' }));

    const roundsAfterAdd = Array.from(container.querySelectorAll<HTMLElement>('.round-config'));
    // The old last round gets its REST control back; only the new one hides it.
    expect(within(roundsAfterAdd[2]).getByText('REST')).toBeInTheDocument();
    expect(within(roundsAfterAdd[3]).queryByText('REST')).not.toBeInTheDocument();
  });

  it('always saves zero rest for the final round in Per round mode, even for legacy data', async () => {
    await sessionsStorage.saveAll([
      makeSession({
        id: 'legacy-rest',
        name: 'Legacy',
        roundsConfig: [
          { workSeconds: 60, restSeconds: 30 },
          { workSeconds: 60, restSeconds: 45 }, // stale trailing rest saved before this change
        ],
      }),
    ]);
    const user = userEvent.setup();
    const { default: App } = await import('@/app/App');
    render(<App />);

    await waitFor(() => expect(screen.getByText('Legacy')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    await waitFor(() => expect(screen.getByDisplayValue('Legacy')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sessionsStorage.getAll()).resolves.toHaveLength(1));
    const [saved] = await sessionsStorage.getAll();
    expect(saved.roundsConfig?.[1].restSeconds).toBe(0);
  });

  it('gives each round its own description in Per round mode, copied forward when adding a round', async () => {
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.type(screen.getByPlaceholderText('Heavy Bag Drill'), 'Combos by round');
    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('button', { name: 'Per round' }));

    // The shared Description section is gone — each round owns its own field instead.
    expect(
      screen.queryByText('Shown under the timer while this workout runs.'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Description for round 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Description for round 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Description for round 3')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Description for round 3'), 'Jab-cross combos');
    await user.click(screen.getByRole('button', { name: '+ Add round' }));

    // A newly added round starts from the previous (last) round's description.
    expect(screen.getByLabelText('Description for round 4')).toHaveValue('Jab-cross combos');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(nav.goBack).toHaveBeenCalled());

    const [saved] = await sessionsStorage.getAll();
    expect(saved.description).toBeUndefined();
    expect(saved.roundsConfig?.map((round) => round.description)).toEqual([
      undefined,
      undefined,
      'Jab-cross combos',
      'Jab-cross combos',
    ]);
  });

  it("copies a round's description to the clipboard", async () => {
    const user = userEvent.setup();
    // userEvent.setup() installs its own clipboard stub, replacing the plain
    // mock from beforeEach — spy on whatever it left behind.
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('button', { name: 'Per round' }));

    expect(screen.getByRole('button', { name: 'Copy round 2 description' })).toBeDisabled();

    await user.type(screen.getByLabelText('Description for round 2'), 'Footwork drill');
    await user.click(screen.getByRole('button', { name: 'Copy round 2 description' }));

    expect(writeTextSpy).toHaveBeenCalledWith('Footwork drill');
  });

  it('keeps standard workout details inline under the persistent editor header', () => {
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    expect(
      screen.getByPlaceholderText('e.g. Jab-cross-hook combos, light footwork'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'New workout' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.queryByText(/Who's training/)).not.toBeInTheDocument();
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

  // Names are picked from the saved roster (managed in Settings), not typed.
  const pickName = async (user: ReturnType<typeof userEvent.setup>, fieldLabel: string, name: string) => {
    await user.click(screen.getByLabelText(fieldLabel));
    await user.click(screen.getByRole('option', { name }));
  };

  it('keeps Group Training inside the editor container under the same header', async () => {
    await rosterStorage.addMany(['Denys', 'Vlad']);
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.type(screen.getByPlaceholderText('Heavy Bag Drill'), 'Group Circuit');
    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('button', { name: 'Group Training' }));

    // Entering the mode swaps only the configuration below the editor header.
    expect(screen.queryByText(/Who's training/)).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Round 1 timing' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /REST/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'New workout' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Type' })).toHaveTextContent('Group Training');
    await user.type(
      screen.getByLabelText('Workout instructions for round 1'),
      'Heavy bag combinations',
    );
    await pickName(user, 'Name 1 for round 1', 'Denys');

    await user.click(screen.getByRole('button', { name: '+ Add round' }));
    await pickName(user, 'Name 1 for round 2', 'Vlad');
    expect(screen.getByLabelText('Workout instructions for round 2')).toHaveValue(
      'Heavy bag combinations',
    );
    expect(screen.getByRole('group', { name: 'Round 1 timing' })).toHaveTextContent(
      'REST',
    );
    expect(screen.getByRole('group', { name: 'Round 2 timing' })).not.toHaveTextContent(
      'REST',
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(nav.goBack).toHaveBeenCalled());

    const [saved] = await sessionsStorage.getAll();
    expect(saved.rounds).toBe(2);
    expect(saved.roundsConfig).toBeUndefined();
    expect(saved.participants).toEqual([
      expect.objectContaining({
        id: expect.any(String),
        entrants: [{ name: 'Denys' }],
        workSeconds: 180,
        restSeconds: 60,
        description: 'Heavy bag combinations',
      }),
      expect.objectContaining({
        id: expect.any(String),
        entrants: [{ name: 'Vlad' }],
        workSeconds: 180,
        restSeconds: 60,
        description: 'Heavy bag combinations',
      }),
    ]);
    expect(saved.trainingMode).toBe('group');
  });

  it('copies the partner into the next round and still allows changing that round', async () => {
    await rosterStorage.addMany(['Denys', 'Vlad']);
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('button', { name: 'Group Training' }));
    await user.type(
      screen.getByLabelText('Workout instructions for round 1'),
      'Partner drills',
    );
    await pickName(user, 'Name 1 for round 1', 'Denys');
    await user.click(screen.getByRole('button', { name: '+ Add round' }));

    await user.click(screen.getByLabelText('Name 1 for round 2'));
    expect(screen.getByRole('option', { name: 'Vlad' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Denys' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.click(screen.getByRole('option', { name: 'Vlad' }));
    expect(screen.getByLabelText('Name 1 for round 2')).toHaveTextContent('Vlad');
    expect(screen.getByLabelText('Name 1 for round 1')).toHaveTextContent('Denys');
  });

  it('adds a second partner to the sequential group round', async () => {
    await rosterStorage.addMany(['Denys', 'Vlad']);
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.type(screen.getByPlaceholderText('Heavy Bag Drill'), 'Group Pair');
    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('button', { name: 'Group Training' }));
    await user.type(
      screen.getByLabelText('Workout instructions for round 1'),
      'Partner drills',
    );
    await pickName(user, 'Name 1 for round 1', 'Denys');
    await user.click(screen.getByRole('button', { name: '+ Add partner' }));
    await pickName(user, 'Name 2 for round 1', 'Vlad');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(nav.goBack).toHaveBeenCalled());

    const [saved] = await sessionsStorage.getAll();
    expect(saved.rounds).toBe(1);
    expect(saved.participants).toEqual([
      expect.objectContaining({
        id: expect.any(String),
        entrants: [
          { name: 'Denys' },
          { name: 'Vlad' },
        ],
        workSeconds: 180,
        restSeconds: 60,
        description: 'Partner drills',
      }),
    ]);
  });

  it('picking Pair Training seeds a round with two name slots for pair training under one clock', async () => {
    await rosterStorage.addMany(['Denys', 'Vlad']);
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.type(screen.getByPlaceholderText('Heavy Bag Drill'), 'Pairs');
    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('button', { name: 'Pair Training' }));

    // Both slots are ready immediately — a pair never needs "+ Add partner".
    await pickName(user, 'Name 1 for round 1', 'Denys');
    await pickName(user, 'Name 2 for round 1', 'Vlad');
    expect(screen.queryByRole('button', { name: '+ Add partner' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(nav.goBack).toHaveBeenCalled());

    const [saved] = await sessionsStorage.getAll();
    expect(saved.rounds).toBe(1);
    expect(saved.participants).toEqual([
      expect.objectContaining({
        id: expect.any(String),
        entrants: [{ name: 'Denys' }, { name: 'Vlad' }],
        workSeconds: 180,
        restSeconds: 60,
      }),
    ]);
  });

  it('tops up a round left with one person when switching from Group to Pair Training', async () => {
    await rosterStorage.addMany(['Denys', 'Vlad']);
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.type(screen.getByPlaceholderText('Heavy Bag Drill'), 'Switch modes');
    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('button', { name: 'Group Training' }));
    await user.type(
      screen.getByLabelText('Workout instructions for round 1'),
      'Round default',
    );
    await pickName(user, 'Name 1 for round 1', 'Denys');
    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('button', { name: 'Pair Training' }));

    // The round carried over from Group Training now has a second, empty slot.
    expect(screen.getByLabelText('Name 1 for round 1')).toHaveTextContent('Denys');
    expect(screen.getByLabelText('Name 2 for round 1')).toBeInTheDocument();
    await pickName(user, 'Name 2 for round 1', 'Vlad');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(nav.goBack).toHaveBeenCalled());

    const [saved] = await sessionsStorage.getAll();
    expect(saved.participants).toEqual([
      expect.objectContaining({
        id: expect.any(String),
        entrants: [{ name: 'Denys' }, { name: 'Vlad' }],
        workSeconds: 180,
        restSeconds: 60,
      }),
    ]);
  });

  it('lets one partner in a pair have their own note, while the other keeps the round default', async () => {
    await rosterStorage.addMany(['Denys', 'Vlad']);
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.type(screen.getByPlaceholderText('Heavy Bag Drill'), 'Pairs with notes');
    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('button', { name: 'Pair Training' }));
    await pickName(user, 'Name 1 for round 1', 'Denys');
    await pickName(user, 'Name 2 for round 1', 'Vlad');

    await user.click(
      screen.getByRole('button', { name: 'Configure Vlad in round 1' }),
    );
    const partnerDialog = screen.getByRole('dialog', {
      name: 'Partner configuration',
    });
    await user.type(
      within(partnerDialog).getByLabelText('Workout instructions'),
      '1-2',
    );
    await user.click(within(partnerDialog).getByRole('button', { name: 'Done' }));

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(nav.goBack).toHaveBeenCalled());

    const [saved] = await sessionsStorage.getAll();
    expect(saved.participants).toEqual([
      expect.objectContaining({
        id: expect.any(String),
        entrants: [{ name: 'Denys' }, { name: 'Vlad', description: '1-2' }],
        workSeconds: 180,
        restSeconds: 60,
      }),
    ]);
  });

  it('opens partner timing and instructions in an animated bottom sheet', async () => {
    await rosterStorage.add('Denys');
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.type(screen.getByPlaceholderText('Heavy Bag Drill'), 'Overrides');
    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('button', { name: 'Group Training' }));
    await user.type(
      screen.getByLabelText('Workout instructions for round 1'),
      'Round default',
    );
    await pickName(user, 'Name 1 for round 1', 'Denys');
    expect(screen.queryByText('Customize timing & description')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Same as round instruction')).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Configure Denys in round 1' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Partner configuration' });
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog.querySelector('.partner-config-sheet')).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: /REST TIME/ }),
    ).not.toBeInTheDocument();
    await user.click(
      within(dialog).getByRole('button', { name: /WORK TIME/ }),
    );
    await user.click(screen.getByRole('button', { name: '2 minutes' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await user.type(
      within(dialog).getByLabelText('Workout instructions'),
      'Mitts',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(nav.goBack).toHaveBeenCalled());

    const [saved] = await sessionsStorage.getAll();
    expect(saved.participants).toEqual([
      {
        id: expect.any(String),
        entrants: [{ name: 'Denys', workSeconds: 120, description: 'Mitts' }],
        workSeconds: 180,
        restSeconds: 60,
        description: 'Round default',
      },
    ]);
    expect(saved.description).toBeUndefined();
  });

  it('lets a group partner override the round rest before the final round', async () => {
    await rosterStorage.add('Denys');
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.type(screen.getByPlaceholderText('Heavy Bag Drill'), 'Rest overrides');
    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('button', { name: 'Group Training' }));
    await user.type(
      screen.getByLabelText('Workout instructions for round 1'),
      'Bag work',
    );
    await pickName(user, 'Name 1 for round 1', 'Denys');
    await user.click(screen.getByRole('button', { name: '+ Add round' }));

    await user.click(
      screen.getByRole('button', { name: 'Configure Denys in round 1' }),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'Partner configuration',
    });
    await user.click(
      within(dialog).getByRole('button', { name: /REST TIME/ }),
    );
    await user.click(screen.getByRole('button', { name: '0 minutes' }));
    await user.click(screen.getByRole('button', { name: '15 seconds' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(nav.goBack).toHaveBeenCalled());

    const [saved] = await sessionsStorage.getAll();
    expect(saved.participants?.[0].entrants[0]).toEqual({
      name: 'Denys',
      restSeconds: 15,
    });
    expect(
      resolveRounds(saved).map((round) => round.restSeconds),
    ).toEqual([15, 0]);
  });

  it('copies the previous round configuration when adding a round', async () => {
    await rosterStorage.add('Denys');
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('button', { name: 'Group Training' }));
    await user.type(
      screen.getByLabelText('Workout instructions for round 1'),
      'Mitts and combinations',
    );
    await pickName(user, 'Name 1 for round 1', 'Denys');

    const firstRoundTiming = screen.getByRole('group', {
      name: 'Round 1 timing',
    });
    await user.click(
      within(firstRoundTiming).getByRole('button', { name: /WORK/ }),
    );
    await user.click(screen.getByRole('button', { name: '2 minutes' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    await user.click(screen.getByRole('button', { name: '+ Add round' }));

    expect(screen.getByLabelText('Name 1 for round 2')).toHaveTextContent('Denys');
    expect(screen.getByLabelText('Workout instructions for round 2')).toHaveValue(
      'Mitts and combinations',
    );
    expect(
      within(screen.getByRole('group', { name: 'Round 2 timing' })).getByRole(
        'button',
        { name: /WORK/ },
      ),
    ).toHaveTextContent('02:00');

    await user.click(screen.getByRole('button', { name: '+ Add round' }));

    expect(screen.getByLabelText('Workout instructions for round 3')).toHaveValue(
      'Mitts and combinations',
    );
    expect(
      within(screen.getByRole('group', { name: 'Round 2 timing' })).getByRole(
        'button',
        { name: /REST/ },
      ),
    ).toHaveTextContent('01:00');
    expect(
      screen.getByRole('group', { name: 'Round 3 timing' }),
    ).not.toHaveTextContent('REST');
  });

  it('offers a shortcut to Settings from the picker when the roster has no options left', async () => {
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('button', { name: 'Group Training' }));
    await user.click(screen.getByLabelText('Name 1 for round 1'));
    await user.click(screen.getByRole('button', { name: 'Manage in Settings' }));

    expect(nav.navigate).toHaveBeenCalledWith('Settings');
  });

  it('blocks saving when a participant is left without a name', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.type(screen.getByPlaceholderText('Heavy Bag Drill'), 'Incomplete');
    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('button', { name: 'Group Training' }));
    await user.type(
      screen.getByLabelText('Workout instructions for round 1'),
      'Required round setup',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(alertSpy).toHaveBeenCalledWith('Every person needs a name');
    expect(nav.goBack).not.toHaveBeenCalled();
  });

  it('blocks saving Group Training without round instructions', async () => {
    await rosterStorage.add('Denys');
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.type(screen.getByPlaceholderText('Heavy Bag Drill'), 'Missing instructions');
    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('button', { name: 'Group Training' }));
    await pickName(user, 'Name 1 for round 1', 'Denys');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(alertSpy).toHaveBeenCalledWith(
      'Add workout instructions to every group round',
    );
    expect(nav.goBack).not.toHaveBeenCalled();
  });

  it('blocks saving a training session with every round removed', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    await user.type(screen.getByPlaceholderText('Heavy Bag Drill'), 'Empty');
    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('button', { name: 'Group Training' }));
    await user.click(screen.getByRole('button', { name: 'Remove round 1' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(alertSpy).toHaveBeenCalledWith('Add at least one round');
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

  it('resumes an existing group session inline under the editor header', async () => {
    await sessionsStorage.saveAll([
      makeSession({
        id: 'g1',
        name: 'Group session',
        rounds: 2,
        participants: [
          {
            id: 'p1',
            description: 'Bag work',
            entrants: [{ name: 'Denys' }],
          },
          {
            id: 'p2',
            description: 'Mitts',
            entrants: [{ name: 'Vlad' }, { name: 'Piter' }],
          },
        ],
      }),
    ]);
    const user = userEvent.setup();
    const { default: App } = await import('@/app/App');
    render(<App />);

    await waitFor(() => expect(screen.getByText('Group session')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    // Mode is inferred from the saved participants and the list remains in the
    // same editor container rather than replacing the whole screen.
    await waitFor(() => expect(screen.getByDisplayValue('Group session')).toBeInTheDocument());
    expect(screen.queryByText(/Who's training/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Workout instructions for round 1')).toHaveValue(
      'Bag work',
    );
    expect(screen.getByLabelText('Workout instructions for round 2')).toHaveValue(
      'Mitts',
    );
    expect(screen.getByRole('heading', { name: 'Edit workout' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
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

  it('shows an empty state, then adds and removes a boxer from the roster', async () => {
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SettingsScreen {...settingsProps(nav)} />);

    expect(screen.getByText('No boxers saved yet.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('New boxer name'), 'Denys');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('Denys')).toBeInTheDocument();
    expect(await rosterStorage.getAll()).toEqual(['Denys']);
    // The input clears, ready for the next name.
    expect(screen.getByLabelText('New boxer name')).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Remove Denys' }));
    expect(screen.queryByText('Denys')).not.toBeInTheDocument();
    expect(await rosterStorage.getAll()).toEqual([]);
  });

  it('loads the existing roster and ignores adding a blank name', async () => {
    await rosterStorage.addMany(['Denys', 'Vlad']);
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SettingsScreen {...settingsProps(nav)} />);

    await waitFor(() => expect(screen.getByText('Denys')).toBeInTheDocument());
    expect(screen.getByText('Vlad')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await rosterStorage.getAll()).toEqual(['Denys', 'Vlad']);
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
        trainingMode: 'group',
        participants: [
          {
            id: 'p1',
            entrants: [
              { name: 'Denys', workSeconds: 90, description: 'Default drill' },
            ],
          },
          {
            id: 'p2',
            entrants: [
              { name: 'Vlad', workSeconds: 120, description: 'Mitts' },
              { name: 'Piter', workSeconds: 75, description: 'Footwork' },
            ],
          },
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

    await user.click(screen.getByText('R2 · P1'));
    expect(currentLabel()).toBe('Vlad');
    expect(currentDescription()).toBe('Mitts');

    await user.click(screen.getByText('R2 · P2'));
    expect(currentLabel()).toBe('Piter');
    expect(currentDescription()).toBe('Footwork');
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
