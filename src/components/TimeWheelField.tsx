import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { PrimaryButton } from '@/components/PrimaryButton';

type Props = {
  label: string;
  valueSeconds: number;
  onChange: (nextSeconds: number) => void;
  minSeconds?: number;
  maxMinutes?: number;
};

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const PAD = ((VISIBLE_ROWS - 1) / 2) * ITEM_HEIGHT;

const toParts = (totalSeconds: number) => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return { minutes: Math.floor(safe / 60), seconds: safe % 60 };
};

const pad2 = (value: number) => value.toString().padStart(2, '0');

type WheelColumnProps = {
  items: number[];
  value: number;
  unit: string;
  onSelect: (value: number) => void;
};

const WheelColumn = ({ items, value, unit, onSelect }: WheelColumnProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (element) {
      element.scrollTop = Math.max(0, items.indexOf(value)) * ITEM_HEIGHT;
    }
    // Initial alignment only; subsequent changes are driven by the user's wheel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = () => {
    const element = ref.current;
    if (!element) {
      return;
    }
    if (settleRef.current) {
      clearTimeout(settleRef.current);
    }
    settleRef.current = setTimeout(() => {
      const index = Math.min(
        items.length - 1,
        Math.max(0, Math.round(element.scrollTop / ITEM_HEIGHT)),
      );
      if (items[index] !== value) {
        onSelect(items[index]);
      }
    }, 90);
  };

  const handleTap = (item: number, index: number) => {
    const element = ref.current;
    if (element) {
      const reducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      element.scrollTo?.({
        top: index * ITEM_HEIGHT,
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
      element.scrollTop = index * ITEM_HEIGHT;
    }
    onSelect(item);
  };

  return (
    <div ref={ref} onScroll={handleScroll} className="wheel-column">
      <div style={{ height: PAD }} />
      {items.map((item, index) => (
        <button
          key={item}
          type="button"
          className="wheel-column__item"
          aria-label={`${item} ${unit}`}
          aria-pressed={item === value}
          onClick={() => handleTap(item, index)}
        >
          {pad2(item)}
        </button>
      ))}
      <div style={{ height: PAD }} />
    </div>
  );
};

const TimeWheelFieldComponent = ({
  label,
  valueSeconds,
  onChange,
  minSeconds = 1,
  maxMinutes = 99,
}: Props) => {
  const [open, setOpen] = useState(false);
  const initial = useMemo(() => {
    const parts = toParts(valueSeconds);
    return { minutes: Math.min(maxMinutes, parts.minutes), seconds: parts.seconds };
  }, [maxMinutes, valueSeconds]);
  const [minutes, setMinutes] = useState(initial.minutes);
  const [seconds, setSeconds] = useState(initial.seconds);

  const minuteItems = useMemo(
    () => Array.from({ length: maxMinutes + 1 }, (_, index) => index),
    [maxMinutes],
  );
  const secondItems = useMemo(() => Array.from({ length: 60 }, (_, index) => index), []);
  const timeText = `${pad2(initial.minutes)}:${pad2(initial.seconds)}`;
  const draftTimeText = `${pad2(minutes)}:${pad2(seconds)}`;

  const handleOpen = () => {
    setMinutes(initial.minutes);
    setSeconds(initial.seconds);
    setOpen(true);
  };

  const handleApply = () => {
    onChange(Math.max(minSeconds, minutes * 60 + seconds));
    setOpen(false);
  };

  return (
    <>
      <button type="button" className="time-field" onClick={handleOpen}>
        <span className="time-field__label">{label}</span>
        <span className="time-field__value">{timeText}</span>
        <span className="time-field__action">Set interval</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${label} interval`}
          className="sheet-backdrop is-visible"
          onClick={() => setOpen(false)}
        >
          <div
            className="bottom-sheet is-visible"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bottom-sheet__handle" aria-hidden="true" />
            <div className="bottom-sheet__header">
              <h2 className="bottom-sheet__title">{label}</h2>
              <span className="bottom-sheet__value" aria-live="polite">
                {draftTimeText}
              </span>
            </div>

            <div className="wheel-labels">
              <span>Minutes</span>
              <span>Seconds</span>
            </div>

            <div className="wheel-picker">
              <div
                className="wheel-picker__selection"
                style={{ top: PAD }}
                aria-hidden="true"
              />
              <WheelColumn
                items={minuteItems}
                value={minutes}
                unit="minutes"
                onSelect={setMinutes}
              />
              <div className="wheel-picker__divider" aria-hidden="true" />
              <WheelColumn
                items={secondItems}
                value={seconds}
                unit="seconds"
                onSelect={setSeconds}
              />
            </div>

            <div className="bottom-sheet__actions">
              <PrimaryButton
                label="Cancel"
                variant="secondary"
                onPress={() => setOpen(false)}
              />
              <PrimaryButton label="Apply" onPress={handleApply} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export const TimeWheelField = memo(TimeWheelFieldComponent);
