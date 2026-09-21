import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'te-sidebar-collapsed'

/**
 * Manual sidebar collapse, persisted across reloads.
 *
 * Distinct from the automatic rail below `lg`: that one is layout, this one is preference, and
 * the two only intersect at desktop widths. Defaults to expanded — the labels are the
 * discoverable state, so collapsing is the deliberate choice rather than the thing you have to
 * undo. Storage access is guarded because localStorage throws in some private-mode contexts,
 * where the toggle should still work for the session even if it cannot be remembered.
 */
export function useSidebarCollapsed(): { collapsed: boolean; toggle: () => void } {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      // Persistence is a nicety; ignore storage failures.
    }
  }, [collapsed])

  const toggle = useCallback(() => setCollapsed((value) => !value), [])

  return { collapsed, toggle }
}
