import { create } from 'zustand'
import {
  deleteDocument,
  getDocument,
  moveDocument,
  updateDocument,
} from '@/api/documents'
import { getErrorMessage } from '@/api/client'
import type { DocumentDetail } from '@/api/types'
import { useLibraryStore } from './libraryStore'
import { usePlayerStore } from './playerStore'
import { useToastStore } from './toastStore'

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

interface DocState {
  docId: string | null
  doc: DocumentDetail | null
  loading: boolean
  loadError: string | null

  content: string
  title: string
  tags: string[]
  dirty: boolean
  saveState: SaveState
  savedAt: number | null
  /** 每次编辑 +1，用于判断保存期间是否又有修改 */
  version: number

  open: (id: string | null) => Promise<void>
  close: () => void
  setContent: (c: string) => void
  setTitle: (t: string) => void
  setTags: (t: string[]) => void
  save: () => Promise<boolean>
  applyDetail: (d: DocumentDetail) => void
  remove: () => Promise<boolean>
  move: (folder: string, filename?: string) => Promise<boolean>
}

export const AUTOSAVE_MS = 1500

let timer: ReturnType<typeof setTimeout> | null = null
let inflight: Promise<boolean> | null = null

function clearTimer() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

export const useDocStore = create<DocState>((set, get) => {
  const touch = () => {
    set((s) => ({ dirty: true, saveState: 'dirty', version: s.version + 1 }))
    clearTimer()
    timer = setTimeout(() => {
      void get().save()
    }, AUTOSAVE_MS)
  }

  return {
    docId: null,
    doc: null,
    loading: false,
    loadError: null,
    content: '',
    title: '',
    tags: [],
    dirty: false,
    saveState: 'idle',
    savedAt: null,
    version: 0,

    open: async (id) => {
      if (id === get().docId && get().doc) return
      if (get().dirty) await get().save()
      clearTimer()
      usePlayerStore.getState().reset()
      if (!id) {
        get().close()
        return
      }
      set({ docId: id, loading: true, loadError: null })
      try {
        const d = await getDocument(id)
        if (get().docId !== id) return
        set({
          doc: d,
          content: d.content,
          title: d.title,
          tags: d.tags ?? [],
          dirty: false,
          saveState: 'idle',
          savedAt: null,
          loading: false,
          version: 0,
        })
      } catch (e) {
        if (get().docId !== id) return
        set({ doc: null, loading: false, loadError: getErrorMessage(e, '加载文稿失败') })
      }
    },

    close: () => {
      clearTimer()
      usePlayerStore.getState().reset()
      set({
        docId: null,
        doc: null,
        loading: false,
        loadError: null,
        content: '',
        title: '',
        tags: [],
        dirty: false,
        saveState: 'idle',
        savedAt: null,
        version: 0,
      })
    },

    setContent: (content) => {
      if (content === get().content) return
      set({ content })
      touch()
    },
    setTitle: (title) => {
      set({ title })
      touch()
    },
    setTags: (tags) => {
      set({ tags })
      touch()
    },

    save: async () => {
      if (inflight) {
        await inflight
        return get().dirty ? get().save() : true
      }
      const s = get()
      if (!s.docId || !s.doc) return true
      if (!s.dirty && s.saveState !== 'error') return true
      clearTimer()
      const id = s.docId
      const ver = s.version
      set({ saveState: 'saving' })
      inflight = (async () => {
        try {
          const body = {
            content: s.content,
            title: s.title.trim() || undefined,
            tags: s.tags,
          }
          const d = await updateDocument(id, body)
          if (get().docId !== id) return true
          const stillDirty = get().version !== ver
          set({
            doc: d,
            dirty: stillDirty,
            saveState: stillDirty ? 'dirty' : 'saved',
            savedAt: Date.now(),
          })
          useLibraryStore.getState().patchDocument(d)
          if (stillDirty) {
            clearTimer()
            timer = setTimeout(() => {
              void get().save()
            }, AUTOSAVE_MS)
          }
          return true
        } catch (e) {
          if (get().docId === id) set({ saveState: 'error' })
          useToastStore.getState().error('保存失败', getErrorMessage(e))
          return false
        } finally {
          inflight = null
        }
      })()
      return inflight
    },

    applyDetail: (d) => {
      clearTimer()
      set({
        docId: d.doc_id,
        doc: d,
        content: d.content,
        title: d.title,
        tags: d.tags ?? [],
        dirty: false,
        saveState: 'saved',
        savedAt: Date.now(),
        version: get().version + 1,
      })
      useLibraryStore.getState().patchDocument(d)
    },

    remove: async () => {
      const id = get().docId
      if (!id) return false
      try {
        clearTimer()
        await deleteDocument(id)
        get().close()
        useLibraryStore.getState().removeDocument(id)
        void useLibraryStore.getState().refreshFolders()
        return true
      } catch (e) {
        useToastStore.getState().error('删除失败', getErrorMessage(e))
        return false
      }
    },

    move: async (folder, filename) => {
      const id = get().docId
      if (!id) return false
      try {
        if (get().dirty) await get().save()
        const d = await moveDocument(id, { folder, filename: filename || undefined })
        set({ doc: d })
        void useLibraryStore.getState().refreshAll()
        useToastStore.getState().success('已移动', folder ? `现位于「${folder}」` : '现位于根目录')
        return true
      } catch (e) {
        useToastStore.getState().error('移动失败', getErrorMessage(e))
        return false
      }
    },
  }
})
