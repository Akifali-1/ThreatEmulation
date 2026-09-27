import { useMemo, useState } from 'react'

import { PageHeader } from '../components/layout/PageHeader'
import { ResultBadge } from '../components/domain/ResultBadge'
import { TechniqueLabel } from '../components/domain/TechniqueLabel'
import { TrialDetail } from '../components/domain/TrialDetail'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Drawer } from '../components/ui/Drawer'
import { EmptyState } from '../components/ui/EmptyState'
import { Field, Input, Select, ToggleGroup } from '../components/ui/Field'
import { Table, type Column, type SortState } from '../components/ui/Table'
import { useTrialsData } from '../hooks/useTrialsData'
import { csvFilename, downloadCsv, toCsv, type CsvColumn } from '../lib/csv'
import { formatCount, formatDateTime, formatDay, formatDelay, formatSeconds } from '../lib/format'
import { compareNullable } from '../lib/metrics/tpr'
import { compareTechniques, describeTechnique } from '../lib/techniques'
import type { Mode, Trial } from '../lib/api/types'

type ResultFilter = 'all' | 'detected' | 'missed'
type SortKey = 'start_time' | 'technique' | 'delay_used' | 'detected' | 'time_to_detect' | 'num_alerts'

const DEFAULT_DIR: Record<SortKey, 'asc' | 'desc'> = {
  start_time: 'desc',
  technique: 'asc',
  delay_used: 'desc',
  detected: 'desc',
  time_to_detect: 'asc',
  num_alerts: 'desc',
}

function trialKey(trial: Trial): string {
  return `${trial.start_time}|${trial.technique}`
}

function compareTrials(a: Trial, b: Trial, key: SortKey): number {
  switch (key) {
    case 'start_time':
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    case 'technique':
      return compareTechniques(a.technique, b.technique)
    case 'delay_used':
      return compareNullable(a.delay_used ?? null, b.delay_used ?? null)
    case 'detected':
      return Number(a.detected) - Number(b.detected)
    case 'time_to_detect':
      return compareNullable(a.time_to_detect ?? null, b.time_to_detect ?? null)
    case 'num_alerts':
      return (a.num_alerts ?? 0) - (b.num_alerts ?? 0)
    default:
      return 0
  }
}

/** The trial's local day, for date-range filtering. */
function dayKey(iso: string): string {
  // Local, not scattered from the ISO string: the table shows local timestamps, so bucketing by
  // UTC day would exclude a trial from the range its own displayed date falls in.
  return formatDay(iso)
}

