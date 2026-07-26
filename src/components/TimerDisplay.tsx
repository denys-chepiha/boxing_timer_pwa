// Core
import { memo } from 'react';

// Components
import { SemiCircularProgress } from '@/components/SemiCircularProgress';

// Theme
import { useTheme } from '@/theme/ThemeProvider';

// Types
import { TimerPhase } from '@/types/models';

type Props = {
  phase: TimerPhase;
  remainingSeconds: number;
  roundLabel: string;
  isCritical?: boolean;
  phaseProgress?: number;
  criticalColor?: string;
  restColor?: string;
};

const phaseLabel: Record<TimerPhase, string> = {
  prep: 'GET READY',
  work: 'WORK',
  rest: 'REST',
  finished: 'FINISHED',
};

const toClockText = (totalSeconds: number) => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const parts = [mins.toString().padStart(2, '0'), secs.toString().padStart(2, '0')];

  if (hrs > 0) {
    parts.unshift(hrs.toString().padStart(2, '0'));
  }
  return parts.join(':');
};

const TimerDisplayComponent = ({
  phase,
  remainingSeconds,
  roundLabel,
  isCritical = false,
  phaseProgress = 0,
  criticalColor = '#FF6679',
  restColor = '#4BD6A0',
}: Props) => {
  const { theme } = useTheme();
  const clockText = toClockText(remainingSeconds);
  const phaseColor = isCritical
    ? criticalColor
    : phase === 'rest' || phase === 'finished'
      ? restColor
      : 'var(--run-accent, #7394FF)';
  const progressPercent = Math.round(Math.min(1, Math.max(0, phaseProgress)) * 100);
  const trackColor = theme.isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(18, 21, 28, 0.14)';

  return (
    <div className="timer-display">
      <div className="timer-card" data-critical={isCritical}>
        <div className="timer-progress-wrap">
          <SemiCircularProgress
            progress={phaseProgress}
            color={phaseColor}
            trackColor={trackColor}
            size={320}
            strokeWidth={10}
          />
        </div>

        <div className="timer-card__content">
          <div className="timer-phase">{phaseLabel[phase]}</div>
          <div
            className={`timer-clock${clockText.length > 5 ? ' timer-clock--long' : ''}`}
            aria-live="off"
          >
            {clockText}
          </div>
          <div className="timer-meta">
            {roundLabel ? <span>{roundLabel}</span> : null}
            {roundLabel ? <span className="timer-meta__dot" aria-hidden="true" /> : null}
            <span>{progressPercent}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const TimerDisplay = memo(TimerDisplayComponent);
