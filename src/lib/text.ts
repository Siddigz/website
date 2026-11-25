/** Counts the words a reader sees in a Markdown string: headings and markup do not count. */
export function wordCount(markdown: string): number {
  return markdown
    .split('\n')
    .filter((line) => !/^\s*#{1,6}\s/.test(line))
    .join(' ')
    .replace(/\]\([^)]*\)/g, ' ')
    .replace(/[*_`[\]>]/g, ' ')
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}
