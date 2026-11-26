import { apiClient } from './client'
import type { FolderNode } from './types'

export async function getFolders(): Promise<FolderNode> {
  const { data } = await apiClient.get<FolderNode>('/folders')
  return data
}

export async function createFolder(path: string): Promise<FolderNode> {
  const { data } = await apiClient.post<FolderNode>('/folders', { path })
  return data
}

export async function renameFolder(path: string, newName: string): Promise<FolderNode> {
  const { data } = await apiClient.patch<FolderNode>('/folders', { path, new_name: newName })
  return data
}

export async function deleteFolder(path: string, force = false): Promise<void> {
  await apiClient.delete('/folders', { params: { path, force } })
}
