// Core
import { useEffect, useState } from 'react';

// Components
import { NamePickerField } from '@/components/NamePickerField';
import { PartnerConfigSheet } from '@/components/PartnerConfigSheet/PartnerConfigSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TimeWheelField } from '@/components/TimeWheelField';

// Consts
import { plainTextInputProps } from '@/consts/forms';

// Hooks
import { UseRoundsConfigResult } from '@/hooks/useRoundsConfig/useRoundsConfig';

// Theme
import { useTheme } from '@/theme/ThemeProvider';

// Utils
import { formatSecondsToClock } from '@/utils/timeFormat';

type Props = {
  training: UseRoundsConfigResult;
  rosterOptionsFor: (participantId: string, currentName: string) => string[];
  onManageRoster: () => void;
};

type SelectedPartner = {
  participantId: string;
  entrantIndex: number;
} | null;

const GearIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    width="17"
    height="17"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10 3.01V3h4v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.96 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
  </svg>
);

/**
 * A configured Group Training round is a queue of partners. Each partner owns
 * their work interval and instruction, while the round itself controls order
 * and the recovery before the next round.
 */
export const SessionDetailsPanel = ({
  training,
  rosterOptionsFor,
  onManageRoster,
}: Props) => {
  const { theme } = useTheme();
  const { mode, participants } = training;
  const isPair = mode === 'pair';
  const [selectedPartner, setSelectedPartner] = useState<SelectedPartner>(null);
  const [expandedPairRoundId, setExpandedPairRoundId] = useState<string | null>(
    null,
  );

  const selectedParticipant = selectedPartner
    ? participants.find(
        (participant) => participant.id === selectedPartner.participantId,
      )
    : undefined;
  const selectedEntrant =
    selectedPartner && selectedParticipant
      ? selectedParticipant.entrants[selectedPartner.entrantIndex]
      : undefined;
  const selectedRoundIndex = selectedPartner
    ? participants.findIndex(
        (participant) => participant.id === selectedPartner.participantId,
      )
    : -1;
  const selectedRoundNumber = Math.max(1, selectedRoundIndex + 1);
  const selectedRoundIsLast =
    selectedRoundIndex >= 0 && selectedRoundIndex === participants.length - 1;
  const selectedHasOverrides =
    selectedEntrant?.workSeconds !== undefined ||
    selectedEntrant?.restSeconds !== undefined ||
    selectedEntrant?.description !== undefined;

  useEffect(() => {
    if (selectedPartner && !selectedEntrant) {
      setSelectedPartner(null);
    }
  }, [selectedEntrant, selectedPartner]);

  const labelStyle = {
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: 0,
    color: theme.colors.textMuted,
  };

  const sectionStyle = {
    borderWidth: 1,
    borderStyle: 'solid' as const,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 18,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 14,
    boxShadow: theme.isDark ? 'none' : '0 1px 2px rgba(21, 24, 32, 0.05), 0 12px 34px rgba(21, 24, 32, 0.07)',
  };

  const actionStyle = {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'solid' as const,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    color: theme.colors.textMuted,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: 900,
    flexShrink: 0,
  };

  return (
    <>
      <section className="surface-section training-panel" style={sectionStyle}>
        {isPair ? (
          <div>
            <span style={labelStyle}>Pair rounds</span>
            <div className="section-description">
              Choose the two boxers sharing each round.
            </div>
          </div>
        ) : null}

        {participants.length > 0 ? (
          <div className="training-panel__rounds">
            {participants.map((participant, roundIndex) => {
              const pairRoundExpanded =
                isPair && expandedPairRoundId === participant.id;
              const isLastRound = roundIndex === participants.length - 1;
              const roundWorkSeconds =
                participant.workSeconds ?? training.workSeconds;
              const roundRestSeconds =
                participant.restSeconds ?? training.restSeconds;
              const roundDescription = participant.description ?? '';
              const roundTitleId = `training-round-${participant.id}-title`;

              return (
                <div
                  key={participant.id}
                  className="training-round"
                  data-expanded={pairRoundExpanded}
                  data-last-round={isLastRound}
                  role="group"
                  aria-labelledby={roundTitleId}
                >
                  <div className="training-round__header">
                    <div style={{ minWidth: 0, paddingTop: 2 }}>
                      <div
                        id={roundTitleId}
                        className="training-round__title"
                      >
                        ROUND {roundIndex + 1}
                      </div>
                      <div className="training-round__meta">
                        {isPair
                          ? `${formatSecondsToClock(roundWorkSeconds)} work · ${formatSecondsToClock(roundRestSeconds)} rest`
                          : `${participant.entrants.length} ${
                              participant.entrants.length === 1
                                ? 'partner'
                                : 'partners'
                            }`}
                      </div>
                    </div>

                    <div className="training-round__toolbar">
                      <button
                        type="button"
                        onClick={() => training.moveParticipant(roundIndex, -1)}
                        disabled={roundIndex === 0}
                        aria-label={`Move round ${roundIndex + 1} up`}
                        className="round-action"
                        style={{
                          ...actionStyle,
                          opacity: roundIndex === 0 ? 0.4 : 1,
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => training.moveParticipant(roundIndex, 1)}
                        disabled={roundIndex === participants.length - 1}
                        aria-label={`Move round ${roundIndex + 1} down`}
                        className="round-action"
                        style={{
                          ...actionStyle,
                          opacity:
                            roundIndex === participants.length - 1 ? 0.4 : 1,
                        }}
                      >
                        ↓
                      </button>
                      {isPair ? (
                        <button
                          type="button"
                          aria-expanded={pairRoundExpanded}
                          aria-label={`Configure round ${roundIndex + 1}`}
                          className="round-action"
                          onClick={() =>
                            setExpandedPairRoundId(
                              pairRoundExpanded ? null : participant.id,
                            )
                          }
                          style={{
                            ...actionStyle,
                            color: pairRoundExpanded
                              ? theme.colors.primary
                              : theme.colors.textMuted,
                          }}
                        >
                          <GearIcon />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          training.removeParticipant(participant.id)
                        }
                        aria-label={`Remove round ${roundIndex + 1}`}
                        className="round-action"
                        style={actionStyle}
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {!isPair ? (
                    <div className="training-round__defaults">
                      <div
                        className="training-round__timing"
                        data-single={isLastRound}
                        role="group"
                        aria-label={`Round ${roundIndex + 1} timing`}
                      >
                        <TimeWheelField
                          label="WORK"
                          valueSeconds={roundWorkSeconds}
                          onChange={(value) =>
                            training.updateParticipant(participant.id, {
                              workSeconds: value,
                            })
                          }
                          minSeconds={1}
                        />
                        {!isLastRound ? (
                          <TimeWheelField
                            label="REST"
                            valueSeconds={roundRestSeconds}
                            onChange={(value) =>
                              training.updateParticipant(participant.id, {
                                restSeconds: value,
                              })
                            }
                            minSeconds={0}
                          />
                        ) : null}
                      </div>

                      <div className="training-round__instructions-field">
                        <label
                          htmlFor={`training-round-${participant.id}-instructions`}
                          className="field-label"
                        >
                          Round instructions
                          <span className="required-label">Required</span>
                        </label>
                        <textarea
                          {...plainTextInputProps}
                          id={`training-round-${participant.id}-instructions`}
                          aria-label={`Workout instructions for round ${roundIndex + 1}`}
                          aria-required="true"
                          required
                          value={roundDescription}
                          onChange={(event) =>
                            training.updateParticipant(participant.id, {
                              description: event.target.value,
                            })
                          }
                          placeholder="Describe the workout for this round"
                          rows={2}
                          className="text-field training-round__instructions"
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="training-round__entrants">
                    {participant.entrants.length === 0 ? (
                      <div className="training-empty">
                        No partners in this round.
                      </div>
                    ) : null}

                    {participant.entrants.map((entrant, entrantIndex) => {
                      const partnerLabel =
                        entrant.name || `partner ${entrantIndex + 1}`;
                      const partnerWork =
                        entrant.workSeconds ??
                        participant.workSeconds ??
                        training.workSeconds;
                      const partnerRest =
                        entrant.restSeconds ??
                        participant.restSeconds ??
                        training.restSeconds;
                      const partnerDescription =
                        entrant.description?.trim() ||
                        participant.description?.trim() ||
                        'Round instructions';
                      const hasPartnerOverrides =
                        entrant.workSeconds !== undefined ||
                        entrant.restSeconds !== undefined ||
                        entrant.description !== undefined;

                      return (
                        <div
                          key={entrantIndex}
                          className="training-partner"
                        >
                          <div className="training-partner__row">
                            <NamePickerField
                              value={entrant.name}
                              options={rosterOptionsFor(
                                participant.id,
                                entrant.name,
                              )}
                              onSelect={(next) =>
                                training.updateEntrantName(
                                  participant.id,
                                  entrantIndex,
                                  next,
                                )
                              }
                              onManageRoster={onManageRoster}
                              placeholder={
                                entrantIndex === 0
                                  ? 'Select name'
                                  : 'Select partner'
                              }
                              ariaLabel={`Name ${entrantIndex + 1} for round ${roundIndex + 1}`}
                            />
                            <button
                              type="button"
                              aria-label={`Configure ${partnerLabel} in round ${roundIndex + 1}`}
                              className="round-action"
                              onClick={() =>
                                setSelectedPartner({
                                  participantId: participant.id,
                                  entrantIndex,
                                })
                              }
                              style={actionStyle}
                            >
                              <GearIcon />
                            </button>
                            {!isPair ? (
                              <button
                                type="button"
                                aria-label={`Remove ${partnerLabel} from round ${roundIndex + 1}`}
                                className="round-action"
                                onClick={() =>
                                  training.removeEntrant(
                                    participant.id,
                                    entrantIndex,
                                  )
                                }
                                style={actionStyle}
                              >
                                ×
                              </button>
                            ) : null}
                          </div>

                          {!isPair ? (
                            <div className="training-partner__summary">
                              {formatSecondsToClock(partnerWork)} work
                              {!isLastRound
                                ? ` · ${formatSecondsToClock(partnerRest)} rest`
                                : ''}
                              {` · ${
                                hasPartnerOverrides
                                  ? 'Custom settings'
                                  : 'Round defaults'
                              } · ${partnerDescription}`}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}

                    {!isPair || participant.entrants.length < 2 ? (
                      <PrimaryButton
                        label="+ Add partner"
                        variant="secondary"
                        size="sm"
                        onPress={() => training.addEntrant(participant.id)}
                      />
                    ) : null}
                  </div>

                  {pairRoundExpanded ? (
                    <div
                      role="region"
                      aria-label={`Round ${roundIndex + 1} configuration`}
                      className="training-round__config timing-grid"
                    >
                      <TimeWheelField
                        label="WORK"
                        valueSeconds={roundWorkSeconds}
                        onChange={(value) =>
                          training.updateParticipant(participant.id, {
                            workSeconds: value,
                          })
                        }
                        minSeconds={1}
                      />
                      <TimeWheelField
                        label="REST"
                        valueSeconds={roundRestSeconds}
                        onChange={(value) =>
                          training.updateParticipant(participant.id, {
                            restSeconds: value,
                          })
                        }
                        minSeconds={0}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="training-empty">
            Add a round to start assigning boxers.
          </div>
        )}

        <PrimaryButton
          label="+ Add round"
          variant="secondary"
          onPress={training.addParticipant}
        />
      </section>

      <PartnerConfigSheet
        open={!!selectedEntrant}
        partnerName={selectedEntrant?.name ?? ''}
        roundNumber={selectedRoundNumber}
        workSeconds={
          selectedEntrant?.workSeconds ??
          selectedParticipant?.workSeconds ??
          training.workSeconds
        }
        restSeconds={
          selectedEntrant?.restSeconds ??
          selectedParticipant?.restSeconds ??
          training.restSeconds
        }
        description={selectedEntrant?.description}
        defaultDescription={selectedParticipant?.description}
        showWorkTime={!isPair}
        showRestTime={!isPair && !selectedRoundIsLast}
        hasOverrides={selectedHasOverrides}
        onWorkSecondsChange={(value) => {
          if (selectedPartner) {
            training.updateEntrantWorkSeconds(
              selectedPartner.participantId,
              selectedPartner.entrantIndex,
              value,
            );
          }
        }}
        onRestSecondsChange={(value) => {
          if (selectedPartner) {
            training.updateEntrantRestSeconds(
              selectedPartner.participantId,
              selectedPartner.entrantIndex,
              value,
            );
          }
        }}
        onDescriptionChange={(value) => {
          if (selectedPartner) {
            training.updateEntrantDescription(
              selectedPartner.participantId,
              selectedPartner.entrantIndex,
              value,
            );
          }
        }}
        onResetOverrides={() => {
          if (selectedPartner) {
            training.resetEntrantOverrides(
              selectedPartner.participantId,
              selectedPartner.entrantIndex,
            );
          }
        }}
        onClose={() => setSelectedPartner(null)}
      />
    </>
  );
};
