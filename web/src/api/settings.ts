import { apiClient } from './client'
import type {
  Glossary,
  Health,
  Preset,
  PresetInput,
  Settings,
  SettingsUpdate,
  TestLlmResult,
} from './types'

const enc = encodeURIComponent

export async function getSettings(): Promise<Settings> {
  const { data } = await apiClient.get<Settings>('/settings')
  return data
}

export async function updateSettings(body: SettingsUpdate): Promise<Settings> {
  const { data } = await apiClient.put<Settings>('/settings', body)
  return data
}

export async function testLlm(): Promise<TestLlmResult> {
  const { data } = await apiClient.post<TestLlmResult>('/settings/test-llm', undefined, {
    timeout: 90_000,
  })
  return data
}

export async function listPrompts(): Promise<Preset[]> {
  const { data } = await apiClient.get<Preset[]>('/prompts')
  return data
}

export async function createPrompt(body: PresetInput): Promise<Preset> {
  const { data } = await apiClient.post<Preset>('/prompts', body)
  return data
}

export async function updatePrompt(id: string, body: PresetInput): Promise<Preset> {
  const { data } = await apiClient.put<Preset>(`/prompts/${enc(id)}`, body)
  return data
}

export async function deletePrompt(id: string): Promise<void> {
  await apiClient.delete(`/prompts/${enc(id)}`)
}

export async function getGlossary(): Promise<Glossary> {
  const { data } = await apiClient.get<Glossary>('/glossary')
  return data
}

export async function updateGlossary(body: Glossary): Promise<Glossary> {
  const { data } = await apiClient.put<Glossary>('/glossary', body)
  return data
}

export async function getHealth(): Promise<Health> {
  const { data } = await apiClient.get<Health>('/health', { timeout: 8000 })
  return data
}
