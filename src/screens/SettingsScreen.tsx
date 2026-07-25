// Core
import { useEffect, useMemo, useState } from 'react';

// App
import { useSessions } from '@/app/SessionsProvider';

// Components
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TimeWheelField } from '@/components/TimeWheelField';

// Hooks
import { soundOptions, useSound } from '@/hooks/useSound';

// Navigation
import { ScreenProps } from '@/navigation/RootNavigator';

// Storage
import { rosterStorage } from '@/storage/rosterStorage';
import { defaultSettings, settingsStorage } from '@/storage/settingsStorage';

// Theme
import { useTheme } from '@/theme/ThemeProvider';

// Types
import { ThemeMode } from '@/types/models';

// Utils
import { notify } from '@/utils/dialog';
// Consts
import { plainTextInputProps } from '@/consts/forms';

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
  const { theme, mode, setMode } = useTheme();
  const { applySoundToAll } = useSessions();
  const { play } = useSound();
  const [defaultSoundId, setDefaultSoundId] = useState(defaultSettings.defaultSoundId);
  const [keepScreenAwake, setKeepScreenAwake] = useState(defaultSettings.keepScreenAwake);
  const [prepSeconds, setPrepSeconds] = useState(defaultSettings.prepSeconds);
  const [roster, setRoster] = useState<string[]>([]);
  const [newBoxerName, setNewBoxerName] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const settings = await settingsStorage.get();
      if (!mounted) {
        return;
      }
      setDefaultSoundId(settings.defaultSoundId);
      setKeepScreenAwake(settings.keepScreenAwake);
      setPrepSeconds(settings.prepSeconds);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadRoster = async () => {
      const names = await rosterStorage.getAll();
      if (mounted) {
        setRoster(names);
      }
    };

    void loadRoster();

    return () => {
      mounted = false;
    };
  }, []);

  const addBoxer = async () => {
    const trimmed = newBoxerName.trim();
    if (!trimmed) {
      return;
    }
    const next = await rosterStorage.add(trimmed);
    setRoster(next);
    setNewBoxerName('');
  };

  const removeBoxer = async (nameToRemove: string) => {
    const next = await rosterStorage.remove(nameToRemove);
    setRoster(next);
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

  const labelStyle = {
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
    color: theme.colors.textMuted,
  };

  const sectionStyle = {
    borderWidth: 1,
    borderStyle: 'solid' as const,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 16,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    boxShadow: theme.isDark ? 'none' : '0 12px 28px rgba(17, 24, 39, 0.06)',
  };

  return (
    <div
      className="app-shell scroll-area"
      style={{
        backgroundColor: theme.colors.background,
        padding: '42px 14px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
          borderRadius: 8,
          padding: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <PrimaryButton label="Back" variant="secondary" size="sm" onPress={() => navigation.goBack()} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.1, color: theme.colors.textMuted }}>
            APP
          </div>
          <h1 style={{ margin: '2px 0 0', fontSize: 24, fontWeight: 950, color: theme.colors.text }}>
            Settings
          </h1>
        </div>
      </div>

      <div style={sectionStyle}>
        <span style={labelStyle}>Theme</span>
        <SegmentedControl value={mode} onChange={(next) => void setMode(next)} options={themeOptions} maxPerRow={3} />
      </div>

      <div style={sectionStyle}>
        <span style={labelStyle}>Default Sound</span>
        <SegmentedControl
          value={defaultSoundId}
          onChange={(next) => {
            setDefaultSoundId(next);
            void play(next, { vibrate: false });
          }}
          options={soundSegmentOptions}
          maxPerRow={3}
        />
      </div>

      <div style={sectionStyle}>
        <div>
          <span style={labelStyle}>Boxers</span>
          <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: theme.colors.textMuted }}>
            Saved athletes you can pick from when naming rounds in a workout.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            {...plainTextInputProps}
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
            style={{
              flex: 1,
              height: 48,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.input,
              borderRadius: 8,
              padding: '0 14px',
              fontSize: 15,
              fontWeight: 800,
              color: theme.colors.text,
            }}
          />
          <PrimaryButton label="Add" onPress={() => void addBoxer()} />
        </div>

        {roster.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {roster.map((boxerName) => (
              <div
                key={boxerName}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                  borderRadius: 8,
                  padding: '10px 12px',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 800, color: theme.colors.text }}>{boxerName}</span>
                <button
                  type="button"
                  onClick={() => void removeBoxer(boxerName)}
                  aria-label={`Remove ${boxerName}`}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    border: 'none',
                    background: 'transparent',
                    color: theme.colors.textMuted,
                    fontSize: 16,
                    fontWeight: 900,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '8px 0',
              fontSize: 14,
              fontWeight: 700,
              color: theme.colors.textMuted,
            }}
          >
            No boxers saved yet.
          </div>
        )}
      </div>

      <div style={sectionStyle}>
        <div>
          <span style={labelStyle}>Get ready (before round 1)</span>
          <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: theme.colors.textMuted }}>
            Countdown to put your gloves on before the first round starts.
          </div>
        </div>
        <div style={{ display: 'flex' }}>
          <TimeWheelField
            label="GET READY"
            valueSeconds={prepSeconds}
            onChange={setPrepSeconds}
            minSeconds={0}
            maxMinutes={10}
          />
        </div>
      </div>

      <label
        style={{
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
          borderRadius: 8,
          padding: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 14,
          cursor: 'pointer',
          boxShadow: theme.isDark ? 'none' : '0 12px 28px rgba(17, 24, 39, 0.06)',
        }}
      >
        <div>
          <div style={{ color: theme.colors.text, fontWeight: 900 }}>Keep screen awake</div>
          <div style={{ marginTop: 3, color: theme.colors.textMuted, fontSize: 13, fontWeight: 700 }}>
            Prevent the display from sleeping during a session.
          </div>
        </div>
        <input
          type="checkbox"
          checked={keepScreenAwake}
          onChange={(event) => setKeepScreenAwake(event.target.checked)}
          style={{ width: 24, height: 24, flex: '0 0 auto', accentColor: theme.colors.primary }}
        />
      </label>

      <PrimaryButton label="Save settings" onPress={save} size="lg" />
    </div>
  );
};
