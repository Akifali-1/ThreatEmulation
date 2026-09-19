import { Fragment, useMemo, type ReactNode } from 'react'

/**
 * Minimal markdown renderer for the Blue Agent's free-form proposal text.
 *
 * Deliberately not a full CommonMark implementation — it covers what the LLM actually emits
 * (bold, inline code, headings, bullet/numbered lists, paragraphs) so the panels stay readable
 * without pulling in a parser. Anything unrecognised is rendered as plain text.
 */

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }

// Bold before italic so `**x**` isn't mis-parsed as an empty italic span.
const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let cursor = 0
  let index = 0
  let match: RegExpExecArray | null

  INLINE_PATTERN.lastIndex = 0
  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index))

    const token = match[0]
    const key = `${keyPrefix}-i${index++}`
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith('*')) {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      )
    } else {
      nodes.push(
        <code
          key={key}
          className="rounded border border-line bg-surface-alt px-1 py-px font-mono text-[11px] text-ink"
        >
          {token.slice(1, -1)}
        </code>,
      )
    }
    cursor = match.index + token.length
  }

  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = []
  const lines = source.replace(/\r\n/g, '\n').split('\n')

  let paragraph: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', text: paragraph.join(' ') })
      paragraph = []
    }
  }
  const flushList = () => {
    if (list) {
      blocks.push({ kind: 'list', ordered: list.ordered, items: list.items })
      list = null
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (line.trim() === '') {
      // Blank lines end a paragraph but NOT a list: the LLM writes loose lists, putting a
      // blank line between items. Flushing here would restart the numbering at 1 for every
      // item. The list closes when a non-list line (or a different list style) shows up.
      flushParagraph()
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      flushParagraph()
      flushList()
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] })
      continue
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      flushParagraph()
      const ordered = Boolean(numbered)
      // A switch between list styles starts a new list rather than merging.
      if (list && list.ordered !== ordered) flushList()
      if (!list) list = { ordered, items: [] }
      list.items.push((bullet ?? numbered)![1])
      continue
    }

    flushList()
    paragraph.push(line.trim())
  }

  flushParagraph()
  flushList()
  return blocks
}

const HEADING_SIZE: Record<number, string> = {
  1: 'text-[14px]',
  2: 'text-[13px]',
  3: 'text-[12.5px]',
}

export function MarkdownLite({ text, className = '' }: { text: string; className?: string }) {
  const blocks = useMemo(() => parseBlocks(text), [text])

  return (
    <div className={`space-y-2 text-[12.5px] leading-relaxed text-ink-muted ${className}`}>
      {blocks.map((block, blockIndex) => {
        const key = `b${blockIndex}`

        if (block.kind === 'heading') {
          return (
            <p
              key={key}
              className={`font-semibold text-ink ${HEADING_SIZE[block.level] ?? 'text-[12.5px]'}`}
            >
              {renderInline(block.text, key)}
            </p>
          )
        }

        if (block.kind === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul'
          return (
            <ListTag
              key={key}
              className={`ml-4 space-y-1 ${block.ordered ? 'list-decimal' : 'list-disc'}`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`} className="pl-0.5">
                  {renderInline(item, `${key}-${itemIndex}`)}
                </li>
              ))}
            </ListTag>
          )
        }

        return (
          <p key={key}>
            {renderInline(block.text, key).map((node, i) => (
              <Fragment key={i}>{node}</Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
