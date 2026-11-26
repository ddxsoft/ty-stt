import type { FolderNode } from '@/api/types'

export interface FlatFolder {
  path: string
  name: string
  depth: number
  doc_count: number
}

/** 展开为带层级的扁平列表（不含根） */
export function flattenFolders(root: FolderNode | null): FlatFolder[] {
  const out: FlatFolder[] = []
  const walk = (n: FolderNode, depth: number) => {
    for (const c of n.children ?? []) {
      out.push({ path: c.path, name: c.name, depth, doc_count: c.doc_count })
      walk(c, depth + 1)
    }
  }
  if (root) walk(root, 0)
  return out
}

export function folderLabel(path: string): string {
  return path ? path.split('/').join(' / ') : '根目录'
}
