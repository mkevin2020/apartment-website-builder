// The chat widget renders replies as plain text, so any markdown the model emits
// shows up literally as **stars** and |pipe|tables|. We ask it not to use markdown
// in the system prompt, but models drift back to it — this is the safety net that
// runs on every reply before it hits the screen.

/** Turn a markdown table row into a readable line: "kevin — 1 bed — RWF 1,200" */
function tableRowToLine(line: string): string {
  const cells = line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
  return cells.join(" — ")
}

export function stripMarkdown(text: string): string {
  if (!text) return ""

  const out: string[] = []
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trimEnd()

    // Drop table separator rows like |---|:---:|---|
    if (/\|/.test(line) && /^[\s|:-]+$/.test(line) && /--/.test(line)) continue

    // Flatten table rows into a single readable line
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const flattened = tableRowToLine(line)
      if (flattened) out.push(flattened)
      continue
    }

    out.push(line)
  }

  return out
    .join("\n")
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/^\s{0,3}[-*+]\s+/gm, "• ") // bullets (before italics, so "* item" is safe)
    .replace(/^\s*>\s?/gm, "") // blockquotes
    .replace(/^\s*(?:-\s*){3,}\s*$/gm, "") // horizontal rules
    .replace(/```[a-z]*\n?([\s\S]*?)```/g, "$1") // fenced code
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> label
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1") // bold italic
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*/g, "$1$2") // italic
    .replace(/__(.+?)__/g, "$1") // bold (underscore)
    .replace(/`([^`\n]+)`/g, "$1") // inline code
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
