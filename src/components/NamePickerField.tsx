// Core
import { memo, useState } from 'react';

// Components
import { PrimaryButton } from '@/components/PrimaryButton';

// Theme
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  value: string;
  /** Names available to pick — already filtered by the caller (e.g. excluding names used elsewhere in this session). */
  options: string[];
  onSelect: (name: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** Shown when there are no options left to pick from. */
  onManageRoster?: () => void;
};

/**
 * Picks a boxer from the saved roster — a select, not a free-text field.
 * Athletes are added once in Settings; here you only choose who's training.
 */
const NamePickerFieldComponent = ({
  value,
  options,
  onSelect,
  placeholder = 'Select name',
  ariaLabel,
  onManageRoster,
}: Props) => {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
        style={{
          flex: 1,
          minWidth: 0,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.input,
          borderRadius: 8,
          padding: '0 14px',
        }}
      >
        <span
          style={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 15,
            fontWeight: 800,
            color: value ? theme.colors.text : theme.colors.textSubtle,
          }}
        >
          {value || placeholder}
        </span>
        <span style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: 900 }}>▼</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: theme.colors.overlay,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            padding: '18px 16px max(18px, env(safe-area-inset-bottom))',
            zIndex: 50,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: '70vh',
              overflowY: 'auto',
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.card,
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              boxShadow: theme.isDark
                ? '0 22px 60px rgba(0, 0, 0, 0.42)'
                : '0 22px 60px rgba(11, 22, 48, 0.18)',
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 900,
                color: theme.colors.text,
                padding: '4px 8px 8px',
              }}
            >
              Select a boxer
            </span>

            {options.length === 0 ? (
              <div style={{ padding: '10px 8px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: theme.colors.textMuted }}>
                  No saved boxers left to pick. Add athletes in Settings.
                </div>
                {onManageRoster ? (
                  <PrimaryButton
                    label="Manage in Settings"
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      setOpen(false);
                      onManageRoster();
                    }}
                    style={{ marginTop: 12, width: '100%' }}
                  />
                ) : null}
              </div>
            ) : (
              options.map((name) => (
                <button
                  key={name}
                  type="button"
                  role="option"
                  aria-selected={name === value}
                  onClick={() => {
                    onSelect(name);
                    setOpen(false);
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '12px 10px',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: name === value ? theme.colors.primarySoft : 'transparent',
                    fontSize: 15,
                    fontWeight: 800,
                    color: theme.colors.text,
                  }}
                >
                  {name}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </>
  );
};

export const NamePickerField = memo(NamePickerFieldComponent);
