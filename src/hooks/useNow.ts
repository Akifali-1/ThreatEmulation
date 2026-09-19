import { useEffect, useState } from 'react'

/**
 * A clock that re-renders on an interval.
 *
 * Reading `Date.now()` during render is impure — React may render at any time and the value
 * would silently disagree with what was rendered before. Holding it in state keeps relative
 * timestamps ("5m ago") stable between renders and correct as time passes.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])

  return now
}
