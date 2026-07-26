import { useEffect, useMemo, useState } from 'react';

import { useSessions } from '@/app/SessionsProvider';
import { IconButton } from '@/components/IconButton';
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@/components/Icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TimeWheelField } from '@/components/TimeWheelField';
import { plainTextInputProps } from '@/consts/forms';
import { soundOptions, useSound } from '@/hooks/useSound';
import { ScreenProps } from '@/navigation/RootNavigator';
import { rosterStorage } from '@/storage/rosterStorage';
import { defaultSettings, settingsStorage } from '@/storage/settingsStorage';
import { useTheme } from '@/theme/ThemeProvider';
import { ThemeMode } from '@/types/models';
import { notify } from '@/utils/dialog';

const themeOptions: { label: string; value: ThemeMode }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

const soundLabel = (label: string) =>
  label
    .replace('Boxing Gong (Default)', 'Boxing')
    .replace('Classic Gong', 'Classic')
    .replace('Gong (Legacy)', 'Gong');

export const SettingsScreen = ({ navigation }: ScreenProps<'Settings'>) => {
  const { mode, setMode } = useTheme();
  const { applySoundToAll } = useSessions();
  const { play } = useSound();
  const [defaultSoundId, setDefaultSoundId] = useState(defaultSettings.defaultSoundId);
  const [keepScreenAwake, setKeepScreenAwake] = useState(defaultSettings.keepScreenAwake);
  const [prepSeconds, setPrepSeconds] = useState(defaultSettings.prepSeconds);
  const [roster, setRoster] = useState<string[]>([]);
  const [newBoxerName, setNewBoxerName] = useState('');

  useEffect(() => {
    let mounted = true;
    void settingsStorage.get().then((settings) => {
      if (mounted) {
        setDefaultSoundId(settings.defaultSoundId);
        setKeepScreenAwake(settings.keepScreenAwake);
        setPrepSeconds(settings.prepSeconds);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void rosterStorage.getAll().then((names) => {
      if (mounted) {
        setRoster(names);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const addBoxer = async () => {
    const trimmed = newBoxerName.trim();
    if (!trimmed) {
      return;
    }
    setRoster(await rosterStorage.add(trimmed));
    setNewBoxerName('');
  };

  const removeBoxer = async (nameToRemove: string) => {
    setRoster(await rosterStorage.remove(nameToRemove));
  };

  const save = async () => {
    if (prepSeconds < 0) {
      notify('Prep countdown must be 0 or more');
      return;
    }

    await settingsStorage.save({
      themeMode: mode,
      defaultSoundId,
      keepScreenAwake,
      prepSeconds,
    });
    await applySoundToAll(defaultSoundId);
    navigation.navigate('SessionsList');
  };

  const soundSegmentOptions = useMemo(
    () => soundOptions.map((option) => ({ label: soundLabel(option.label), value: option.id })),
    [],
  );

  return (
    <main className="app-shell settings-screen screen-enter">
      <header className="screen-topbar">
        <IconButton
          ariaLabel="Back"
          icon={<ArrowLeftIcon />}
          onPress={() => navigation.goBack()}
        />
        <div className="screen-topbar__title">
          <h1>Settings</h1>
          <p>Defaults for every workout</p>
        </div>
        <div style={{ width: 44 }} aria-hidden="true" />
      </header>

      <div className="scroll-area settings-content">
        <section className="surface-section">
          <div>
            <h2 className="section-heading">Appearance</h2>
            <p className="section-description">
              Follow the device or choose a theme for the gym.
            </p>
          </div>
          <SegmentedControl
            value={mode}
            onChange={(next) => void setMode(next)}
            options={themeOptions}
            maxPerRow={3}
          />
        </section>

        <section className="surface-section">
          <div>
            <h2 className="section-heading">Default bell</h2>
            <p className="section-description">
              Tap a sound to preview it. Saving applies it to all programs.
            </p>
          </div>
          <SegmentedControl
            value={defaultSoundId}
            onChange={(next) => {
              setDefaultSoundId(next);
              void play(next, { vibrate: false });
            }}
            options={soundSegmentOptions}
            maxPerRow={3}
          />
        </section>

        <section className="surface-section">
          <div>
            <h2 className="section-heading">Boxers</h2>
            <p className="section-description">
              Save athletes once, then assign them to rounds in group and pair training.
            </p>
          </div>

          <div className="roster-add">
            <input
              {...plainTextInputProps}
              className="text-field"
              type="text"
              enterKeyHint="done"
              aria-label="New boxer name"
              value={newBoxerName}
              onChange={(event) => setNewBoxerName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void addBoxer();
                }
              }}
              placeholder="Add a boxer"
            />
            <PrimaryButton
              label="Add"
              icon={<PlusIcon />}
              onPress={() => void addBoxer()}
            />
          </div>

          {roster.length > 0 ? (
            <div className="roster-list">
              {roster.map((boxerName) => (
                <div key={boxerName} className="roster-row">
                  <span className="roster-row__name">{boxerName}</span>
                  <IconButton
                    ariaLabel={`Remove ${boxerName}`}
                    icon={<TrashIcon />}
                    onPress={() => void removeBoxer(boxerName)}
                    variant="ghost"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="roster-empty">No boxers saved yet.</div>
          )}
        </section>

        <section className="surface-section">
          <div>
            <h2 className="section-heading">Get ready countdown</h2>
            <p className="section-description">
              Time to put your gloves on before the first round begins.
            </p>
          </div>
          <div style={{ display: 'flex', maxWidth: 210 }}>
            <TimeWheelField
              label="GET READY"
              valueSeconds={prepSeconds}
              onChange={setPrepSeconds}
              minSeconds={0}
              maxMinutes={10}
            />
          </div>
        </section>

        <section className="surface-section">
          <label className="toggle-row">
            <div className="toggle-row__copy">
              <h2 className="section-heading">Keep screen awake</h2>
              <p className="section-description">
                Prevent the display from sleeping while a workout is active.
              </p>
            </div>
            <span className="toggle">
              <input
                type="checkbox"
                checked={keepScreenAwake}
                onChange={(event) => setKeepScreenAwake(event.target.checked)}
              />
              <span className="toggle__track" aria-hidden="true" />
              <span className="toggle__thumb" aria-hidden="true" />
            </span>
          </label>
        </section>

        <div className="settings-save">
          <PrimaryButton
            label="Save settings"
            onPress={save}
            size="lg"
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </main>
  );
};