export default function Trials() {
  const [mode, setMode] = useState<Mode>('agentic')
  const { trials, loading, error, refetch } = useTrialsData(mode)

  const [technique, setTechnique] = useState('all')
  const [result, setResult] = useState<ResultFilter>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState<SortState>({ key: 'start_time', dir: 'desc' })
  const [selected, setSelected] = useState<Trial | null>(null)

  const techniqueOptions = useMemo(() => {
    const unique = [...new Set(trials.map((t) => t.technique))]
    return unique.sort(compareTechniques)
  }, [trials])

  const filtered = useMemo(() => {
    return trials.filter((trial) => {
      if (technique !== 'all' && trial.technique !== technique) return false
      if (result === 'detected' && !trial.detected) return false
      if (result === 'missed' && trial.detected) return false

      const day = dayKey(trial.start_time)
      if (from && day < from) return false
      if (to && day > to) return false
      return true
    })
  }, [trials, technique, result, from, to])

  const sorted = useMemo(() => {
    const key = sort.key as SortKey
    const factor = sort.dir === 'asc' ? 1 : -1
    return filtered
      .map((trial, index) => ({ trial, index }))
      .sort((a, b) => {
        const delta = compareTrials(a.trial, b.trial, key)
        return delta !== 0 ? delta * factor : a.index - b.index
      })
      .map((entry) => entry.trial)
  }, [filtered, sort])

  const filtersActive = technique !== 'all' || result !== 'all' || from !== '' || to !== ''

  // Switching column starts from that column's natural direction (newest first for dates and
  // largest first for counts); re-clicking the active column just flips it.
  const handleSortChange = (next: SortState) => {
    if (next.key === sort.key) {
      setSort(next)
      return
    }
    setSort({ key: next.key, dir: DEFAULT_DIR[next.key as SortKey] ?? 'asc' })
  }

  const clearFilters = () => {
    setTechnique('all')
    setResult('all')
    setFrom('')
    setTo('')
  }

  const exportCsv = () => {
    const columns: CsvColumn<Trial>[] = [
      { key: 'technique', label: 'technique', value: (t) => t.technique },
      { key: 'mitre_id', label: 'mitre_id', value: (t) => describeTechnique(t.technique).mitreId },
      { key: 'mode', label: 'mode', value: () => mode },
      { key: 'start_time', label: 'start_time', value: (t) => t.start_time },
      { key: 'detected', label: 'detected', value: (t) => t.detected },
      { key: 'time_to_detect', label: 'time_to_detect_s', value: (t) => t.time_to_detect },
      { key: 'num_alerts', label: 'num_alerts', value: (t) => t.num_alerts },
      { key: 'delay_used', label: 'delay_used_s', value: (t) => t.delay_used ?? '' },
      { key: 'reasoning', label: 'reasoning', value: (t) => t.reasoning ?? '' },
    ]
    downloadCsv(csvFilename('trials', mode), toCsv(sorted, columns))
  }

  // Static trials never carry an injected delay; showing the column would be a column of dashes.
  const showDelay = mode === 'agentic' && sorted.some((t) => t.delay_used != null)

  const columns: Column<Trial>[] = [
    {
      key: 'start_time',
      header: 'Timestamp',
      width: 'w-[168px]',
      sortValue: (t) => new Date(t.start_time).getTime(),
      cell: (t) => (
        <span className="tnum font-mono text-[11px] text-ink-muted">{formatDateTime(t.start_time)}</span>
      ),
    },
    {
      key: 'technique',
      header: 'Technique',
      sortValue: (t) => describeTechnique(t.technique).mitreId || t.technique,
      cell: (t) => <TechniqueLabel technique={t.technique} />,
    },
    ...(showDelay
      ? [
          {
            key: 'delay_used',
            header: 'Delay',
            align: 'right' as const,
            width: 'w-[76px]',
            sortValue: (t: Trial) => t.delay_used ?? -1,
            cell: (t: Trial) => (
              <span className="tnum font-mono text-[11px] text-ink-muted">
                {formatDelay(t.delay_used)}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'detected',
      header: 'Result',
      width: 'w-[124px]',
      sortValue: (t) => Number(t.detected),
      cell: (t) => <ResultBadge detected={t.detected} />,
    },
    {
      key: 'time_to_detect',
      header: 'Time to detect',
      align: 'right',
      width: 'w-[112px]',
      sortValue: (t) => t.time_to_detect ?? Number.POSITIVE_INFINITY,
      cell: (t) => (
        <span className="tnum font-mono text-[11px] text-ink-muted">
          {formatSeconds(t.time_to_detect)}
        </span>
      ),
    },
    {
      key: 'num_alerts',
      header: 'Alerts',
      align: 'right',
      width: 'w-[72px]',
      sortValue: (t) => t.num_alerts ?? 0,
      cell: (t) => (
        <span className="tnum font-mono text-[11px] text-ink-muted">{formatCount(t.num_alerts)}</span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Trials"
        description={`Every recorded trial with the agent’s reasoning. Showing ${sorted.length} of ${trials.length}.`}
        actions={
          <>
            <ToggleGroup<Mode>
              ariaLabel="Trial mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'agentic', label: 'Agentic', activeClassName: 'text-red' },
                { value: 'static', label: 'Static', activeClassName: 'text-ink' },
              ]}
            />
            <Button size="sm" onClick={exportCsv} disabled={sorted.length === 0}>
              Export CSV
            </Button>
          </>
        }
      />

      <div className="space-y-4 p-5 lg:p-6">
        <Card title="Filters" subtitle="Applied to the table and to the CSV export">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <Field label="Technique">
              <Select
                value={technique}
                onChange={(event) => setTechnique(event.target.value)}
                aria-label="Filter by technique"
                className="min-w-[210px]"
              >
                <option value="all">All techniques</option>
                {techniqueOptions.map((name) => {
                  const meta = describeTechnique(name)
                  return (
                    <option key={name} value={name}>
                      {meta.mapped ? `${meta.mitreId} — ${meta.name}` : name}
                    </option>
                  )
                })}
              </Select>
            </Field>

            <Field label="Result">
              <ToggleGroup<ResultFilter>
                ariaLabel="Filter by result"
                value={result}
                onChange={setResult}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'detected', label: 'Detected' },
                  { value: 'missed', label: 'Not detected' },
                ]}
              />
            </Field>

            <Field label="From" hint="UTC">
              <Input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                aria-label="From date"
                className="w-[150px]"
              />
            </Field>

            <Field label="To" hint="UTC">
              <Input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                aria-label="To date"
                className="w-[150px]"
              />
            </Field>

            {filtersActive && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </Card>

        <Card
          title="Trial history"
          subtitle="Select a row to read the agent’s reasoning"
          flush
          actions={
            <span className="text-[11px] text-ink-faint">
              {sorted.length} row{sorted.length === 1 ? '' : 's'}
            </span>
          }
        >
          <Table<Trial>
            columns={columns}
            rows={sorted}
            rowKey={trialKey}
            sort={sort}
            onSortChange={handleSortChange}
            onRowClick={(trial) => setSelected(trial)}
            loading={loading}
            empty={
              error ? (
                <EmptyState
                  title="Could not load trials"
                  detail={error}
                  action={<Button size="sm" onClick={refetch}>Retry</Button>}
                />
              ) : (
                <EmptyState
                  title={filtersActive ? 'No trials match these filters' : 'No trials recorded for this mode'}
                  detail={
                    filtersActive
                      ? 'Widen the date range or clear the technique filter.'
                      : 'Start a batch run from Live Operations.'
                  }
                  action={
                    filtersActive ? (
                      <Button size="sm" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    ) : undefined
                  }
                />
              )
            }
          />
        </Card>
      </div>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? (describeTechnique(selected.technique).name) : ''}
        subtitle={selected ? formatDateTime(selected.start_time) : undefined}
      >
        {selected && <TrialDetail trial={selected} mode={mode} />}
      </Drawer>
    </>
  )
}
