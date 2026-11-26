"""ty-stt 后端开发服务器（端口 8000，匹配前端 vite 代理）。

用法（项目根目录）：
    .venv/Scripts/python.exe scripts/dev_server.py        # Windows
    .venv/bin/python scripts/dev_server.py                # Linux/macOS

配置自动从根目录 .env 加载（见 app/core/config.py）。
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["app"],
    )