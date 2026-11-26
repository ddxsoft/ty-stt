# 多智能体语音系统完整设计方案

版本: v1.0
日期: 2026-01-05

## 1. 项目目标

- 构建基于 LangChain 1.0 + LangGraph 1.0 + FastAPI 的本地多智能体语音系统。
- 支持音频文件入库与流式语音问答两条主流程。
- 采用 FunAudioLLM 系列模型完成 STT 与 TTS，LLM 使用本地 Ollama（OpenAI API 兼容）。
- 向量库使用 ChromaDB，检索结合 Web 搜索（DuckDuckGo）。

## 2. 范围说明

### 2.1 包含范围

- 音频文件上传、转写、结构化 Markdown 文档生成与向量化入库。
- 实时语音问答：音频流 -> STT -> RAG + Web 搜索 -> LLM -> TTS -> 回传音频流。
- LangGraph 流程编排、容错与重试策略。
- FastAPI 服务与 WebSocket 流式通信。

### 2.2 不包含范围

- 在线多租户部署与复杂鉴权计费。
- 端到端语音识别与合成模型训练。
- 大规模分布式扩展（以本地开发和单机为主）。

## 3. 需求与约束

### 3.1 功能需求

- 支持 MP3/WAV 上传并完成入库处理。
- 输出结构化 Markdown 文档，格式可校验。
- 提供文本问答与语音问答两种接口。
- 支持向量检索与 Web 搜索融合。
- 提供可视化流程图与重试机制。

### 3.2 非功能需求

- 低延迟语音交互（流式识别与合成）。
- 本地 GPU 加速（NVIDIA）。
- 稳定可恢复（节点级重试与降级）。
- 可观测性（日志、追踪、指标）。

## 4. 技术选型

| 模块 | 选择 | 说明 |
| --- | --- | --- |
| 框架 | LangChain 1.0 | 代理与工具调用 |
| 编排 | LangGraph 1.0 | 流程可视化与容错 |
| Web 框架 | FastAPI | 微服务 + WebSocket |
| LLM | Ollama | OpenAI API 兼容 |
| STT | Fun-ASR-Nano-2512 | FunAudioLLM，GPU 加速 |
| TTS | Fun-CosyVoice3-0.5B-2512 | FunAudioLLM，GPU 加速 |
| 向量库 | ChromaDB | 轻量级本地部署 |
| Web 搜索 | DuckDuckGo | 无需密钥 |
| 容错 | LangGraph RetryPolicy | 指数退避 + 抖动重试 |

## 5. 系统架构

### 5.1 组件分层

- 客户端：上传音频/流式音频，接收文本与音频。
- FastAPI 网关：请求路由、参数校验、WebSocket 管理。
- LangGraph 编排层：定义流程节点、重试策略、状态流转。
- LangChain 代理层：`create_agent` 驱动 LLM 调用工具。
- 模型服务：STT、TTS、LLM（Ollama）。
- 存储层：文件存储 + ChromaDB。

### 5.2 数据流概览

- 文件入库：Upload -> STT -> Markdown -> Embedding -> ChromaDB
- 语音问答：Stream Audio -> STT -> RAG + Web Search -> LLM -> TTS -> Stream Out

### 5.3 项目结构

```
project-root/
|-- app/
|   |-- api/
|   |   |-- v1/
|   |       |-- routes.py
|   |-- core/
|   |-- graphs/
|   |-- agents/
|   |-- services/
|   |-- schemas/
|   |-- utils/
|-- config/
|-- data/
|   |-- audio/
|   |-- transcripts/
|   |-- docs/
|   |-- tts/
|-- tests/
|-- scripts/
|-- requirements.txt
|-- README.md
```

模块说明:
- app/api: FastAPI 路由与 WebSocket 接口实现。
- app/core: 应用配置、日志、依赖注入与通用基础设施。
- app/graphs: LangGraph 流程编排与状态定义。
- app/agents: LangChain create_agent 代理与工具封装。
- app/services: STT/TTS/检索/向量化等领域服务。
- app/schemas: API 请求/响应与内部数据结构模型。
- app/utils: 通用工具函数与辅助组件。
- config: 环境配置与运行参数。
- data: 本地数据落盘目录（音频、转写、文档、TTS 输出）。
- tests: 单元与集成测试。
- scripts: 本地开发与运维脚本。

