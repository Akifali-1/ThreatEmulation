import type { SVGProps } from 'react'

/**
 * Minimal line-icon set. Stroke-based, 16px grid, currentColor — deliberately plain so the
 * navigation reads as an instrument panel rather than a consumer app.
 */
export type IconName =
  | 'overview'
  | 'live'
  | 'trials'
  | 'techniques'
  | 'compare'
  | 'blue'
  | 'gap'
  | 'health'
  | 'reports'
  | 'about'
  | 'sun'
  | 'moon'
  | 'download'
  | 'refresh'
  | 'external'
  | 'chevronRight'
  | 'chevronDown'
  | 'check'
  | 'close'
  | 'alert'
  | 'search'
  | 'filter'

const PATHS: Record<IconName, string> = {
  overview: 'M2.5 2.5h5v5h-5zM8.5 2.5h5v3h-5zM8.5 6.5h5v7h-5zM2.5 8.5h5v5h-5z',
  live: 'M1.5 8h3l2-4.5 3 9 2-6 1.5 1.5h1.5',
  trials: 'M2.5 4h11M2.5 8h11M2.5 12h7',
  techniques: 'M8 1.5 14.5 5 8 8.5 1.5 5zM1.5 8 8 11.5 14.5 8M1.5 11 8 14.5 14.5 11',
  compare: 'M5.5 2.5v11M10.5 2.5v11M1.5 5.5h4M10.5 10.5h4',
  blue: 'M8 1.5 3 3.5v4.2c0 3.3 2.2 6.2 5 7.3 2.8-1.1 5-4 5-7.3V3.5z',
  gap: 'M12.7 3.8A6.5 6.5 0 1 0 8 14.5M8 1.5v3M8 8h.01',
  health: 'M1.5 8h3.5l1.5-3 2 6 1.5-3h4.5',
  reports: 'M2.5 13.5V8M6 13.5V3.5M9.5 13.5v-4M13 13.5v-7',
  about: 'M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM8 7.5v4M8 5h.01',
  sun: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.9 3.1l-1 1M4.1 11.9l-1 1M12.9 12.9l-1-1M4.1 4.1l-1-1',
  moon: 'M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z',
  download: 'M8 2v8M5 7.5 8 10.5l3-3M2.5 13h11',
  refresh: 'M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2v3h-3',
  external: 'M6.5 3h-3v10h10v-3M9.5 2.5h4v4M13.5 2.5 7.5 8.5',
  chevronRight: 'M6 3.5 10.5 8 6 12.5',
  chevronDown: 'M3.5 6 8 10.5 12.5 6',
  check: 'M3 8.5 6.5 12 13 4.5',
  close: 'M4 4l8 8M12 4l-8 8',
  alert: 'M8 2.5 1.5 13.5h13zM8 6.5v3M8 11.5h.01',
  search: 'M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM10.5 10.5 14 14',
  filter: 'M2 3.5h12L9.5 8.5v4l-3 1.5v-5.5z',
}

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
}

export function Icon({ name, size = 16, className = '', ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
