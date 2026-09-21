import { Outlet, useLocation } from 'react-router'
import { Suspense, useEffect, useRef } from 'react'

import { HealthProvider } from '../../context/HealthContext'
import { SocketProvider } from '../../context/SocketContext'
import { useSidebarCollapsed } from '../../hooks/useSidebarCollapsed'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { PageFallback } from './PageFallback'

/**
 * Application frame: chrome (sidebar + status bar) around a scrolling content region. Providers
 * live here so the single WebSocket and the status poll are mounted once for the whole app
 * rather than per route.
 *
 * The sidebar's collapse state is owned here because it is the lowest common ancestor of the
 * two things that need it — the sidebar that reads it and the top bar button that writes it.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const { collapsed, toggle } = useSidebarCollapsed()

  // Reset scroll on navigation — a long table shouldn't leave the next page scrolled halfway.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <HealthProvider>
      <SocketProvider>
        <div className="flex h-full overflow-hidden">
          <Sidebar collapsed={collapsed} />

          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar sidebarCollapsed={collapsed} onToggleSidebar={toggle} />
            <main ref={mainRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto bg-bg">
              <Suspense fallback={<PageFallback />}>
                <Outlet />
              </Suspense>
            </main>
          </div>
        </div>
      </SocketProvider>
    </HealthProvider>
  )
}