## 6. 核心流程设计

### 6.1 文件入库流程

1) 客户端上传 MP3/WAV。
2) STT 转写文本（Fun-ASR-Nano）。
3) LangChain `create_agent` 清洗与结构化输出 Markdown。
4) 文档切分 + Embedding（Ollama embedding）。
5) ChromaDB 写入，并保存原始音频、转写与 Markdown。

### 6.2 流式语音问答流程

1) WebSocket 接收音频流片段，缓冲与断句。
2) STT 实时转写（partial + final）。
3) LangChain `create_agent` 调用工具：向量检索 + DuckDuckGo 搜索。
4) LLM 生成回复文本。
5) TTS 合成音频，WebSocket 回传文本和音频。

## 7. LangGraph 设计

### 7.1 图定义

- `ingest_graph`：`load_audio` -> `stt` -> `format_md` -> `chunk_embed` -> `persist`。
- `qa_stream_graph`：`stream_buffer` -> `stt` -> `rag_agent` -> `tts` -> `stream_out`。

### 7.2 重试策略

- 默认重试 3 次，指数退避 + 抖动。
- STT/TTS 节点单独设置更高超时阈值。
- 检索失败时降级为仅 Web 搜索或仅本地知识库。

### 7.3 状态字段

- IngestState: request_id, doc_id, audio_path, stt_text, md_doc, chunks, error。
- QaStreamState: session_id, buffer, partial_text, final_text, retrieved_docs, web_results, answer_text, answer_audio, error。

### 7.4 节点伪代码

#### 7.4.1 文档入库图（ingest_graph）

```python
# Pseudocode (LangGraph 1.0)
class IngestState(TypedDict):
    request_id: str
    doc_id: str
    audio_path: str
    audio_format: str
    stt_text: str
    md_doc: str
    chunks: list
    error: str | None

retry_policy = RetryPolicy(max_retries=3, backoff="exponential", jitter=True)

async def load_audio(state: IngestState):
    # validate format, persist audio
    return {"audio_path": saved_path}

async def stt_node(state: IngestState):
    # Fun-ASR-Nano -> text
    return {"stt_text": transcript}

async def format_md_agent(state: IngestState):
    # LangChain create_agent -> md_doc
    return {"md_doc": md_text}

async def chunk_embed(state: IngestState):
    # split + embed
    return {"chunks": chunks}

async def persist_chroma(state: IngestState):
    # upsert to ChromaDB
    return {}

graph = StateGraph(IngestState)

graph.add_node("load_audio", load_audio, retry=retry_policy)
graph.add_node("stt", stt_node, retry=retry_policy)
graph.add_node("format_md", format_md_agent, retry=retry_policy)
graph.add_node("chunk_embed", chunk_embed, retry=retry_policy)
graph.add_node("persist", persist_chroma, retry=retry_policy)

graph.add_edge(START, "load_audio")
graph.add_edge("load_audio", "stt")
graph.add_edge("stt", "format_md")
graph.add_edge("format_md", "chunk_embed")
graph.add_edge("chunk_embed", "persist")
graph.add_edge("persist", END)
```

#### 7.4.2 实时问答图（qa_stream_graph）

```python
# Pseudocode (LangGraph 1.0)
class QaStreamState(TypedDict):
    session_id: str
    buffer: bytes
    partial_text: str
    final_text: str
    retrieved_docs: list
    web_results: list
    answer_text: str
    answer_audio: bytes | None
    error: str | None

async def stream_buffer(state: QaStreamState):
    # buffer audio stream, detect utterance
    return {"buffer": buffered_audio}

async def stt_stream(state: QaStreamState):
    # Fun-ASR-Nano -> partial/final
    return {"final_text": text}

async def rag_agent(state: QaStreamState):
    # LangChain create_agent with tools
    # tools: vector_retriever, duckduckgo_search
    return {"answer_text": answer, "retrieved_docs": docs, "web_results": results}

async def tts_node(state: QaStreamState):
    # Fun-CosyVoice3 -> audio
    return {"answer_audio": audio_bytes}

async def stream_out(state: QaStreamState):
    # send text + audio to client
    return {}

qa_graph = StateGraph(QaStreamState)

qa_graph.add_node("stream_buffer", stream_buffer)
qa_graph.add_node("stt", stt_stream, retry=retry_policy)
qa_graph.add_node("rag_agent", rag_agent, retry=retry_policy)
qa_graph.add_node("tts", tts_node, retry=retry_policy)
qa_graph.add_node("stream_out", stream_out)

qa_graph.add_edge(START, "stream_buffer")
qa_graph.add_edge("stream_buffer", "stt")
qa_graph.add_edge("stt", "rag_agent")
qa_graph.add_edge("rag_agent", "tts")
qa_graph.add_edge("tts", "stream_out")
qa_graph.add_edge("stream_out", END)
```

