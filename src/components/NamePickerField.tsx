import { memo, useState } from 'react';
import { createPortal } from 'react-dom';

import { CheckIcon, ChevronDownIcon } from '@/components/Icons';
import { PrimaryButton } from '@/components/PrimaryButton';

type Props = {
  value: string;
  options: string[];
  onSelect: (name: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  onManageRoster?: () => void;
};

const NamePickerFieldComponent = ({
  value,
  options,
  onSelect,
  placeholder = 'Select name',
  ariaLabel,
  onManageRoster,
}: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        className="name-picker"
        onClick={() => setOpen(true)}
      >
        <span
          className={`name-picker__value${value ? '' : ' name-picker__value--placeholder'}`}
        >
          {value || placeholder}
        </span>
        <ChevronDownIcon className="icon name-picker__chevron" />
      </button>

      {open
        ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Select a boxer"
          className="sheet-backdrop is-visible"
          onClick={() => setOpen(false)}
        >
          <div
            className="bottom-sheet is-visible"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bottom-sheet__handle" aria-hidden="true" />
            <div className="bottom-sheet__header">
              <h2 className="bottom-sheet__title">Select a boxer</h2>
            </div>

            {options.length === 0 ? (
              <div className="empty-state" style={{ minHeight: 220, boxShadow: 'none' }}>
                <h2>Roster is empty</h2>
                <p>No saved boxers left to pick. Add athletes in Settings, then assign them here.</p>
                {onManageRoster ? (
                  <PrimaryButton
                    label="Manage in Settings"
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      setOpen(false);
                      onManageRoster();
                    }}
                    style={{ width: '100%' }}
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
                  className="picker-option"
                  onClick={() => {
                    onSelect(name);
                    setOpen(false);
                  }}
                >
                  <span>{name}</span>
                  {name === value ? <CheckIcon /> : null}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body,
      )
        : null}
    </>
  );
};

export const NamePickerField = memo(NamePickerFieldComponent);
