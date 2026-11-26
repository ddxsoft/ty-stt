# ty-stt · 语音转文字与智能文稿精修工作台

> 专注、轻量、高精度的 **语音转文字 + AI 文稿精修** 专项智能体。
> 由原多智能体语音问答系统 `ty-voice` 重构而来：彻底移除 LangChain / LangGraph / ChromaDB / TTS / 语音对话，
> 以 **本地文件夹 Markdown 直存** 为核心，强化 STT 识别精度、大模型润色改写与音文联动编辑体验。

[![Python](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![React](https://img.shields.io/badge/react-19-61dafb.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-async-009688.svg)](https://fastapi.tiangolo.com/)

---

## 核心功能

- **高精度语音转写**：FunASR（Fun-ASR-Nano）+ **VAD 智能断句**，输出**真实词句级时间戳**；ffprobe 精确时长；热词注入；OOM 自适应回退。
- **合并窗口转写策略**：短 VAD 段合并 → 上下文窗口整窗转写 → 窗口级时间戳，兼顾精度与音文对齐（可选近似细对齐）。
- **分层 AI 润色**：仅转写 / 轻度纠错 / 中度润色 / 重度精修 / 结构化纪要 / 自定义模板；长文分块上下文衔接；术语纠错词典；`<think>` 推理标签自动剥离；严格反幻觉。
- **编辑态 AI 副驾驶**：全文重润色、划词局部改写（润色/修错/精简/转列表/转表格/正式化/原稿核对），流式输出 + Diff 审阅。
- **Markdown 文件夹直存**：生成可读 `.md`（带 YAML Frontmatter），天然兼容 Obsidian / Typora / VS Code / Git；文件夹树、全文搜索、版本快照回滚、导出。
- **音文联动校对**：音频 Range 流式拖动播放 + 带时间戳逐字稿对照，点击跳转播放。
- **异步任务队列 + SSE**：批量上传 / 浏览器录音 → 实时进度、分段文本、流式润色推送，无阻塞、无假进度。

## 技术栈

| 层 | 技术 |
| :--- | :--- |
| 后端 | FastAPI · 原生 `openai.AsyncOpenAI` · FunASR · ffmpeg/ffprobe · PyYAML · 纯文件系统存储 |
| 前端 | React 19 · TypeScript · Vite · Tailwind · CodeMirror 6 · Zustand · react-markdown · diff |
| 模型 | STT：Fun-ASR-Nano-2512 + fsmn-vad；LLM：任意 OpenAI-Compatible（Ollama / DeepSeek / Qwen / OpenAI / vLLM） |

## 目录结构

```text
app/
├── main.py                 # FastAPI 入口、生命周期、CORS、静态资源
├── core/                   # 配置(TYSTT_*)、日志、错误处理、纯 ASGI 请求上下文中间件
├── api/v1/                 # transcriptions / documents / folders / polish / audio / settings + health
├── agent/                  # pipeline(主管道) / polish_agent / copilot_agent / prompts(模板+词典)
├── llm/client.py           # AsyncOpenAI 封装 + 流式 think 剥离
├── stt/                    # base / audio_proc / funasr_engine(VAD合并窗口) / mock_engine / engine(工厂)
├── storage/                # markdown_store / sidecar_store / task_manager / uploads
└── schemas/                # Pydantic 请求/响应模型
web/                        # React Studio 前端
data/                       # 内部支撑数据：audio / transcripts / snapshots / prompts.json / glossary.json
workspace/                  # Markdown 输出根目录（可配置，TYSTT_OUTPUT_DIR）
docs/                       # refactor-plan.md（重构方案）/ api-contract.md（接口契约）
scripts/                    # dev_server.py（启动后端）/ migrate_legacy.py（旧数据迁移）
tests/                      # pytest 后端测试套件
legacy/                     # （本地归档，已 .gitignore）重构前的旧 ty-voice 代码，不入库
```

## 快速开始

### 0. 前置依赖
- Python 3.10+、Node.js 18+
- **ffmpeg / ffprobe**（需在 PATH 中，用于音频转码与时长探测）
- 本地 LLM 服务（如 [Ollama](https://ollama.com)）或云端 OpenAI-Compatible API
- STT 模型：Fun-ASR-Nano-2512（ModelScope 下载，或用 `TYSTT_STT_MODEL_PATH` 指向本地目录）；VAD 模型 `fsmn-vad` 首次运行自动下载

### 1. 后端
```bash
python -m venv .venv
# Windows: .venv\Scripts\activate   |   Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env                # 按需修改模型路径、LLM、输出目录等
python scripts/dev_server.py        # 启动后端 http://localhost:8000（自动加载 .env，热重载）
# 或： uvicorn app.main:app --reload --port 8000
```

### 2. 前端
```bash
cd web
npm install
npm run dev                         # http://localhost:5173（vite 已代理 /api → localhost:8000）
```

### 3. 迁移旧数据（可选）
```bash
python scripts/migrate_legacy.py --dry-run   # 预览
python scripts/migrate_legacy.py             # 将旧 data/docs/*.md（剥离 think）迁入 workspace/
```

## 配置（`TYSTT_*`，兼容回退旧 `TYVOICE_*`）

| 变量 | 默认 | 说明 |
| :--- | :--- | :--- |
| `TYSTT_OUTPUT_DIR` | `workspace` | Markdown 输出根目录 |
| `TYSTT_DATA_DIR` | `data` | 内部支撑数据目录 |
| `TYSTT_STT_ENGINE` | `funasr` | `funasr` 或 `mock`（无模型演示/测试） |
| `TYSTT_STT_MODEL_PATH` | 空 | 本地 STT 模型目录 |
| `TYSTT_STT_DEVICE` | `cpu` | `cpu` / `cuda` |
| `TYSTT_STT_VAD` | `true` | 启用 VAD 智能分段 |
| `TYSTT_STT_VAD_MERGE_MS` | `2000` | 短段合并阈值（毫秒） |
| `TYSTT_STT_WINDOW_SECONDS` | `45` | 上下文窗口大小（秒），整窗转写 |
| `TYSTT_STT_FINE_ALIGN` | `false` | 近似细对齐（时间戳真实，文本按字数近似分配） |
| `TYSTT_LLM_BASE_URL` | `http://localhost:11434/v1` | OpenAI-Compatible 服务地址 |
| `TYSTT_LLM_MODEL` | `qwen3:8b` | 模型名；`mock` 可无外部依赖运行 |
| `TYSTT_LLM_API_KEY` | `ollama` | API Key（接口从不回传） |
| `TYSTT_DEFAULT_PRESET` | `medium` | 默认润色预设 |

运行时可在前端设置中心修改 LLM / STT / 输出目录 / 默认预设，持久化到 `data/runtime_config.json`。

## API

完整契约见 [docs/api-contract.md](docs/api-contract.md)，Base `/api/v1`：
转写任务（含全局 SSE 进度流）、文档 CRUD/搜索/快照/导出、文件夹树、AI 润色（POST+SSE）、音频 Range 回放、设置/模板/术语词典、健康检查。

## 测试
```bash
pytest                              # 后端测试套件（mock STT + mock LLM，无外部依赖）
```

## 开发状态
- ✅ 后端：配置 / 存储 / STT（VAD 合并窗口，已用真实模型验证）/ LLM / 润色智能体 / 任务队列 / 全部 API，52 项测试通过。
- ✅ 前端：三栏 Studio 已完成入口接线（欢迎页 / 文稿树 / 编辑器 / 音文播放器 / AI 精修副驾驶 / 新建与录音弹窗 / 设置中心 / 深浅色主题），`npm run build` 与 `npm run lint` 均通过。
- ℹ️ 真实转写与 AI 润色需要本地 STT 模型与 Ollama（或任意 OpenAI-Compatible 服务）在线；离线演示可在设置中心把 STT 与 LLM 都切到 `mock`，即可跑通「上传 → 转写 → 润色 → Markdown 落盘」全流程。
- 重构方案见 [docs/refactor-plan.md](docs/refactor-plan.md)。

## 许可
MIT