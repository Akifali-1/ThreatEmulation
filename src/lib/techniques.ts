/**
 * MITRE ATT&CK mapping for the Caldera abilities this project runs.
 *
 * The backend reports Caldera's own ability names (`Test-Registry`), not ATT&CK IDs, so the
 * mapping lives here rather than coming from the API. Unknown techniques degrade gracefully:
 * `describeTechnique` falls back to the raw name with a null id, so a new ability added to
 * the Caldera profile shows up in the UI immediately without a frontend change.
 */

export interface TechniqueMeta {
  /** ATT&CK technique ID, e.g. T1547.001. */
  mitreId: string
  /** Human-readable ATT&CK name. */
  name: string
  /** ATT&CK tactic this technique is filed under. */
  tactic: string
  /** Short one-line description of what the ability does. */
  summary: string
}

const TECHNIQUES: Record<string, TechniqueMeta> = {
  'Test-Registry': {
    mitreId: 'T1547.001',
    name: 'Registry Run Keys / Startup Folder',
    tactic: 'Persistence',
    summary: 'Writes a Run key so the payload executes at user logon.',
  },
  'Test-Baseline': {
    mitreId: 'T1059.001',
    name: 'PowerShell',
    tactic: 'Execution',
    summary: 'Baseline command-and-scripting interpreter execution.',
  },
  'Test-PrivEsc': {
    mitreId: 'T1548.002',
    name: 'Bypass User Account Control',
    tactic: 'Privilege Escalation',
    summary: 'Attempts to elevate without a UAC prompt.',
  },
  'Test-DefenseEvasion': {
    mitreId: 'T1070.003',
    name: 'Clear Command History',
    tactic: 'Defense Evasion',
    summary: 'Clears shell history to remove execution traces.',
  },
  'Test-CredAccess': {
    mitreId: 'T1552.002',
    name: 'Credentials in Registry',
    tactic: 'Credential Access',
    summary: 'Searches registry hives for stored credentials.',
  },
  'Test-Discovery': {
    mitreId: 'T1057',
    name: 'Process Discovery',
    tactic: 'Discovery',
    summary: 'Enumerates running processes to map the host.',
  },
}

export interface ResolvedTechnique extends TechniqueMeta {
  /** The raw name exactly as the API returned it — always safe to display. */
  raw: string
  /** False when this technique has no ATT&CK mapping yet. */
  mapped: boolean
}

const UNMAPPED: TechniqueMeta = {
  mitreId: '',
  name: 'Unmapped technique',
  tactic: 'Unmapped',
  summary: 'No ATT&CK mapping is defined for this Caldera ability yet.',
}

export function describeTechnique(raw: string): ResolvedTechnique {
  const meta = TECHNIQUES[raw]
  if (meta) return { ...meta, raw, mapped: true }
  return { ...UNMAPPED, raw, mapped: false }
}

/** Stable sort order for technique lists: by ATT&CK ID, unmapped names last. */
export function compareTechniques(a: string, b: string): number {
  const left = describeTechnique(a)
  const right = describeTechnique(b)
  if (!left.mapped && !right.mapped) return a.localeCompare(b)
  if (!left.mapped) return 1
  if (!right.mapped) return -1
  return left.mitreId.localeCompare(right.mitreId)
}

export function techniqueLabel(raw: string): string {
  const meta = describeTechnique(raw)
  return meta.mapped ? meta.name : raw
}
