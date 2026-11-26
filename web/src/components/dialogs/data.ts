import { useMemo } from 'react'
import { flattenFolders } from '@/lib/folders'
import { useConfigStore } from '@/store/configStore'
import { useLibraryStore } from '@/store/libraryStore'
import type { Preset } from '@/api/types'

/** 兜底模板（后端 /prompts 尚未返回时） */
export const FALLBACK_PRESETS: Preset[] = [
  { id: 'none', name: '仅转写（不润色）', description: '直接生成原始逐字稿', builtin: true, system_prompt: '' },
  { id: 'light', name: '轻度纠错', description: '只改错别字与标点', builtin: true, system_prompt: '' },
  { id: 'medium', name: '中度润色（推荐）', description: '去口语词、理顺语序', builtin: true, system_prompt: '' },
  { id: 'heavy', name: '重度精修', description: '转为正式书面文稿', builtin: true, system_prompt: '' },
  { id: 'minutes', name: '结构化纪要', description: '摘要 + 分点论述', builtin: true, system_prompt: '' },
]

export function usePresets(): Preset[] {
  const presets = useConfigStore((s) => s.presets)
  return presets.length ? presets : FALLBACK_PRESETS
}

export function useFolderOptions() {
  const folders = useLibraryStore((s) => s.folders)
  return useMemo(() => flattenFolders(folders), [folders])
}