## 8. LangChain Agent 设计

### 8.1 文档结构化 Agent

- 输入: 转写文本。
- 输出: Markdown，包含标题、摘要、分节、要点。
- 校验: Markdown 结构检测（标题级别、列表规范）。

### 8.2 RAG Agent

- 工具: `vector_retriever` + `duckduckgo_search`。
- 检索策略: top_k 4-6，优先本地知识库；若信息不足启用 Web 搜索。
- 输出: 回复正文 + 来源元数据。

## 9. 数据与存储设计

### 9.1 文件目录

- `data/audio/` 原始音频
- `data/transcripts/` 转写文本
- `data/docs/` 结构化 Markdown
- `data/tts/` 合成音频

### 9.2 ChromaDB 设计

- collection: `knowledge_base`
- metadata: doc_id, chunk_id, source, created_at
- id: `doc_id::chunk_id`

### 9.3 数据结构定义

#### 9.3.1 通用字段

```json
{
  "request_id": "req_20250105_0001",
  "timestamp": "2025-01-05T10:56:00Z",
  "trace_id": "trace_abc123"
}
```

#### 9.3.2 文档入库相关

```json
{
  "doc_id": "doc_20250105_0001",
  "audio": {
    "path": "data/audio/doc_20250105_0001.wav",
    "format": "wav",
    "duration_ms": 125000,
    "sample_rate": 16000
  },
  "transcript": {
    "language": "zh",
    "text": "...",
    "segments": [
      {
        "start_ms": 0,
        "end_ms": 2300,
        "text": "..."
      }
    ]
  },
  "md_doc": {
    "path": "data/docs/doc_20250105_0001.md",
    "title": "...",
    "summary": "..."
  },
  "chunks": [
    {
      "chunk_id": "chunk_0001",
      "text": "...",
      "token_count": 520,
      "metadata": {
        "doc_id": "doc_20250105_0001",
        "section": "..."
      }
    }
  ]
}
```

#### 9.3.3 向量库记录（ChromaDB）

```json
{
  "id": "doc_20250105_0001::chunk_0001",
  "embedding": [0.01, -0.02, 0.03],
  "document": "...",
  "metadata": {
    "doc_id": "doc_20250105_0001",
    "chunk_id": "chunk_0001",
    "source": "upload",
    "created_at": "2025-01-05T10:56:00Z"
  }
}
```

#### 9.3.4 实时问答会话状态

```json
{
  "session_id": "sess_20250105_0001",
  "audio_stream": {
    "buffer_ms": 2400,
    "chunk_format": "pcm_s16le",
    "sample_rate": 16000
  },
  "stt_partial": "...",
  "stt_final": "...",
  "retrieved_docs": [
    {
      "doc_id": "doc_20250105_0001",
      "chunk_id": "chunk_0001",
      "score": 0.82,
      "text": "..."
    }
  ],
  "web_results": [
    {
      "title": "...",
      "url": "https://example.com",
      "snippet": "..."
    }
  ],
  "answer_text": "...",
  "answer_audio": {
    "path": "data/tts/sess_20250105_0001.wav",
    "format": "wav"
  },
  "errors": [
    {
      "code": "STT_TIMEOUT",
      "message": "stt timeout",
      "retryable": true
    }
  ]
}
```

#### 9.3.5 LangGraph State（建议字段）

```json
{
  "IngestState": {
    "request_id": "...",
    "doc_id": "...",
    "audio_path": "...",
    "audio_format": "mp3|wav",
    "stt_text": "...",
    "md_doc": "...",
    "chunks": ["..."],
    "error": null
  },
  "QaStreamState": {
    "session_id": "...",
    "buffer": "...",
    "partial_text": "...",
    "final_text": "...",
    "retrieved_docs": ["..."],
    "web_results": ["..."],
    "answer_text": "...",
    "answer_audio": "...",
    "error": null
  }
}
```

