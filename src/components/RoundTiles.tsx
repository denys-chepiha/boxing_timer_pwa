import { CSSProperties, memo } from 'react';

import { ResolvedRound } from '@/utils/rounds';
import { formatSecondsToClock } from '@/utils/timeFormat';

type Props = {
  rounds: ResolvedRound[];
  currentRound: number;
  onSelect: (round: number) => void;
};

export const ROUND_ODD_COLOR = '#2FB874';
export const ROUND_EVEN_COLOR = '#F5973B';
export const roundColor = (round: number): string =>
  round % 2 === 0 ? ROUND_EVEN_COLOR : ROUND_ODD_COLOR;

const RoundTilesComponent = ({ rounds, currentRound, onSelect }: Props) => {
  if (rounds.length <= 1) {
    return null;
  }

  return (
    <div className="round-tiles" style={{ flexWrap: 'wrap', overflowX: 'hidden' }}>
      {rounds.map((round, index) => {
        const roundNumber = index + 1;
        const isActive = roundNumber === currentRound;
        const tone = roundColor(round.groupRound ?? roundNumber);
        const roundText = round.groupRound
          ? `R${round.groupRound}${
              round.partnerCount && round.partnerCount > 1
                ? ` · P${round.partnerPosition}`
                : ''
            }`
          : `R${roundNumber}`;

        return (
          <button
            key={roundNumber}
            type="button"
            className="round-tile"
            onClick={() => onSelect(roundNumber)}
            aria-current={isActive ? 'step' : undefined}
            style={{ '--round-tone': tone } as CSSProperties}
          >
            <span className="round-tile__number">{roundText}</span>
            <span className="round-tile__time">
              {formatSecondsToClock(round.workSeconds)}
            </span>
            {round.label ? (
              <span className="round-tile__label">{round.label}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};

export const RoundTiles = memo(RoundTilesComponent);
