// Core
import { memo } from 'react';

// Components
import { PrimaryButton } from '@/components/PrimaryButton';

// Theme
import { useTheme } from '@/theme/ThemeProvider';

// Types
import { Session } from '@/types/models';

// Utils
import { isUniformRounds, resolveRounds, sumRounds } from '@/utils/rounds';
import { formatSecondsToClock } from '@/utils/timeFormat';

type Props = {
  session: Session;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

const categoryMeta = {
  boxing: { label: 'Boxing', tone: '#2258D8' },
  running: { label: 'Running', tone: '#7C5CE6' },
  custom: { label: 'Custom', tone: '#159A6C' },
} as const;

const SessionCardComponent = ({ session, onPress, onEdit, onDelete }: Props) => {
  const { theme } = useTheme();
  const meta = categoryMeta[session.category];
  const rounds = resolveRounds(session);
  const totals = sumRounds(rounds);
  const totalDuration = totals.total;
  const uniform = isUniformRounds(rounds);
  const workValue = uniform ? formatSecondsToClock(rounds[0].workSeconds) : 'Varies';
  const restCandidates = rounds.filter((round) => round.restSeconds > 0);
  const restValue = uniform
    ? formatSecondsToClock(restCandidates[0]?.restSeconds ?? 0)
    : 'Varies';
  const participantNames =
    session.participants?.flatMap((participant) => participant.entrants.map((entrant) => entrant.name)) ?? [];

  const metricStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    minWidth: 0,
  };

  const metricLabelStyle = {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.8,
    color: theme.colors.textSubtle,
    textTransform: 'uppercase' as const,
  };

  const metricValueStyle = {
    fontSize: 15,
    fontWeight: 900,
    color: theme.colors.text,
    fontVariantNumeric: 'tabular-nums' as const,
  };

  return (
    <div
      style={{
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.card,
        borderRadius: 8,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: theme.isDark ? 'none' : '0 12px 28px rgba(17, 24, 39, 0.07)',
      }}
    >
      <button
        type="button"
        onClick={onPress}
        style={{
          width: '100%',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 5, alignSelf: 'stretch', borderRadius: 4, backgroundColor: meta.tone }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: theme.colors.text,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {session.name}
                </div>
                <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: theme.colors.textMuted }}>
                  {rounds.length} rounds - {formatSecondsToClock(totalDuration)}
                </div>
                {participantNames.length > 0 ? (
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 12,
                      fontWeight: 700,
                      color: theme.colors.textSubtle,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {participantNames.join(', ')}
                  </div>
                ) : null}
              </div>
              <span
                style={{
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: theme.colors.border,
                  borderRadius: 999,
                  padding: '5px 9px',
                  backgroundColor: theme.colors.surface,
                  color: meta.tone,
                  fontSize: 12,
                  fontWeight: 900,
                  whiteSpace: 'nowrap',
                }}
              >
                {meta.label}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            borderTopWidth: 1,
            borderTopStyle: 'solid',
            borderTopColor: theme.colors.border,
            borderBottomWidth: 1,
            borderBottomStyle: 'solid',
            borderBottomColor: theme.colors.border,
            padding: '12px 0',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 12,
          }}
        >
          <div style={metricStyle}>
            <span style={metricLabelStyle}>Work</span>
            <span style={metricValueStyle}>{workValue}</span>
          </div>

          <div style={metricStyle}>
            <span style={metricLabelStyle}>Rest</span>
            <span style={metricValueStyle}>{restValue}</span>
          </div>

          <div style={metricStyle}>
            <span style={metricLabelStyle}>Total</span>
            <span style={metricValueStyle}>{formatSecondsToClock(totalDuration)}</span>
          </div>
        </div>
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 8 }}>
        <PrimaryButton label="Start" onPress={onPress} size="sm" />
        <PrimaryButton label="Edit" variant="secondary" onPress={onEdit} size="sm" />
        <PrimaryButton label="Delete" variant="ghost" onPress={onDelete} size="sm" />
      </div>
    </div>
  );
};

export const SessionCard = memo(SessionCardComponent);
