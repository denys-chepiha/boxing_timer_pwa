import type { CSSProperties, ReactNode } from 'react';

type Props = {
  ariaLabel: string;
  icon: ReactNode;
  onPress: () => void;
  variant?: 'default' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: CSSProperties;
};

export const IconButton = ({
  ariaLabel,
  icon,
  onPress,
  variant = 'default',
  disabled = false,
  style,
}: Props) => (
  <button
    type="button"
    aria-label={ariaLabel}
    className={`icon-button${variant === 'default' ? '' : ` icon-button--${variant}`}`}
    disabled={disabled}
    onClick={onPress}
    style={style}
  >
    {icon}
  </button>
);
