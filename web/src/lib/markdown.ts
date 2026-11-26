export interface OutlineItem {
  level: number
  text: string
  /** 1-based 行号 */
  line: number
}

/** 提取 ATX 标题（忽略围栏代码块） */
export function extractOutline(content: string): OutlineItem[] {
  const items: OutlineItem[] = []
  const lines = content.split('\n')
  let fence: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const f = l.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (f) {
      if (!fence) fence = f[1][0]
      else if (f[1][0] === fence) fence = null
      continue
    }
    if (fence) continue
    const m = l.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (m) {
      const text = m[2]
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[*_`~]/g, '')
        .trim()
      if (text) items.push({ level: m[1].length, text, line: i + 1 })
    }
  }
  return items
}

export const TABLE_TEMPLATE = '| 列 1 | 列 2 | 列 3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |'
