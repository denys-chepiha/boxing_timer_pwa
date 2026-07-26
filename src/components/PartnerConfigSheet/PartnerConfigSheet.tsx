// Core
import { memo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Components
import { PrimaryButton } from '@/components/PrimaryButton';
import { TimeWheelField } from '@/components/TimeWheelField';

// Consts
import { plainTextInputProps } from '@/consts/forms';

// Styles
import './PartnerConfigSheet.css';

type Props = {
  open: boolean;
  partnerName: string;
  roundNumber: number;
  workSeconds: number;
  restSeconds: number;
  description?: string;
  defaultDescription?: string;
  showWorkTime: boolean;
  showRestTime: boolean;
  hasOverrides: boolean;
  onWorkSecondsChange: (value: number) => void;
  onRestSecondsChange: (value: number) => void;
  onDescriptionChange: (value: string) => void;
  onResetOverrides: () => void;
  onClose: () => void;
};

const CLOSE_ANIMATION_MS = 240;

const PartnerConfigSheetComponent = ({
  open,
  partnerName,
  roundNumber,
  workSeconds,
  restSeconds,
  description,
  defaultDescription,
  showWorkTime,
  showRestTime,
  hasOverrides,
  onWorkSecondsChange,
  onRestSecondsChange,
  onDescriptionChange,
  onResetOverrides,
  onClose,
}: Props) => {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timeout = setTimeout(() => setMounted(false), CLOSE_ANIMATION_MS);
    return () => clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mounted, onClose]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Partner configuration"
      className={`partner-config-backdrop${visible ? ' is-visible' : ''}`}
      onClick={onClose}
    >
      <div
        className={`partner-config-sheet${visible ? ' is-visible' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="partner-config-handle" aria-hidden="true" />

        <div className="partner-config-header">
          <div className="partner-config-heading">
            <div className="partner-config-caption">Partner settings</div>
            <div className="partner-config-title">
              {partnerName || 'Select a partner'}
            </div>
          </div>
          <PrimaryButton label="Done" size="sm" onPress={onClose} />
        </div>

        <div className="partner-config-inheritance">
          <div>
            <strong>Round {roundNumber} defaults</strong>
            <span>
              Change a field here only when this partner needs a different setup.
            </span>
          </div>
          {hasOverrides ? (
            <PrimaryButton
              label="Use round defaults"
              variant="ghost"
              size="sm"
              onPress={onResetOverrides}
            />
          ) : null}
        </div>

        {showWorkTime || showRestTime ? (
          <div
            className="partner-config-times"
            data-single={!showRestTime}
          >
            {showWorkTime ? (
              <TimeWheelField
                label="WORK TIME"
                valueSeconds={workSeconds}
                onChange={onWorkSecondsChange}
                minSeconds={1}
              />
            ) : null}
            {showRestTime ? (
              <TimeWheelField
                label="REST TIME"
                valueSeconds={restSeconds}
                onChange={onRestSecondsChange}
                minSeconds={0}
              />
            ) : null}
          </div>
        ) : null}

        <label
          htmlFor="partner-training-instructions"
          className="field-label"
        >
          Partner instructions <span className="optional-label">(optional)</span>
        </label>
        <textarea
          {...plainTextInputProps}
          id="partner-training-instructions"
          aria-label="Workout instructions"
          value={description ?? ''}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder={
            defaultDescription
              ? `Uses round instructions: ${defaultDescription}`
              : 'Uses the round instructions'
          }
          rows={3}
          className="text-field"
        />
      </div>
    </div>,
    document.body,
  );
};

export const PartnerConfigSheet = memo(PartnerConfigSheetComponent);
