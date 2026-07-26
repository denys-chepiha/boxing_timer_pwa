import { useMemo, useState } from 'react';

import { useSessions } from '@/app/SessionsProvider';
import { IconButton } from '@/components/IconButton';
import { PlusIcon, SearchIcon, SettingsIcon, TimerIcon } from '@/components/Icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SessionCard } from '@/components/SessionCard';
import { plainTextInputProps } from '@/consts/forms';
import { ScreenProps } from '@/navigation/RootNavigator';
import { SessionCategory } from '@/types/models';
import { confirmAction } from '@/utils/dialog';

type FilterValue = 'all' | SessionCategory;

const filters: { label: string; value: FilterValue }[] = [
  { label: 'All', value: 'all' },
  { label: 'Boxing', value: 'boxing' },
  { label: 'Running', value: 'running' },
  { label: 'Custom', value: 'custom' },
];

export const SessionsListScreen = ({ navigation }: ScreenProps<'SessionsList'>) => {
  const { sessions, isLoading, deleteSession } = useSessions();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterValue>('all');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return sessions.filter((session) => {
      if (activeFilter !== 'all' && session.category !== activeFilter) {
        return false;
      }
      return !query || session.name.toLowerCase().includes(query);
    });
  }, [activeFilter, search, sessions]);

  const createProgram = () =>
    navigation.navigate(
      'SessionEditor',
      activeFilter === 'all' ? undefined : { category: activeFilter },
    );

  return (
    <main className="app-shell sessions-screen screen-enter">
      <header className="sessions-hero">
        <div className="sessions-brand">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true" />
            <div>
              <div className="brand-name">Box Timer</div>
              <div className="brand-caption">Train on the bell</div>
            </div>
          </div>
          <IconButton
            ariaLabel="Settings"
            icon={<SettingsIcon />}
            onPress={() => navigation.navigate('Settings')}
          />
        </div>

        <div className="sessions-hero__copy">
          <h1>Programs</h1>
          <p>Pick a workout, hear the bell, and keep your focus in the round.</p>
          {!isLoading && sessions.length > 0 ? (
            <div className="session-count">
              {sessions.length} saved {sessions.length === 1 ? 'program' : 'programs'}
            </div>
          ) : null}
        </div>
      </header>

      <section className="sessions-tools" aria-label="Find a program">
        <div className="search-field">
          <SearchIcon className="icon search-field__icon" />
          <input
            {...plainTextInputProps}
            className="text-field"
            type="search"
            enterKeyHint="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search saved workouts..."
            aria-label="Search saved workouts"
          />
        </div>

        <div className="filter-row" role="group" aria-label="Program category">
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className="filter-chip"
              aria-pressed={activeFilter === filter.value}
              onClick={() => setActiveFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <section className="sessions-list scroll-area" aria-live="polite">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__visual" aria-hidden="true">
              <TimerIcon />
            </div>
            <h2>{isLoading ? 'Loading programs' : 'No programs found'}</h2>
            <p>
              {search || activeFilter !== 'all'
                ? 'Try another search or choose a different category.'
                : 'Build your first interval workout and it will stay ready for the next session.'}
            </p>
            {!isLoading && !search ? (
              <PrimaryButton
                label="Create program"
                icon={<PlusIcon />}
                onPress={createProgram}
              />
            ) : null}
          </div>
        ) : (
          filtered.map((item) => (
            <SessionCard
              key={item.id}
              session={item}
              onPress={() => navigation.navigate('SessionRun', { sessionId: item.id })}
              onEdit={() => navigation.navigate('SessionEditor', { sessionId: item.id })}
              onDelete={() => {
                if (confirmAction(`Delete "${item.name}"?`)) {
                  void deleteSession(item.id);
                }
              }}
            />
          ))
        )}
      </section>

      {filtered.length > 0 ? (
        <button
          type="button"
          className="floating-create"
          onClick={createProgram}
          aria-label="Add session"
        >
          <PlusIcon />
          New workout
        </button>
      ) : null}
    </main>
  );
};
