// Core
import { memo } from 'react';

// Theme
import { useTheme } from '@/theme/ThemeProvider';

// Utils
import { ResolvedRound } from '@/utils/rounds';
import { formatSecondsToClock } from '@/utils/timeFormat';

type Props = {
  rounds: ResolvedRound[];
  /** 1-based round currently running. */
  currentRound: number;
  /** Jump to a 1-based round. */
  onSelect: (round: number) => void;
};

/**
 * Rounds alternate colour by parity so both fighters can tell whose round it is
 * at a glance: odd rounds green, even rounds orange.
 */
export const ROUND_ODD_COLOR = '#2FB874';
export const ROUND_EVEN_COLOR = '#F5973B';
export const roundColor = (round: number): string =>
  round % 2 === 0 ? ROUND_EVEN_COLOR : ROUND_ODD_COLOR;

const RoundTilesComponent = ({ rounds, currentRound, onSelect }: Props) => {
  const { theme } = useTheme();

  if (rounds.length <= 1) {
    return null;
  }

  return (
    <div
      className="round-tiles"
      style={{
        width: '100%',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8,
        overflowX: 'hidden',
        overflowY: 'visible',
        padding: '2px 2px 6px',
      }}
    >
      {rounds.map((round, index) => {
        const roundNumber = index + 1;
        const isActive = roundNumber === currentRound;
        const tone = roundColor(roundNumber);

        return (
          <button
            key={roundNumber}
            type="button"
            className="round-tile"
            onClick={() => onSelect(roundNumber)}
            aria-current={isActive ? 'step' : undefined}
            style={{
              flex: '0 0 auto',
              minWidth: 56,
              maxWidth: 88,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '8px 10px',
              borderRadius: 10,
              borderWidth: isActive ? 2 : 1,
              borderStyle: 'solid',
              borderColor: tone,
              backgroundColor: isActive ? tone : `${tone}10`,
              boxShadow: isActive ? `0 10px 22px ${tone}44` : 'none',
              cursor: 'pointer',
              transition:
                'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.05s ease',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 0.6,
                color: isActive ? '#FFFFFF' : tone,
              }}
            >
              R{roundNumber}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: isActive ? '#FFFFFF' : theme.colors.text,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatSecondsToClock(round.workSeconds)}
            </span>
            {round.label ? (
              <span
                style={{
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 10,
                  fontWeight: 800,
                  color: isActive ? '#FFFFFF' : theme.colors.textMuted,
                }}
              >
                {round.label}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};

export const RoundTiles = memo(RoundTilesComponent);
