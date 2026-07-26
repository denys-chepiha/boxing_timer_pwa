// Core
import { CSSProperties, memo, ReactNode } from 'react';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  ariaLabel?: string;
  style?: CSSProperties;
  icon?: ReactNode;
  className?: string;
};

const PrimaryButtonComponent = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  ariaLabel,
  style,
  icon,
  className,
}: Props) => {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`primary-button primary-button--${variant} primary-button--${size}${className ? ` ${className}` : ''}`}
      style={style}
    >
      {icon}
      {label}
    </button>
  );
};

export const PrimaryButton = memo(PrimaryButtonComponent);
