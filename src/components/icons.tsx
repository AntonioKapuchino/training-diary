import type { SVGProps } from 'react'

const base = (props: SVGProps<SVGSVGElement>) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
})

export const IconDiary = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="4" y="5" width="16" height="16" rx="3" />
    <path d="M8 3v4M16 3v4M4 10h16" />
  </svg>
)
export const IconChart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 19V5M4 19h16" />
    <path d="M8 15l3-4 3 2 4-6" />
  </svg>
)
export const IconDumbbell = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6.5 6.5l11 11" />
    <rect x="2.2" y="8.8" width="5" height="7" rx="1.6" transform="rotate(-45 4.7 12.3)" />
    <rect x="16.8" y="8.2" width="5" height="7" rx="1.6" transform="rotate(-45 19.3 11.7)" />
  </svg>
)
export const IconTemplate = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="7" height="7" rx="2" />
    <rect x="13" y="4" width="7" height="7" rx="2" />
    <rect x="4" y="13" width="7" height="7" rx="2" />
    <rect x="13" y="13" width="7" height="7" rx="2" />
  </svg>
)
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconBack = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M15 5l-7 7 7 7" /></svg>
)
export const IconTrash = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
  </svg>
)
export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
)
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M5 12l5 5L20 7" /></svg>
)
export const IconChevron = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M9 6l6 6-6 6" /></svg>
)
export const IconNote = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
    <path d="M8 9h8M8 13h6" />
  </svg>
)
export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="4" y="5" width="16" height="16" rx="3" />
    <path d="M8 3v4M16 3v4M4 10h16" />
  </svg>
)
export const IconFlame = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3c1 3-2 4-2 7a3 3 0 006 0c0-1-1-2-1-3 2 1 3 3 3 6a6 6 0 11-12 0c0-4 4-5 6-10z" />
  </svg>
)
export const IconSettings = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7.7 1.6 1.6 0 01-3.2 0 1.6 1.6 0 00-2.7-.7l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 004.6 15a1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1A1.6 1.6 0 004.6 9a1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1h.1a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" />
  </svg>
)
export const IconGrip = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
  </svg>
)
export const IconDownload = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" /></svg>
)
export const IconUpload = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 20V9m0 0l-4 4m4-4l4 4M5 5h14" /></svg>
)
