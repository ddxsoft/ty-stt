import { apiClient, API_BASE } from './client'
import type {
  ApiErrorBody,
  PolishDocumentBody,
  PolishSelectionBody,
  PolishTitleResult,
} from './types'

export interface StreamHandlers {
  onDelta?: (text: string) => void
  signal?: AbortSignal
}

/**
 * POST + SSE（fetch + ReadableStream）。
 * 事件：`delta {text}` / `done {content}` / `error {message}`。
 * 返回最终内容（`done.content`，缺失时回退为累计 delta）。
 */
export async function streamPolish(
  path: string,
  body: unknown,
  handlers: StreamHandlers = {},
): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal: handlers.signal,
  })

  if (!res.ok) {
    let msg = `请求失败 (HTTP ${res.status})`
    try {
      const j = (await res.json()) as ApiErrorBody
      if (j?.error?.message) msg = j.error.message
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  if (!res.body) throw new Error('当前浏览器不支持流式响应')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let acc = ''
  let final: string | null = null

  const dispatch = (event: string, data: string) => {
    let payload: Record<string, unknown> = {}
    try {
      payload = JSON.parse(data) as Record<string, unknown>
    } catch {
      /* 非 JSON 数据忽略 */
    }
    if (event === 'delta') {
      const t = typeof payload.text === 'string' ? payload.text : ''
      if (t) {
        acc += t
        handlers.onDelta?.(t)
      }
    } else if (event === 'done') {
      if (typeof payload.content === 'string') final = payload.content
    } else if (event === 'error') {
      throw new Error(typeof payload.message === 'string' ? payload.message : 'AI 处理失败')
    }
  }

  const parseBlock = (block: string) => {
    let event = 'message'
    const dataLines: string[] = []
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue
      const i = line.indexOf(':')
      const field = i === -1 ? line : line.slice(0, i)
      let value = i === -1 ? '' : line.slice(i + 1)
      if (value.startsWith(' ')) value = value.slice(1)
      if (field === 'event') event = value
      else if (field === 'data') dataLines.push(value)
    }
    if (dataLines.length) dispatch(event, dataLines.join('\n'))
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      buf = buf.replace(/\r\n/g, '\n')
      let idx: number
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        parseBlock(block)
      }
    }
    buf += decoder.decode()
    if (buf.trim()) parseBlock(buf.replace(/\r\n/g, '\n'))
  } finally {
    reader.cancel().catch(() => undefined)
  }

  return final ?? acc
}

export function polishDocument(body: PolishDocumentBody, h?: StreamHandlers) {
  return streamPolish('/polish/document', body, h)
}

export function polishSelection(body: PolishSelectionBody, h?: StreamHandlers) {
  return streamPolish('/polish/selection', body, h)
}

export async function polishTitle(content: string): Promise<PolishTitleResult> {
  const { data } = await apiClient.post<PolishTitleResult>(
    '/polish/title',
    { content },
    { timeout: 120_000 },
  )
  return data
}
