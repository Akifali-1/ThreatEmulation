import type { IconName } from '../components/ui/Icon'

export interface NavItem {
  to: string
  label: string
  icon: IconName
  /** Match the path exactly (used for the index route so it doesn't match every child). */
  end?: boolean
  /** Shown in the top bar as a one-line description of what the page covers. */
  description: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/**
 * Navigation is grouped by what the reader is doing, not by what the code does.
 *
 * Pipeline Health sits under System rather than with the analysis pages: it is infrastructure
 * status, and grouping it with Trials/Techniques implied it was part of the analytical flow.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Monitor',
    items: [
      {
        to: '/overview',
        label: 'Overview',
        icon: 'overview',
        description: 'How the campaign is performing overall',
      },
      {
        to: '/live',
        label: 'Live',
        icon: 'live',
        description: 'Start a run and watch it happen',
      },
    ],
  },
  {
    label: 'Analyze',
    items: [
      {
        to: '/trials',
        label: 'Trials',
        icon: 'trials',
        description: 'Every recorded trial and the agent’s reasoning',
      },
      {
        to: '/techniques',
        label: 'Techniques',
        icon: 'techniques',
        description: 'Detection quality for each ATT&CK technique',
      },
      {
        to: '/compare',
        label: 'Compare',
        icon: 'compare',
        description: 'Agentic against the static baseline',
      },
      {
        to: '/closed-loop',
        label: 'Closed-Loop Results',
        icon: 'closedLoop',
        description: 'Every closed-loop cycle and the rule it produced',
      },
    ],
  },
  {
    label: 'Defense',
    items: [
      {
        to: '/gaps',
        label: 'Detection Gaps',
        icon: 'gap',
        description: 'Where detection is weakest',
      },
      {
        to: '/blue',
        label: 'Blue Agent',
        icon: 'blue',
        description: 'Proposed rules awaiting review',
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        to: '/health',
        label: 'Pipeline Health',
        icon: 'health',
        description: 'Whether the experiment pipeline is working',
      },
    ],
  },
  {
    label: 'Reference',
    items: [
      {
        to: '/reports',
        label: 'Reports',
        icon: 'reports',
        description: 'Figures generated for the written report',
      },
      {
        to: '/methodology',
        label: 'Methodology',
        icon: 'about',
        description: 'Architecture, approach and limitations',
      },
    ],
  },
]

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items)

export function findNavItem(pathname: string): NavItem | undefined {
  // Longest match wins so /techniques/T1057 resolves to Techniques, not another prefix.
  return [...NAV_ITEMS]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)))
}
