import { Fragment, type ReactNode } from 'react'

/**
 * Minimal XML highlighter for Wazuh rules.
 *
 * Hand-rolled rather than pulling in a syntax-highlighting dependency: the grammar here is
 * tiny (tags, attribute names, attribute values, text) and this keeps the bundle honest.
 */

const TAG_SOURCE = /(<\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*"[^"]*")*)\s*(\/?>)/g
const ATTR_SOURCE = /([\w:.-]+)(\s*=\s*)("[^"]*")/g

function renderAttributes(source: string, keyPrefix: string): ReactNode[] {
  // A fresh regex per call: a module-level /g regex carries lastIndex across calls, which
  // two components rendering in the same commit would corrupt for each other.
  const attr = new RegExp(ATTR_SOURCE.source, 'g')
  const nodes: ReactNode[] = []
  let cursor = 0
  let index = 0
  let match: RegExpExecArray | null

  while ((match = attr.exec(source)) !== null) {
    if (match.index > cursor) nodes.push(source.slice(cursor, match.index))
    nodes.push(
      <Fragment key={`${keyPrefix}-a${index++}`}>
        <span className="text-amber">{match[1]}</span>
        <span className="text-ink-faint">{match[2]}</span>
        <span className="text-teal">{match[3]}</span>
      </Fragment>,
    )
    cursor = match.index + match[0].length
  }

  if (cursor < source.length) nodes.push(source.slice(cursor))
  return nodes
}

export function RuleXml({ xml, className = '' }: { xml: string; className?: string }) {
  const tag = new RegExp(TAG_SOURCE.source, 'g')
  const nodes: ReactNode[] = []
  let cursor = 0
  let index = 0
  let match: RegExpExecArray | null

  while ((match = tag.exec(xml)) !== null) {
    if (match.index > cursor) {
      // Text between tags — typically a rule's condition or description value.
      nodes.push(
        <span key={`t${index}`} className="text-ink-muted">
          {xml.slice(cursor, match.index)}
        </span>,
      )
    }

    nodes.push(
      <Fragment key={`tag${index}`}>
        <span className="text-ink-faint">{match[1]}</span>
        <span className="text-blue">{match[2]}</span>
        {renderAttributes(match[3], `tag${index}`)}
        <span className="text-ink-faint">{match[4]}</span>
      </Fragment>,
    )

    cursor = match.index + match[0].length
    index += 1
  }

  if (cursor < xml.length) {
    nodes.push(
      <span key={`t${index}`} className="text-ink-muted">
        {xml.slice(cursor)}
      </span>,
    )
  }

  return (
    <pre
      className={`scroll-thin overflow-x-auto rounded border border-border bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed ${className}`}
    >
      <code>{nodes}</code>
    </pre>
  )
}
