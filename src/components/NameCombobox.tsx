// Core
import { memo, useEffect, useRef, useState } from 'react';

// Consts
import { plainTextInputProps } from '@/consts/forms';

// Theme
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  value: string;
  onChange: (name: string) => void;
  suggestions: string[];
  onRemoveSuggestion?: (name: string) => void;
  placeholder?: string;
  ariaLabel?: string;
};

/**
 * A free-text name field backed by a saved roster: typing filters the
 * dropdown, picking a suggestion fills the field, and typing anything else is
 * accepted as a new name. Deliberately not a native `<datalist>` — the app
 * avoids native autofill/autocomplete UI everywhere (see `plainTextInputProps`)
 * since iOS can hijack the first tap with its own suggestion bar.
 */
const NameComboboxComponent = ({
  value,
  onChange,
  suggestions,
  onRemoveSuggestion,
  placeholder = 'Name',
  ariaLabel,
}: Props) => {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const query = value.trim().toLowerCase();
  const filtered = suggestions.filter((name) => !query || name.toLowerCase().includes(query));

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <input
        {...plainTextInputProps}
        type="text"
        enterKeyHint="done"
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        style={{
          width: '100%',
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

      {open && filtered.length > 0 ? (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            zIndex: 10,
            maxHeight: 220,
            overflowY: 'auto',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.card,
            borderRadius: 8,
            boxShadow: theme.colors.shadow,
          }}
        >
          {filtered.map((name) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center' }}>
              <button
                type="button"
                role="option"
                aria-selected={name === value}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'left',
                  padding: '10px 12px',
                  fontSize: 14,
                  fontWeight: 700,
                  color: theme.colors.text,
                  background: 'transparent',
                  border: 'none',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {name}
              </button>
              {onRemoveSuggestion ? (
                <button
                  type="button"
                  aria-label={`Remove ${name} from saved names`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveSuggestion(name);
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    marginRight: 6,
                    flex: '0 0 auto',
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
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const NameCombobox = memo(NameComboboxComponent);
