import axios, { AxiosError } from 'axios'
import type { ApiErrorBody } from './types'

export const API_BASE: string = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 60_000,
})

/** 从任意错误中提取可读的中文/服务端消息 */
export function getErrorMessage(e: unknown, fallback = '请求失败'): string {
  if (axios.isAxiosError(e)) {
    const err = e as AxiosError<ApiErrorBody>
    const msg = err.response?.data?.error?.message
    if (msg) return msg
    if (err.code === 'ECONNABORTED') return '请求超时'
    if (!err.response) return '无法连接到服务端，请确认后端已启动'
    return `${fallback} (HTTP ${err.response.status})`
  }
  if (e instanceof Error && e.message) return e.message
  return fallback
}

export function getErrorStatus(e: unknown): number | null {
  return axios.isAxiosError(e) ? (e.response?.status ?? null) : null
}
