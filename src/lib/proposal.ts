/**
 * Splits a Blue Agent proposal into prose and rule-XML segments.
 *
 * The proposals arrive as one markdown-ish blob that sometimes embeds a Wazuh rule. Rendering
 * the whole thing as prose would make the rule unreadable, and rendering it all as code would
 * lose the emphasis in the rationale — so the two are separated and styled differently.
 *
 * Detection is line-based: a run of consecutive lines that each start with `<` and contain `>`
 * is treated as XML. This handles the contiguous rule blocks the agent actually emits; it will
 * split a block that has prose interleaved between its tags, which does not currently occur.
 */

export type ProposalSegment =
  | { kind: 'text'; content: string }
  | { kind: 'xml'; content: string }

const FENCE = /^\s*```/

export function splitProposal(proposal: string): ProposalSegment[] {
  const lines = proposal.replace(/\r\n/g, '\n').split('\n')
  const segments: ProposalSegment[] = []

  let buffer: string[] = []
  let mode: 'text' | 'xml' = 'text'

  const flush = () => {
    if (buffer.length === 0) return
    const content = buffer.join('\n').replace(/^\n+|\n+$/g, '')
    if (content.trim() !== '') segments.push({ kind: mode, content })
    buffer = []
  }

  for (const line of lines) {
    // A markdown fence toggles in and out of a code block; its contents are XML by convention.
    if (FENCE.test(line)) {
      flush()
      mode = mode === 'xml' ? 'text' : 'xml'
      continue
    }

    const trimmed = line.trim()
    const looksLikeXml = trimmed.startsWith('<') && trimmed.includes('>')
    const lineKind = mode === 'xml' || looksLikeXml ? 'xml' : 'text'

    if (lineKind !== mode) {
      flush()
      mode = lineKind
    }
    buffer.push(line)
  }

  flush()
  return segments
}
