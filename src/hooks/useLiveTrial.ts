import { useMemo } from 'react'

import type { LogEntry, RunMode, Trial } from '../lib/api/types'
import {
  extractPlanned,
  extractTrial,
  extractWaiting,
  readBatchMode,
  type PlannedInfo,
  type WaitingInfo,
} from '../lib/logs'

/**
 * Steps that close out whatever trial was open.
 *
 * A WAITING frame starts a countdown only the client can tick, so anything meaning "that wait is
 * over" has to be able to stop it. TRIAL_PLANNED is deliberately *not* here — it opens a trial
 * rather than closing one, and requiring an open trial is what lets an out-of-order WAITING be
 * told apart from a new one.
 */
const CLOSES_TRIAL = new Set(['TRIAL_COMPLETE', 'RED_RESULT', 'ERROR', 'BATCH_START', 'BATCH_COMPLETE'])

export interface LiveTrial {
  /** True while the most recent batch boundary in scope is a start. */
  running: boolean
  /** Which arm the current batch is: only "agentic" runs have an agent behind the plan. */
  mode: RunMode | null
  /** Arrival time of the current batch's start, or null when nothing has started. */
  startedAt: number | null
  completed: number
  /** Technique the agent has announced for the trial in flight. */
  planned: PlannedInfo | null
  /** The wait in progress, with the moment the client should stop counting. */
  waiting: (WaitingInfo & { endsAt: number; entryId: number }) | null
  latestTrial: Trial | null
}

/**
 * Folds the log buffer into the state of the trial currently in flight.
 *
 * `now` is deliberately not a parameter: the tick interval depends on whether anything is
 * actually counting, which would be a cycle if this hook consumed the clock whose rate it
 * decides. Elapsed and remaining are derived from these results in the component instead.
 */
export function useLiveTrial(entries: LogEntry[], fromIndex: number | null): LiveTrial {
  return useMemo(() => {
    // Anchoring to the tail of the buffer when a run starts keeps the previous batch's frames out
    // of scope. Opened mid-run there is no anchor, and the replay buffer deliberately hands a
    // fresh page the recent frames — so scope to the current batch explicitly. Counting every
    // TRIAL_COMPLETE in the buffer reports more completions than the batch has trials.
    const anchored = fromIndex === null ? entries : entries.slice(fromIndex)

    let batchStart = -1
    for (let i = anchored.length - 1; i >= 0; i -= 1) {
      if (anchored[i].step === 'BATCH_START') {
        batchStart = i
        break
      }
    }
    const since = batchStart >= 0 ? anchored.slice(batchStart) : anchored

    let boundary: LogEntry | null = null
    let startedAt: number | null = null
    let mode: RunMode | null = null
    let planned: PlannedInfo | null = null
    let waiting: WaitingInfo | null = null
    let waitingEndsAt = 0
    let waitingEntryId = -1

    let plannedIdx = -1
    let waitingIdx = -1
    let closesIdx = -1
    let completed = 0
    let latestTrial: Trial | null = null

    for (let i = 0; i < since.length; i += 1) {
      const entry = since[i]

      if (entry.step === 'BATCH_START') {
        boundary = entry
        mode = readBatchMode(entry)
        // Local arrival, not the frame's timestamp. The backend sends naive timestamps with no
        // zone, so parsing one interprets it as local and the elapsed clock inherits the whole
        // UTC offset. See LogEntry.receivedAt.
        startedAt = entry.receivedAt
      } else if (entry.step === 'BATCH_COMPLETE') {
        boundary = entry
      }

      if (entry.step === 'TRIAL_PLANNED') {
        const parsed = extractPlanned(entry.extra)
        if (parsed) {
          planned = parsed
          plannedIdx = i
        }
      }

      /*
       * A closed-loop cycle opens like a trial: it names a technique and is followed by a WAITING
       * frame the client has to tick. Treating CYCLE_START as the opener is what lets the shared
       * countdown machinery run for closed-loop without a TRIAL_PLANNED frame that never comes.
       */
      if (entry.step === 'CYCLE_START') {
        const extra = (entry.extra ?? {}) as Record<string, unknown>
        if (typeof extra.technique === 'string' && extra.technique !== '') {
          planned = { technique: extra.technique, delay: null, trial: null, total: null }
        }
        plannedIdx = i
      }

      if (entry.step === 'WAITING') {
        const parsed = extractWaiting(entry.extra)
        if (parsed) {
          waiting = parsed
          waitingIdx = i
          waitingEntryId = entry.id
          // Local arrival, not the frame's own timestamp — see LogEntry.receivedAt.
          waitingEndsAt = entry.receivedAt + parsed.seconds * 1000
        }
      }

      if (entry.step === 'TRIAL_COMPLETE') {
        completed += 1
        latestTrial = extractTrial(entry.extra) ?? latestTrial
      }

      if (CLOSES_TRIAL.has(entry.step)) closesIdx = i
    }

    /*
     * A wait is live only if it belongs to a trial that is currently open — planned, and not yet
     * closed. Testing `waitingIdx > plannedIdx > closesIdx` rather than just "the last wait is
     * the last frame" is what catches an out-of-order frame: a WAITING arriving after its own
     * TRIAL_COMPLETE has no open trial ahead of it, so it is ignored rather than starting a
     * countdown against a trial that already finished.
     */
    const isLive = waitingIdx > plannedIdx && plannedIdx > closesIdx

    /*
     * Anchored: no boundary yet means a batch was just requested and its BATCH_START has not
     * arrived, so report running rather than flashing Idle on the click.
     * Unanchored: the whole buffer is in scope, and no boundary genuinely means nothing has run.
     */
    const running = boundary === null ? fromIndex !== null : boundary.step === 'BATCH_START'

    return {
      running,
      mode,
      startedAt,
      completed,
      planned,
      waiting: isLive && waiting ? { ...waiting, endsAt: waitingEndsAt, entryId: waitingEntryId } : null,
      latestTrial,
    }
  }, [entries, fromIndex])
}
