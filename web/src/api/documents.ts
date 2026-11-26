import { apiClient, API_BASE } from './client'
import type {
  DocumentDetail,
  DocumentSummary,
  ExportFormat,
  ListDocumentsParams,
  MoveDocumentBody,
  Snapshot,
  UpdateDocumentBody,
} from './types'

const enc = encodeURIComponent

export async function listDocuments(params: ListDocumentsParams = {}): Promise<DocumentSummary[]> {
  const p: Record<string, string> = {}
  if (params.folder) p.folder = params.folder
  if (params.q) p.q = params.q
  if (params.tag) p.tag = params.tag
  const { data } = await apiClient.get<DocumentSummary[]>('/documents', { params: p })
  return data
}

export async function getDocument(id: string): Promise<DocumentDetail> {
  const { data } = await apiClient.get<DocumentDetail>(`/documents/${enc(id)}`)
  return data
}

export async function updateDocument(id: string, body: UpdateDocumentBody): Promise<DocumentDetail> {
  const { data } = await apiClient.put<DocumentDetail>(`/documents/${enc(id)}`, body)
  return data
}

export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/documents/${enc(id)}`)
}

export async function moveDocument(id: string, body: MoveDocumentBody): Promise<DocumentDetail> {
  const { data } = await apiClient.post<DocumentDetail>(`/documents/${enc(id)}/move`, body)
  return data
}

export async function listSnapshots(id: string): Promise<Snapshot[]> {
  const { data } = await apiClient.get<Snapshot[]>(`/documents/${enc(id)}/snapshots`)
  return data
}

export async function getSnapshot(id: string, snapshotId: string): Promise<{ content: string }> {
  const { data } = await apiClient.get<{ content: string }>(
    `/documents/${enc(id)}/snapshots/${enc(snapshotId)}`,
  )
  return data
}

export async function restoreSnapshot(id: string, snapshotId: string): Promise<DocumentDetail> {
  const { data } = await apiClient.post<DocumentDetail>(
    `/documents/${enc(id)}/snapshots/${enc(snapshotId)}/restore`,
  )
  return data
}

export function exportUrl(id: string, format: ExportFormat): string {
  return `${API_BASE}/documents/${enc(id)}/export?format=${format}`
}

export function audioUrl(id: string): string {
  return `${API_BASE}/audio/${enc(id)}`
}
