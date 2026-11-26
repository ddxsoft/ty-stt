# 交付里程碑任务清单

本清单按 M1-M5 里程碑细化具体任务与交付物。

## M1：FastAPI 基础框架与健康检查

### 任务
- 初始化项目结构与基础配置（`app/`, `config/`, `tests/`, `data/`）。
- 建立 FastAPI 应用入口与路由分组（`/v1`）。
- 实现健康检查接口 `GET /v1/health`（模型与依赖可用性检查占位）。
- 统一日志格式与请求追踪字段（request_id/trace_id）。
- 增加基础异常处理与响应格式。

### 交付物
- 可启动的 FastAPI 服务骨架。
- `health` 接口可用并返回版本与基础状态。
- 日志与错误响应格式文档化。

## M2：音频上传 + STT + 文档入库

### 任务
- 实现 `POST /v1/audio/upload` 上传与格式校验（MP3/WAV）。
- 音频落盘与元数据记录（时长、采样率、格式）。
- 集成 Fun-ASR-Nano-2512 完成 STT 转写。
- 构建 LangChain `create_agent` 输出结构化 Markdown。
- 保存转写文本与 Markdown 至 `data/transcripts/` 与 `data/docs/`。
- 设计 doc_id 生成规则与状态记录。

### 交付物
- 音频上传接口与入库处理链路打通。
- STT 与 Markdown 生成的本地文件落盘。
- 入库结果返回与错误响应样例。

## M3：ChromaDB 向量化 + 检索

### 任务
- 接入 ChromaDB，创建 `knowledge_base` collection。
- 实现文档切分策略（按段落或语义，400-800 tokens）。
- 对 chunks 生成 embedding 并写入 ChromaDB。
- 实现 `vector_retriever` 工具（top_k、MMR 或相似度阈值）。
- 增加 `GET /v1/docs/{doc_id}` 支持查看转写与 Markdown。

### 交付物
- ChromaDB 向量化入库与检索可用。
- 可通过检索返回相关 chunk 与 metadata。
- 文档查询接口可用。

## M4：WebSocket 流式问答 + TTS

### 任务
- 实现 `WS /v1/chat/stream` 连接管理与会话状态维护。
- 音频流缓冲与断句策略（2-4 秒片段）。
- 流式 STT 接入并输出 partial/final 文本。
- LangChain `create_agent` 调用工具（向量检索 + DuckDuckGo）。
- 集成 Fun-CosyVoice3 完成 TTS 并回传音频流。
- 支持文本问答 `POST /v1/chat` 便于调试。

### 交付物
- WebSocket 语音问答闭环（音频进 -> 音频出）。
- 文本问答接口可用。
- 会话状态与错误响应可追踪。

## M5：LangGraph 容错策略与监控完善

### 任务
- 将 M2/M4 流程迁移为 LangGraph 图（ingest_graph、qa_stream_graph）。
- 配置 RetryPolicy（指数退避 + 抖动）。
- 对 STT/TTS/检索节点设置超时与降级策略。
- 增加节点级追踪与失败事件记录。
- 输出运行指标（STT/TTS 延迟、RAG 命中率、失败率）。

### 交付物
- LangGraph 流程可视化与重试策略生效。
- 容错与降级策略文档化。
- 基础监控指标可输出（日志或接口）。
