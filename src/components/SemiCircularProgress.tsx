import { memo } from 'react';

type Props = {
  progress: number;
  color: string;
  trackColor: string;
  size?: number;
  strokeWidth?: number;
};

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

const SemiCircularProgressComponent = ({
  progress,
  color,
  trackColor,
  size = 320,
  strokeWidth = 10,
}: Props) => {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = Math.PI * 2 * radius;
  const dashOffset = circumference * (1 - clamp(progress));
  const arcPath = [
    `M ${center} ${strokeWidth / 2}`,
    `A ${radius} ${radius} 0 1 1 ${center - 0.01} ${strokeWidth / 2}`,
  ].join(' ');

  return (
    <svg
      className="timer-progress-svg"
      width={size}
      height={size}
      role="progressbar"
      aria-label="Interval progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamp(progress) * 100)}
      viewBox={`0 0 ${size} ${size}`}
    >
      <path
        className="timer-progress-track"
        d={arcPath}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
      <path
        className="timer-progress-value"
        d={arcPath}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
      />
    </svg>
  );
};

export const SemiCircularProgress = memo(SemiCircularProgressComponent);
