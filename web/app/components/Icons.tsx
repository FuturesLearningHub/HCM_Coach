import type { ReactNode } from "react";

function Svg({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

type P = { size?: number };

export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const IconCheckCircle = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.8 2.8L16 9.8" />
  </Svg>
);
export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.6v.2" />
  </Svg>
);
export const IconAlert = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.8l9 15.7H3l9-15.7z" />
    <path d="M12 10v4.5M12 17v.2" />
  </Svg>
);
export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </Svg>
);
export const IconDots = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="2.6" />
  </Svg>
);
export const IconPencil = (p: P) => (
  <Svg {...p}>
    <path d="M4 20l1-4.5L16.2 4.3a1.6 1.6 0 012.3 0l1.2 1.2a1.6 1.6 0 010 2.3L8.5 19 4 20z" />
    <path d="M14.5 6l3.5 3.5" />
  </Svg>
);
export const IconArrowLeft = (p: P) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);
export const IconArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
    <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
  </Svg>
);
export const IconPeople = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="9" r="3.2" />
    <path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" />
    <path d="M15.5 6.2a3 3 0 010 5.6M17.5 14.8c1.6.6 2.6 2 3 4.2" />
  </Svg>
);
export const IconPuzzle = (p: P) => (
  <Svg {...p}>
    <path d="M9.5 5.5a2 2 0 114 0V7H18v4.5h-1.5a2 2 0 1 4H18V20H5V7h4.5V5.5z" />
  </Svg>
);

/* ---------- shell and springboard ---------- */

export const IconMenu = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);
export const IconHome = (p: P) => (
  <Svg {...p}>
    <path d="M4 11l8-7 8 7v8.5a.5.5 0 01-.5.5H15v-6H9v6H4.5a.5.5 0 01-.5-.5V11z" />
  </Svg>
);
export const IconStar = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.8z" />
  </Svg>
);
export const IconFlag = (p: P) => (
  <Svg {...p}>
    <path d="M6 21V4M6 5h11l-2.2 4L17 13H6" />
  </Svg>
);
export const IconBell = (p: P) => (
  <Svg {...p}>
    <path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15l1.5-2z" />
    <path d="M10 20.5a2 2 0 004 0" />
  </Svg>
);
export const IconChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="M14.5 5.5L8 12l6.5 6.5" />
  </Svg>
);
export const IconChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="M6 9.5l6 6 6-6" />
  </Svg>
);
export const IconUserPlus = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="8.5" r="3.5" />
    <path d="M3.5 19.5c.7-3.4 3.3-5 6.5-5 1.6 0 3 .4 4.2 1.2M18 12.5v6M15 15.5h6" />
  </Svg>
);
export const IconUser = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 19.5c.8-3.4 3.6-5 7-5s6.2 1.6 7 5" />
  </Svg>
);
export const IconDocument = (p: P) => (
  <Svg {...p}>
    <path d="M7 3.5h7l4 4V20a.5.5 0 01-.5.5h-10.5a.5.5 0 01-.5-.5V4a.5.5 0 01.5-.5z" />
    <path d="M14 3.5v4h4M9.5 12h5M9.5 15.5h5" />
  </Svg>
);
export const IconBriefcase = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="7.5" width="17" height="12" rx="1.5" />
    <path d="M9 7.5V5.5a1 1 0 011-1h4a1 1 0 011 1v2M3.5 12.5h17" />
  </Svg>
);
export const IconSwap = (p: P) => (
  <Svg {...p}>
    <path d="M4 8.5h14M14.5 5l3.5 3.5-3.5 3.5M20 15.5H6M9.5 12L6 15.5 9.5 19" />
  </Svg>
);
export const IconCompass = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
  </Svg>
);
export const IconIdCard = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
    <circle cx="8.5" cy="11" r="2" />
    <path d="M5.5 16c.5-1.5 1.6-2.2 3-2.2s2.5.7 3 2.2M14 10h4.5M14 13.5h4.5" />
  </Svg>
);
export const IconSitemap = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="3.5" width="6" height="4.5" rx="1" />
    <rect x="3" y="16" width="6" height="4.5" rx="1" />
    <rect x="15" y="16" width="6" height="4.5" rx="1" />
    <path d="M12 8v4M6 16v-4h12v4" />
  </Svg>
);
export const IconWallet = (p: P) => (
  <Svg {...p}>
    <path d="M4 7.5A1.5 1.5 0 015.5 6H18v3" />
    <rect x="4" y="9" width="16" height="10.5" rx="1.5" />
    <path d="M16 14.2h.01" strokeWidth="2.4" />
  </Svg>
);
export const IconChart = (p: P) => (
  <Svg {...p}>
    <path d="M4 20h16M7 20v-6M12 20V6M17 20v-9" />
  </Svg>
);
export const IconHeart = (p: P) => (
  <Svg {...p}>
    <path d="M12 19.5s-7-4.3-7-9.3A3.7 3.7 0 0112 8a3.7 3.7 0 017 2.2c0 5-7 9.3-7 9.3z" />
  </Svg>
);
export const IconBook = (p: P) => (
  <Svg {...p}>
    <path d="M4 5.5c2.5-1 5.5-1 8 .5 2.5-1.5 5.5-1.5 8-.5V18c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5V5.5zM12 6v12.5" />
  </Svg>
);
export const IconTrend = (p: P) => (
  <Svg {...p}>
    <path d="M4 17l5.5-5.5 3.5 3.5L20 8M15 8h5v5" />
  </Svg>
);
export const IconPhone = (p: P) => (
  <Svg {...p}>
    <rect x="7" y="3" width="10" height="18" rx="2" />
    <path d="M11 17.5h2" />
  </Svg>
);

export const IconGrid = (p: P) => (
  <Svg {...p}>
    {[5, 12, 19].flatMap((y) => [5, 12, 19].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="currentColor" stroke="none" />))}
  </Svg>
);
