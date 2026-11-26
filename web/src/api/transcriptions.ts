import { apiClient, API_BASE } from './client'
import type { CreateTranscriptionOptions, Task } from './types'

export async function createTranscriptions(
  files: (File | { blob: Blob; name: string })[],
  opts: CreateTranscriptionOptions = {},
  onProgress?: (percent: number) => void,
): Promise<Task[]> {
  const fd = new FormData()
  for (const f of files) {
    if (f instanceof File) fd.append('files', f, f.name)
    else fd.append('files', f.blob, f.name)
  }
  fd.append('folder', opts.folder ?? '')
  fd.append('preset', opts.preset ?? 'medium')
  if (opts.hotwords?.trim()) fd.append('hotwords', opts.hotwords.trim())
  if (opts.title?.trim()) fd.append('title', opts.title.trim())

  const { data } = await apiClient.post<{ tasks: Task[] }>('/transcriptions', fd, {
    timeout: 0,
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
    },
  })
  return data.tasks
}

export async function listTasks(): Promise<Task[]> {
  const { data } = await apiClient.get<Task[]>('/transcriptions')
  return data
}

export async function getTask(id: string): Promise<Task> {
  const { data } = await apiClient.get<Task>(`/transcriptions/${encodeURIComponent(id)}`)
  return data
}

export async function cancelTask(id: string): Promise<Task> {
  const { data } = await apiClient.post<Task>(`/transcriptions/${encodeURIComponent(id)}/cancel`)
  return data
}

export async function retryTask(id: string): Promise<Task> {
  const { data } = await apiClient.post<Task>(`/transcriptions/${encodeURIComponent(id)}/retry`)
  return data
}

export async function deleteTask(id: string): Promise<void> {
  await apiClient.delete(`/transcriptions/${encodeURIComponent(id)}`)
}

/** 全局 SSE 流地址（EventSource 使用） */
export const TASK_STREAM_URL = `${API_BASE}/transcriptions/stream`
