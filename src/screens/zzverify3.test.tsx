// Core
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
// Navigation
import { ScreenProps } from '@/navigation/RootNavigator';
// Screens
import { SessionEditorScreen } from '@/screens/SessionEditorScreen';
// Test
import { renderWithProviders } from '@/test/utils';

const fakeNav = () => ({ navigate: () => {}, goBack: () => {} });
const editorProps = (nav: ReturnType<typeof fakeNav>): ScreenProps<'SessionEditor'> => ({
  navigation: nav,
  route: { name: 'SessionEditor', params: undefined },
});

describe('changing from Group to Pair Training', () => {
  it('tops up a freshly seeded group round with the second partner slot', async () => {
    const user = userEvent.setup();
    const nav = fakeNav();
    renderWithProviders(<SessionEditorScreen {...editorProps(nav)} />);

    // Default entry point most users would take: pick Group Training first.
    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('button', { name: 'Group Training' }));
    expect(screen.getByLabelText('Name 1 for round 1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Name 2 for round 1')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Add partner' })).toBeInTheDocument();

    // Change their mind before naming anyone: the inline editor stays mounted.
    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('button', { name: 'Pair Training' }));

    expect(screen.getByLabelText('Name 1 for round 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Name 2 for round 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add partner' })).not.toBeInTheDocument();
  });
});
