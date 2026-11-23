'use client'

import React from 'react'

interface MarkdownContentProps {
  content: string
  className?: string
}

/**
 * Parses and renders inline markdown formatting:
 * - Bold: **text**
 * - Italic: *text*
 * - Code: `code`
 * - Links: [label](url)
 */
export function InlineMarkdown({ text }: { text: string }) {
  if (!text) return null

  // Regex matches: **bold**, `code`, *italic*, [label](url)
  const regex = /(\*\*[^*]+?\*\*|`[^`]+?`|\*[^*]+?\*|\[[^\]]+?\]\([^)]+?\))/g
  const parts = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        val: text.slice(lastIndex, match.index)
      })
    }

    const m = match[0]
    if (m.startsWith('**') && m.endsWith('**')) {
      parts.push({ type: 'bold', val: m.slice(2, -2) })
    } else if (m.startsWith('`') && m.endsWith('`')) {
      parts.push({ type: 'code', val: m.slice(1, -1) })
    } else if (m.startsWith('*') && m.endsWith('*')) {
      parts.push({ type: 'italic', val: m.slice(1, -1) })
    } else if (m.startsWith('[') && m.includes('](') && m.endsWith(')')) {
      const splitIdx = m.indexOf('](')
      const label = m.slice(1, splitIdx)
      const url = m.slice(splitIdx + 2, -1)
      parts.push({ type: 'link', val: label, url })
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', val: text.slice(lastIndex) })
  }

  return (
    <>
      {parts.map((p, i) => {
        if (p.type === 'bold') {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {p.val}
            </strong>
          )
        }
        if (p.type === 'code') {
          return (
            <code
              key={i}
              className="px-1.5 py-0.5 rounded-md bg-muted/80 border border-border/60 text-blue-600 dark:text-blue-400 font-mono text-[11px]"
            >
              {p.val}
            </code>
          )
        }
        if (p.type === 'italic') {
          return (
            <em key={i} className="italic text-foreground/90">
              {p.val}
            </em>
          )
        }
        if (p.type === 'link') {
          return (
            <a
              key={i}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              {p.val}
            </a>
          )
        }
        return <span key={i}>{p.val}</span>
      })}
    </>
  )
}

/**
 * Parses markdown text into structured blocks:
 * - Code Blocks (```)
 * - Tables (| col | col |)
 * - Headings (#, ##, ###, ####)
 * - Unordered lists (*, -)
 * - Numbered lists (1., 2.)
 * - Blockquotes (>)
 * - Horizontal rules (---)
 * - Standard paragraphs
 */
export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  if (!content) return null

  // 1. Separate code blocks from regular text
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g
  const segments: { type: 'code' | 'markdown'; lang?: string; text: string }[] = []
  let lastIdx = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ type: 'markdown', text: content.slice(lastIdx, match.index) })
    }
    segments.push({
      type: 'code',
      lang: match[1] || '',
      text: match[2].trimEnd()
    })
    lastIdx = codeBlockRegex.lastIndex
  }
  if (lastIdx < content.length) {
    segments.push({ type: 'markdown', text: content.slice(lastIdx) })
  }

  return (
    <div className={`space-y-3 select-text ${className}`}>
      {segments.map((seg, sIdx) => {
        if (seg.type === 'code') {
          return (
            <div
              key={sIdx}
              className="my-3 rounded-xl border border-border/80 bg-muted/70 p-3.5 text-xs font-mono overflow-x-auto shadow-2xs"
            >
              {seg.lang && (
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">
                  {seg.lang}
                </div>
              )}
              <pre className="text-foreground leading-relaxed">
                <code>{seg.text}</code>
              </pre>
            </div>
          )
        }

        return <MarkdownBlockGroup key={sIdx} text={seg.text} />
      })}
    </div>
  )
}

