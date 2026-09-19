import { NavLink } from 'react-router'

import { NAV_GROUPS } from '../../lib/nav'
import { Icon } from '../ui/Icon'

/**
 * Left navigation.
 *
 * Full width with labels from `lg` up; collapses to an icon rail on tablet. Both states are
 * the same DOM — only the label visibility changes — so there's no JS state to desync.
 */
export function Sidebar() {
  return (
    <nav
      aria-label="Sections"
      className="flex w-14 shrink-0 flex-col border-r border-navy-border bg-navy lg:w-[228px]"
    >
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-navy-border px-3 lg:px-4">
        <Mark />
        <div className="hidden min-w-0 lg:block">
          <p className="truncate text-[12px] font-semibold leading-tight text-navy-ink">
            Threat Emulation
          </p>
          <p className="truncate text-[10px] leading-tight text-navy-ink-muted">
            Agentic AI red/blue research
          </p>
        </div>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            <p className="hidden px-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-navy-ink-muted lg:block">
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
                      `relative flex items-center gap-2.5 px-3 py-1.5 text-[12.5px] transition-colors lg:px-4 ${
                        isActive
                          ? 'bg-navy-2 font-medium text-navy-ink'
                          : 'text-navy-ink-muted hover:bg-navy-2 hover:text-navy-ink'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span
                            className="absolute inset-y-0 left-0 w-0.5 bg-blue"
                            aria-hidden="true"
                          />
                        )}
                        <Icon name={item.icon} size={15} className="shrink-0" />
                        <span className="hidden truncate lg:inline">{item.label}</span>
                      </>
                    )}
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
