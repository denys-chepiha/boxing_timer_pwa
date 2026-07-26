import { memo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { CheckIcon } from '@/components/Icons';
import { TimingMode } from '@/hooks/useRoundsConfig/useRoundsConfig';

import './TrainingTypeSheet.css';

type Option = { label: string; value: TimingMode };

type Props = {
  open: boolean;
  value: TimingMode;
  options: Option[];
  onSelect: (next: TimingMode) => void;
  onClose: () => void;
};

const CLOSE_ANIMATION_MS = 240;

const descriptions: Record<TimingMode, string> = {
  uniform: 'One work and rest interval for every round.',
  custom: 'Set a different work and rest interval per round.',
  group: 'Assign one or more saved boxers to each round.',
  pair: 'Build rounds for two boxers sharing the clock.',
};

const TrainingTypeSheetComponent = ({ open, value, options, onSelect, onClose }: Props) => {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frameId = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frameId);
    }

    setVisible(false);
    const timeoutId = setTimeout(() => setMounted(false), CLOSE_ANIMATION_MS);
    return () => clearTimeout(timeoutId);
  }, [open]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Training type"
      onClick={onClose}
      className={`training-type-sheet-backdrop${visible ? ' is-visible' : ''}`}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className={`training-type-sheet${visible ? ' is-visible' : ''}`}
      >
        <div className="training-type-sheet__handle" aria-hidden="true" />
        <div className="training-type-sheet__heading">
          <h2>Training type</h2>
          <p>Choose how the rounds and athletes are organised.</p>
        </div>

        <div className="training-type-sheet__options">
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className="training-type-sheet__option"
                aria-label={option.label}
                aria-pressed={active}
                onClick={() => onSelect(option.value)}
              >
                <span>
                  <strong>{option.label}</strong>
                  <small>{descriptions[option.value]}</small>
                </span>
                <span className="training-type-sheet__check" aria-hidden="true">
                  {active ? <CheckIcon /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export const TrainingTypeSheet = memo(TrainingTypeSheetComponent);