## 10. API 设计

### 10.1 REST 接口

- `POST /v1/audio/upload` 上传音频并触发入库。
- `GET /v1/docs/{doc_id}` 获取转写与 Markdown。
- `POST /v1/chat` 文本问答。
- `GET /v1/health` 健康检查。

### 10.2 WebSocket

- `WS /v1/chat/stream` 双向音频流通道。
- 消息类型: `audio`, `partial_text`, `answer`, `error`。

### 10.3 API 请求/响应样例

#### 10.3.1 上传音频入库

Request

```
POST /v1/audio/upload
Content-Type: multipart/form-data

file=@meeting.wav
```

Response

```json
{
  "doc_id": "doc_20250105_0001",
  "status": "processing",
  "message": "audio accepted"
}
```

#### 10.3.2 获取文档内容

Request

```
GET /v1/docs/doc_20250105_0001
```

Response

```json
{
  "doc_id": "doc_20250105_0001",
  "transcript": "...",
  "md_doc": "# 标题\n...",
  "created_at": "2025-01-05T10:56:00Z"
}
```

#### 10.3.3 文本问答（调试）

Request

```json
POST /v1/chat
{
  "query": "介绍一下项目关键风险",
  "top_k": 5,
  "use_web": true
}
```

Response

```json
{
  "answer": "...",
  "sources": [
    {
      "type": "vector",
      "doc_id": "doc_20250105_0001",
      "chunk_id": "chunk_0001"
    },
    {
      "type": "web",
      "url": "https://example.com"
    }
  ]
}
```

#### 10.3.4 WebSocket 流式语音问答

Client -> Server (音频帧，JSON + base64)

```json
{
  "type": "audio",
  "session_id": "sess_20250105_0001",
  "seq": 12,
  "format": "pcm_s16le",
  "sample_rate": 16000,
  "data": "BASE64_AUDIO"
}
```

Server -> Client (中间文本)

```json
{
  "type": "partial_text",
  "session_id": "sess_20250105_0001",
  "text": "我们需要..."
}
```

Server -> Client (最终文本 + 音频)

```json
{
  "type": "answer",
  "session_id": "sess_20250105_0001",
  "text": "完整回答...",
  "audio": {
    "format": "wav",
    "data": "BASE64_AUDIO"
  }
}
```

#### 10.3.5 错误响应

```json
{
  "error": {
    "code": "INVALID_AUDIO_FORMAT",
    "message": "only mp3/wav is supported",
    "retryable": false
  }
}
```

## 11. 部署与运行

- 环境: 本地开发 + NVIDIA GPU。
- 依赖: Ollama、本地模型文件、Python 运行时。
- 启动顺序: Ollama -> 模型加载 -> FastAPI 服务。

## 12. 观测与日志

- 日志: request_id + session_id + trace_id。
- 指标: STT 延迟、TTS 延迟、RAG 命中率、失败率。
- 追踪: LangGraph 节点级追踪与重试记录。

## 13. 安全与合规

- 上传文件类型与大小校验。
- 本地访问控制（Token 或网段白名单）。
- 日志脱敏，不记录原始音频内容。

## 14. 测试计划

- 单元测试: STT/TTS/向量检索接口 mock。
- 集成测试: 文件入库流程与 RAG 流程。
- E2E: WebSocket 语音对话全链路。

## 15. 里程碑

1) M1: FastAPI 服务骨架与健康检查。
2) M2: 音频入库 + STT + Markdown 生成。
3) M3: ChromaDB 入库与检索。
4) M4: WebSocket 语音问答 + TTS。
5) M5: LangGraph 容错与监控完善。

## 16. 风险与应对

- STT 延迟偏高: 引入分段策略与异步队列。
- Web 搜索结果噪声: 增加可信源过滤与摘要压缩。
- GPU 资源不足: 限制并发与熔断策略。

## 17. 后续可扩展方向

- 多模型路由与动态选择。
- 会话记忆与上下文压缩。
- 多语言支持与跨设备部署。
