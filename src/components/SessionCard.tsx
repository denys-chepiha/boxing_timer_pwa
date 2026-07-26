import { CSSProperties, memo } from 'react';

import { IconButton } from '@/components/IconButton';
import { EditIcon, PlayIcon, TrashIcon } from '@/components/Icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Session } from '@/types/models';
import { isUniformRounds, resolveRounds, sumRounds } from '@/utils/rounds';
import { formatSecondsToClock } from '@/utils/timeFormat';

type Props = {
  session: Session;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

const categoryMeta = {
  boxing: { label: 'Boxing', tone: '#2858E6' },
  running: { label: 'Running', tone: '#7759D9' },
  custom: { label: 'Custom', tone: '#13845D' },
} as const;

const SessionCardComponent = ({ session, onPress, onEdit, onDelete }: Props) => {
  const meta = categoryMeta[session.category];
  const rounds = resolveRounds(session);
  const displayedRoundCount = session.participants?.length ?? rounds.length;
  const totalDuration = sumRounds(rounds).total;
  const uniform = isUniformRounds(rounds);
  const workValue = uniform ? formatSecondsToClock(rounds[0].workSeconds) : 'Varies';
  const restCandidates = rounds.filter((round) => round.restSeconds > 0);
  const restValue = uniform
    ? formatSecondsToClock(restCandidates[0]?.restSeconds ?? 0)
    : 'Varies';
  const participantNames = Array.from(
    new Set(
      session.participants?.flatMap((participant) =>
        participant.entrants.map((entrant) => entrant.name),
      ) ?? [],
    ),
  );

  return (
    <article
      className="session-card"
      style={{ '--session-tone': meta.tone } as CSSProperties}
    >
      <button type="button" onClick={onPress} className="session-card__open">
        <div className="session-card__header">
          <div className="session-card__copy">
            <h2 className="session-card__name">{session.name}</h2>
            <div className="session-card__summary">
              {displayedRoundCount} rounds - {formatSecondsToClock(totalDuration)}
            </div>
            {participantNames.length > 0 ? (
              <div className="session-card__people">{participantNames.join(', ')}</div>
            ) : null}
          </div>
          <span className="session-card__badge">{meta.label}</span>
        </div>

        <div className="session-card__metrics">
          <div className="session-card__metric">
            <span className="session-card__metric-label">Work</span>
            <span className="session-card__metric-value">{workValue}</span>
          </div>
          <div className="session-card__metric">
            <span className="session-card__metric-label">Rest</span>
            <span className="session-card__metric-value">{restValue}</span>
          </div>
          <div className="session-card__metric">
            <span className="session-card__metric-label">Total</span>
            <span className="session-card__metric-value">
              {formatSecondsToClock(totalDuration)}
            </span>
          </div>
        </div>
      </button>

      <footer className="session-card__footer">
        <PrimaryButton
          label="Start"
          icon={<PlayIcon />}
          onPress={onPress}
          size="sm"
          style={{ minWidth: 108 }}
        />
        <div className="session-card__actions">
          <IconButton ariaLabel="Edit" icon={<EditIcon />} onPress={onEdit} variant="ghost" />
          <IconButton
            ariaLabel="Delete"
            icon={<TrashIcon />}
            onPress={onDelete}
            variant="ghost"
          />
        </div>
      </footer>
    </article>
  );
};

export const SessionCard = memo(SessionCardComponent);
