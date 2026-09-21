import { Link, NavLink } from 'react-router'

import { NAV_GROUPS } from '../../lib/nav'
import { Icon } from '../ui/Icon'

/**
 * Left navigation.
 *
 * Full width with labels from `lg` up; collapses to an icon rail on tablet. Both states are
 * the same DOM — only the label visibility changes — so there's no JS state to desync.
 */
interface SidebarProps {
  /** Manual collapse from the top bar. Forces the icon rail at every width. */
  collapsed: boolean
}

export function Sidebar({ collapsed }: SidebarProps) {
  // When collapsed the labels are hidden at every width. Otherwise they follow the `lg`
  // breakpoint, so narrow screens still get the rail with no state involved.
  const groupLabel = collapsed ? 'hidden' : 'hidden lg:block'

  return (
    <nav
      aria-label="Sections"
      className={`flex shrink-0 flex-col border-r border-chrome-border bg-chrome ${
        collapsed ? 'w-14' : 'w-14 lg:w-[228px]'
      }`}
    >
      {/* The brand doubles as the way back to the landing page — the cover renders outside the
          shell, so without this there is no route to it from any tab. */}
      <Link
        to="/"
        title="Back to the landing page"
        className="flex h-12 shrink-0 items-center gap-2.5 border-b border-chrome-border px-3 transition-colors hover:bg-chrome-2 lg:px-4"
      >
        <Mark />
        <div className={`min-w-0 ${groupLabel}`}>
          <p className="truncate text-[12px] font-semibold leading-tight text-chrome-ink">
            Threat Emulation
          </p>
          <p className="truncate text-[10px] leading-tight text-chrome-ink-muted">
            Agentic AI red/blue research
          </p>
        </div>
      </Link>

      <div className="scroll-thin flex-1 overflow-y-auto py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            <p
              className={`px-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-chrome-ink-muted ${groupLabel}`}
            >
              {group.label}
            </p>
            <ul>
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    title={item.label}
                    className={({ isActive }) =>
                      `mx-2 flex items-center gap-2.5 rounded px-2.5 py-1.5 text-[12.5px] transition-colors ${
                        isActive
                          ? 'bg-blue-tint font-medium text-blue'
                          : 'text-chrome-ink-muted hover:bg-chrome-2 hover:text-chrome-ink'
                      }`
                    }
                  >
                    <Icon name={item.icon} size={15} className="shrink-0" />
                    <span className={`truncate ${collapsed ? 'hidden' : 'hidden lg:inline'}`}>
                      {item.label}
                    </span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}

/** Simple chevron-in-shield mark. Drawn rather than imported so there's no asset dependency. */
function Mark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6 shrink-0 text-blue"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2.6 4.6 5.6v5.9c0 4.5 3.1 8.4 7.4 9.9 4.3-1.5 7.4-5.4 7.4-9.9V5.6z" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" strokeLinecap="round" />
    </svg>
  )
}
