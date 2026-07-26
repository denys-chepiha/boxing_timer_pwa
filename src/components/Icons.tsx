import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

const baseProps = (size: number): SVGProps<SVGSVGElement> => ({
  'aria-hidden': true,
  className: 'icon',
  fill: 'none',
  height: size,
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 2,
  viewBox: '0 0 24 24',
  width: size,
});

export const SearchIcon = ({ size = 19, ...props }: IconProps) => (
  <svg {...baseProps(size)} {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </svg>
);

export const SettingsIcon = ({ size = 20, ...props }: IconProps) => (
  <svg {...baseProps(size)} {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34A1.7 1.7 0 0 0 14 20.93V21h-4v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10 3.01V3h4v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.96 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
  </svg>
);

export const PlusIcon = ({ size = 20, ...props }: IconProps) => (
  <svg {...baseProps(size)} {...props}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const PlayIcon = ({ size = 19, ...props }: IconProps) => (
  <svg {...baseProps(size)} {...props}>
    <path d="m9 6 9 6-9 6V6Z" />
  </svg>
);

export const PauseIcon = ({ size = 20, ...props }: IconProps) => (
  <svg {...baseProps(size)} {...props}>
    <path d="M9 5v14M15 5v14" />
  </svg>
);

export const StopIcon = ({ size = 19, ...props }: IconProps) => (
  <svg {...baseProps(size)} {...props}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

export const RepeatIcon = ({ size = 20, ...props }: IconProps) => (
  <svg {...baseProps(size)} {...props}>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4" />
    <path d="M21 13v2a3 3 0 0 1-3 3H3" />
  </svg>
);

export const SkipForwardIcon = ({ size = 18, ...props }: IconProps) => (
  <svg {...baseProps(size)} {...props}>
    <path d="m5 5 8 7-8 7V5ZM19 5v14" />
  </svg>
);

export const EditIcon = ({ size = 18, ...props }: IconProps) => (
  <svg {...baseProps(size)} {...props}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
  </svg>
);

export const TrashIcon = ({ size = 18, ...props }: IconProps) => (
  <svg {...baseProps(size)} {...props}>
    <path d="M4 7h16M9 7V4h6v3M8 11v6M12 11v6M16 11v6M6 7l1 14h10l1-14" />
  </svg>
);

export const ArrowLeftIcon = ({ size = 20, ...props }: IconProps) => (
  <svg {...baseProps(size)} {...props}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export const CloseIcon = ({ size = 20, ...props }: IconProps) => (
  <svg {...baseProps(size)} {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const ChevronDownIcon = ({ size = 17, ...props }: IconProps) => (
  <svg {...baseProps(size)} {...props}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const CheckIcon = ({ size = 18, ...props }: IconProps) => (
  <svg {...baseProps(size)} {...props}>
    <path d="m5 12 4 4L19 6" />
  </svg>
);

export const CopyIcon = ({ size = 18, ...props }: IconProps) => (
  <svg {...baseProps(size)} {...props}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export const TimerIcon = ({ size = 30, ...props }: IconProps) => (
  <svg {...baseProps(size)} {...props}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l3 2M9 2h6M12 2v3" />
  </svg>
);

