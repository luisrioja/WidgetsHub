import type { ReactNode } from 'react';

export type IconName =
  | 'play'
  | 'pause'
  | 'restart'
  | 'skip'
  | 'snooze'
  | 'check'
  | 'close'
  | 'minus'
  | 'plus'
  | 'dots'
  | 'sun'
  | 'moon'
  | 'flag'
  | 'trash'
  | 'alert'
  | 'search';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

/** Monoline, 1.5px stroke, no fill, round caps. Colour inherits from text. */
const PATHS: Record<IconName, ReactNode> = {
  play: <path d="M7 4.5v11l9-5.5-9-5.5Z" />,
  pause: <path d="M7.5 4.5v11M12.5 4.5v11" />,
  restart: <path d="M16.5 10a6.5 6.5 0 1 1-2-4.7M16.5 3v3.5H13" />,
  skip: <path d="M5 4.5v11l8-5.5-8-5.5ZM15.5 4.5v11" />,
  snooze: <path d="M10 3.5a6.5 6.5 0 1 0 6.5 6.5M10 6v4.5l3 1.75M13 3.5h4l-4 4h4" />,
  check: <path d="M4 10.5 8 14.5 16 5.5" />,
  close: <path d="M5 5l10 10M15 5L5 15" />,
  minus: <path d="M4 10h12" />,
  plus: <path d="M10 4v12M4 10h12" />,
  dots: (
    <>
      <path d="M10 4.75v.01M10 10v.01M10 15.25v.01" strokeWidth="2.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" />
    </>
  ),
  moon: <path d="M16.5 11.8A6.8 6.8 0 0 1 8.2 3.5a6.8 6.8 0 1 0 8.3 8.3Z" />,
  flag: <path d="M5 3v14M5 3.5h8l-2 3 2 3H5" />,
  trash: <path d="M4 6h12M8 6V4.5h4V6M5.5 6l.7 9.5h7.6L14.5 6" />,
  alert: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6v5M10 13.6v.01" strokeWidth="2" />
    </>
  ),
  search: (
    <>
      <circle cx="8.75" cy="8.75" r="5.25" />
      <path d="M12.6 12.6 16.5 16.5" />
    </>
  ),
};

export default function Icon({ name, size = 20, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
