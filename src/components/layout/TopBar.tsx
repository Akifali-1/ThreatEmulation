import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'

import { useHealth } from '../../context/HealthContext'
import { useLogStream } from '../../context/SocketContext'
import { useTheme } from '../../context/ThemeContext'
import { findNavItem } from '../../lib/nav'
import { Icon } from '../ui/Icon'

interface TopBarProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

/**
 * Persistent status bar.
 *
 * Carries the page title for orientation and a single aggregated health verdict. The previous
 * version listed every service separately, which turned the header into a second monitoring
 * dashboard competing with the page below it. Detail lives in the popover.
 *
 * Also owns the sidebar toggle. It sits here rather than on the sidebar's own edge because the
 * rail is only 56px wide when collapsed, which leaves no room for a hit target that survives
 * the collapse it triggers.
 */
export function TopBar({ sidebarCollapsed, onToggleSidebar }: TopBarProps) {
  const { pathname } = useLocation()
  const item = findNavItem(pathname)
  const { theme, toggle } = useTheme()
  const socket = useLogStream()
  const health = useHealth()

  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const socketUp = socket.status === 'open'
  const apiUp = health.reachable

  const overall = !health.checked && socket.status === 'connecting'
    ? { label: 'Checking systems', dot: 'bg-amber pulse' }
    : apiUp && socketUp
      ? { label: 'System operational', dot: 'bg-teal' }
      : apiUp || socketUp
        ? { label: 'Partial outage', dot: 'bg-amber' }
        : { label: 'Systems unreachable', dot: 'bg-red' }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-chrome-border bg-chrome px-5 lg:px-6">
      {/* Only meaningful at lg and up — below that the sidebar is a rail by layout, not choice. */}
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-pressed={sidebarCollapsed}
        className="hidden h-7 w-7 shrink-0 items-center justify-center rounded text-chrome-ink-muted transition-colors hover:bg-chrome-2 hover:text-chrome-ink lg:flex"
      >
        <Icon name="panel" size={15} />
      </button>

      <div className="min-w-0">
        <h1 className="t-card truncate text-chrome-ink">{item?.label ?? 'Not found'}</h1>
        <p className="t-secondary truncate text-chrome-ink-muted">{item?.description ?? ''}</p>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="relative" ref={containerRef}>
          <button
            type="button"
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => setOpen((value) => !value)}
            className="flex items-center gap-2 rounded px-2.5 py-1.5 transition-colors hover:bg-chrome-2"
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${overall.dot}`} aria-hidden="true" />
            <span className="t-secondary text-chrome-ink">{overall.label}</span>
            <Icon
              name="chevronDown"
              size={12}
              className={`text-chrome-ink-muted transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>

          {open && (
            <div
              role="dialog"
              aria-label="System status"
              className="absolute right-0 top-full z-30 mt-1.5 w-72 rounded-lg border border-border bg-surface p-4 shadow-lg"
            >
              <p className="t-card text-ink">System status</p>
              <dl className="mt-3 space-y-2.5">
                <StatusLine
                  name="Backend API"
                  state={!health.checked ? 'unknown' : apiUp ? 'up' : 'down'}
                  detail={
                    apiUp && health.connections !== null
                      ? `${health.connections} connection${health.connections === 1 ? '' : 's'}`
                      : undefined
                  }
                />
                <StatusLine
                  name="Live log stream"
                  state={socketUp ? 'up' : socket.status === 'connecting' ? 'unknown' : 'down'}
                />
                <StatusLine
                  name="Caldera"
                  state={
                    health.status?.caldera?.alive === undefined
                      ? 'unknown'
                      : health.status.caldera.alive
                        ? 'up'
                        : 'down'
                  }
                  detail={health.status?.caldera === undefined ? 'requires backend' : undefined}
                />
                <StatusLine
                  name="Wazuh"
                  state={
                    health.status?.wazuh?.reachable === undefined
                      ? 'unknown'
                      : health.status.wazuh.reachable
                        ? 'up'
                        : 'down'
                  }
                  detail={health.status?.wazuh === undefined ? 'requires backend' : undefined}
                />
              </dl>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={toggle}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          className="flex h-8 w-8 items-center justify-center rounded text-chrome-ink-muted transition-colors hover:bg-chrome-2 hover:text-chrome-ink"
        >
          <Icon name={theme === 'light' ? 'moon' : 'sun'} size={15} />
        </button>
      </div>
    </header>
  )
}

const DOT: Record<'up' | 'down' | 'unknown', string> = {
  up: 'bg-teal',
  down: 'bg-red',
  unknown: 'bg-ink-faint',
}

const LABEL: Record<'up' | 'down' | 'unknown', string> = {
  up: 'Reachable',
  down: 'Unreachable',
  unknown: 'Unknown',
}

function StatusLine({
  name,
  state,
  detail,
}: {
  name: string
  state: 'up' | 'down' | 'unknown'
  detail?: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[state]}`} aria-hidden="true" />
      <dt className="t-secondary flex-1 text-ink">{name}</dt>
      <dd className="t-secondary text-ink-muted">{detail ?? LABEL[state]}</dd>
    </div>
  )
}