function MarkdownBlockGroup({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: React.ReactNode[] = []

  let i = 0
  while (i < lines.length) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    // Empty lines
    if (!trimmed) {
      i++
      continue
    }

    // Horizontal Rule
    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${i}`} className="border-border/70 my-3" />)
      i++
      continue
    }

    // Headings
    if (trimmed.startsWith('#')) {
      const h4Match = trimmed.match(/^####\s+(.*)/)
      if (h4Match) {
        blocks.push(
          <h4
            key={`h4-${i}`}
            className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-3 mb-1.5"
          >
            <InlineMarkdown text={h4Match[1]} />
          </h4>
        )
        i++
        continue
      }

      const h3Match = trimmed.match(/^###\s+(.*)/)
      if (h3Match) {
        blocks.push(
          <h3
            key={`h3-${i}`}
            className="text-sm sm:text-base font-semibold text-foreground mt-3.5 mb-1.5 flex items-center gap-2"
          >
            <InlineMarkdown text={h3Match[1]} />
          </h3>
        )
        i++
        continue
      }

      const h2Match = trimmed.match(/^##\s+(.*)/)
      if (h2Match) {
        blocks.push(
          <h2
            key={`h2-${i}`}
            className="text-base sm:text-lg font-bold text-foreground mt-4 mb-2 flex items-center gap-2"
          >
            <InlineMarkdown text={h2Match[1]} />
          </h2>
        )
        i++
        continue
      }

      const h1Match = trimmed.match(/^#\s+(.*)/)
      if (h1Match) {
        blocks.push(
          <h1
            key={`h1-${i}`}
            className="text-lg sm:text-xl font-bold text-foreground mt-4 mb-2"
          >
            <InlineMarkdown text={h1Match[1]} />
          </h1>
        )
        i++
        continue
      }
    }

    // Table: starts and ends with '|'
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim())
        i++
      }

      if (tableLines.length >= 2) {
        const headerCells = tableLines[0]
          .split('|')
          .slice(1, -1)
          .map(c => c.trim())

        const rowLines = tableLines.slice(1).filter(l => !/^[|\s-:]+$/.test(l))
        const rows = rowLines.map(line =>
          line
            .split('|')
            .slice(1, -1)
            .map(c => c.trim())
        )

        blocks.push(
          <div
            key={`table-${i}`}
            className="my-3 overflow-x-auto rounded-xl border border-border/80 bg-card/60 shadow-2xs"
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/70 text-muted-foreground border-b border-border/70 font-semibold">
                <tr>
                  {headerCells.map((h, cIdx) => (
                    <th key={cIdx} className="px-3.5 py-2.5 font-medium">
                      <InlineMarkdown text={h} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {rows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3.5 py-2.5 text-foreground leading-normal">
                        <InlineMarkdown text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
        continue
      }
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''))
        i++
      }

      blocks.push(
        <div
          key={`quote-${i}`}
          className="my-2.5 p-3 rounded-xl border border-primary/20 bg-primary/5 text-xs text-foreground leading-relaxed"
        >
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx} className={qIdx > 0 ? 'mt-1' : ''}>
              <InlineMarkdown text={ql} />
            </p>
          ))}
        </div>
      )
      continue
    }

    // Unordered List (* or -)
    if (/^[\*\-]\s+(.*)/.test(trimmed)) {
      const listItems: string[] = []
      while (i < lines.length && /^[\*\-]\s+(.*)/.test(lines[i].trim())) {
        const itemMatch = lines[i].trim().match(/^[\*\-]\s+(.*)/)
        if (itemMatch) listItems.push(itemMatch[1])
        i++
      }

      blocks.push(
        <ul key={`ul-${i}`} className="space-y-1.5 my-2 pl-0.5">
          {listItems.map((item, lIdx) => (
            <li key={lIdx} className="flex items-start gap-2.5 text-xs sm:text-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400 shrink-0 mt-2" />
              <div className="flex-1 text-foreground leading-relaxed">
                <InlineMarkdown text={item} />
              </div>
            </li>
          ))}
        </ul>
      )
      continue
    }

    // Numbered List (1., 2.)
    if (/^\d+\.\s+(.*)/.test(trimmed)) {
      const listItems: string[] = []
      while (i < lines.length && /^\d+\.\s+(.*)/.test(lines[i].trim())) {
        const itemMatch = lines[i].trim().match(/^\d+\.\s+(.*)/)
        if (itemMatch) listItems.push(itemMatch[1])
        i++
      }

      blocks.push(
        <ol key={`ol-${i}`} className="space-y-1.5 my-2 pl-0.5">
          {listItems.map((item, lIdx) => (
            <li key={lIdx} className="flex items-start gap-2.5 text-xs sm:text-sm">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 shrink-0 min-w-4 text-right">
                {lIdx + 1}.
              </span>
              <div className="flex-1 text-foreground leading-relaxed">
                <InlineMarkdown text={item} />
              </div>
            </li>
          ))}
        </ol>
      )
      continue
    }

    // Regular paragraph
    blocks.push(
      <p key={`p-${i}`} className="text-xs sm:text-sm leading-relaxed text-foreground">
        <InlineMarkdown text={trimmed} />
      </p>
    )
    i++
  }

  return <>{blocks}</>
}
