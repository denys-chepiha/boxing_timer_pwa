// Core
import { memo } from 'react';

type Option<T extends string> = {
  label: string;
  value: T;
};

type Props<T extends string> = {
  value: T;
  onChange: (next: T) => void;
  options: Option<T>[];
  maxPerRow?: number;
};

function SegmentedControlComponent<T extends string>({
  value,
  onChange,
  options,
  maxPerRow = 3,
}: Props<T>) {
  const perRow = Math.max(1, Math.min(4, maxPerRow));
  const rows: Option<T>[][] = [];

  for (let index = 0; index < options.length; index += perRow) {
    rows.push(options.slice(index, index + perRow));
  }

  return (
    <div className="segmented-control">
      {rows.map((row, rowIndex) => (
        <div key={`row-${rowIndex}`} className="segmented-control__row">
          {row.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                aria-pressed={active}
                className="segmented-control__option"
              >
                {option.label}
              </button>
            );
          })}
          {row.length < perRow
            ? Array.from({ length: perRow - row.length }).map((_, fillerIndex) => (
                <div
                  key={`filler-${rowIndex}-${fillerIndex}`}
                  className="segmented-control__filler"
                />
              ))
            : null}
        </div>
      ))}
    </div>
  );
}

export const SegmentedControl = memo(SegmentedControlComponent) as typeof SegmentedControlComponent;
