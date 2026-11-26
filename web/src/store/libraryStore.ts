import { create } from 'zustand'
import {
  createFolder as apiCreateFolder,
  deleteFolder as apiDeleteFolder,
  getFolders,
  renameFolder as apiRenameFolder,
} from '@/api/folders'
import { listDocuments } from '@/api/documents'
import { getErrorMessage, getErrorStatus } from '@/api/client'
import type { DocumentSummary, FolderNode } from '@/api/types'
import { useToastStore } from './toastStore'
import { confirmDialog } from './dialogStore'

interface LibraryState {
  folders: FolderNode | null
  documents: DocumentSummary[]
  /** '' = 全部文稿 */
  currentFolder: string
  query: string
  tag: string
  loadingDocs: boolean
  loadedOnce: boolean

  refreshFolders: () => Promise<void>
  refreshDocuments: () => Promise<void>
  refreshAll: () => Promise<void>
  setFolder: (path: string) => void
  setQuery: (q: string) => void
  setTag: (t: string) => void
  patchDocument: (d: DocumentSummary) => void
  removeDocument: (id: string) => void

  createFolder: (path: string) => Promise<boolean>
  renameFolder: (path: string, newName: string) => Promise<boolean>
  deleteFolder: (path: string) => Promise<boolean>
}

let docsReq = 0

function summary(d: DocumentSummary): DocumentSummary {
  return {
    doc_id: d.doc_id,
    title: d.title,
    path: d.path,
    folder: d.folder,
    tags: d.tags,
    created_at: d.created_at,
    updated_at: d.updated_at,
    duration_seconds: d.duration_seconds,
    has_audio: d.has_audio,
    has_transcript: d.has_transcript,
    snippet: d.snippet,
    char_count: d.char_count,
  }
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  folders: null,
  documents: [],
  currentFolder: '',
  query: '',
  tag: '',
  loadingDocs: false,
  loadedOnce: false,

  refreshFolders: async () => {
    try {
      set({ folders: await getFolders() })
    } catch (e) {
      useToastStore.getState().error('加载文件夹失败', getErrorMessage(e))
    }
  },

  refreshDocuments: async () => {
    const req = ++docsReq
    const { currentFolder, query, tag } = get()
    set({ loadingDocs: true })
    try {
      const docs = await listDocuments({ folder: currentFolder, q: query.trim(), tag })
      if (req === docsReq) set({ documents: docs, loadingDocs: false, loadedOnce: true })
    } catch (e) {
      if (req === docsReq) {
        set({ loadingDocs: false, loadedOnce: true })
        useToastStore.getState().error('加载文稿列表失败', getErrorMessage(e))
      }
    }
  },

  refreshAll: async () => {
    await Promise.all([get().refreshFolders(), get().refreshDocuments()])
  },

  setFolder: (currentFolder) => {
    set({ currentFolder })
    void get().refreshDocuments()
  },
  setQuery: (query) => {
    set({ query })
    void get().refreshDocuments()
  },
  setTag: (tag) => {
    set({ tag })
    void get().refreshDocuments()
  },

  patchDocument: (d) =>
    set((s) => ({
      documents: s.documents.map((x) => (x.doc_id === d.doc_id ? summary(d) : x)),
    })),
  removeDocument: (id) => set((s) => ({ documents: s.documents.filter((x) => x.doc_id !== id) })),

  createFolder: async (path) => {
    try {
      await apiCreateFolder(path)
      await get().refreshFolders()
      return true
    } catch (e) {
      useToastStore.getState().error('创建文件夹失败', getErrorMessage(e))
      return false
    }
  },

  renameFolder: async (path, newName) => {
    try {
      const node = await apiRenameFolder(path, newName)
      if (get().currentFolder === path) set({ currentFolder: node.path })
      else if (get().currentFolder.startsWith(`${path}/`)) {
        set({ currentFolder: node.path + get().currentFolder.slice(path.length) })
      }
      await get().refreshAll()
      return true
    } catch (e) {
      useToastStore.getState().error('重命名失败', getErrorMessage(e))
      return false
    }
  },

  deleteFolder: async (path) => {
    const toast = useToastStore.getState()
    try {
      await apiDeleteFolder(path, false)
    } catch (e) {
      if (getErrorStatus(e) === 409) {
        const ok = await confirmDialog({
          title: '文件夹不为空',
          message: '该文件夹内仍有文稿或子文件夹，继续删除将一并永久删除其中所有内容。',
          confirmText: '连同内容删除',
          danger: true,
        })
        if (!ok) return false
        try {
          await apiDeleteFolder(path, true)
        } catch (e2) {
          toast.error('删除失败', getErrorMessage(e2))
          return false
        }
      } else {
        toast.error('删除失败', getErrorMessage(e))
        return false
      }
    }
    const cur = get().currentFolder
    if (cur === path || cur.startsWith(`${path}/`)) set({ currentFolder: '' })
    await get().refreshAll()
    return true
  },
}))
