import { FilePlus2, Menu as MenuIcon, Mic, Moon, Settings, Sun } from 'lucide-react'
import { useUiStore } from '@/store/uiStore'
import { useConfigStore } from '@/store/configStore'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Primitives'
import { cn } from '@/utils/cn'
import SearchBox from '@/components/library/SearchBox'
import TaskQueue from '@/components/library/TaskQueue'
import FolderTree from '@/components/library/FolderTree'
import DocumentList from '@/components/library/DocumentList'

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useUiStore((s) => s.theme)
  const toggle = useUiStore((s) => s.toggleTheme)
  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? '切换为浅色' : '切换为深色'}
      aria-label="切换主题"
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-sunken hover:text-foreground',
        className,
      )}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

export function MobileMenuButton() {
  const setLeftOpen = useUiStore((s) => s.setLeftOpen)
  return (
    <button
      onClick={() => setLeftOpen(true)}
      aria-label="打开文稿库"
      className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle hover:bg-sunken hover:text-foreground lg:hidden"
    >
      <MenuIcon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
    </button>
  )
}

export default function Sidebar() {
  const openDialog = useUiStore((s) => s.openDialog)
  const health = useConfigStore((s) => s.health)
  const healthError = useConfigStore((s) => s.healthError)

  return (
    <aside className="flex h-full w-full flex-col border-r border-line bg-sidebar">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <Logo />
        <div className="leading-tight">
          <div className="font-serif text-[18px] font-bold tracking-wide text-foreground">太夷听写</div>
          <div className="text-[10px] tracking-[0.28em] text-faint">TY · STT STUDIO</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        <Button variant="primary" size="md" onClick={() => openDialog({ type: 'new' })}>
          <FilePlus2 className="h-4 w-4" />
          新建转写
        </Button>
        <Button variant="outline" size="md" onClick={() => openDialog({ type: 'record' })}>
          <Mic className="h-4 w-4 text-accent" />
          实时录音
        </Button>
      </div>

      <SearchBox />

      <div className="flex min-h-0 flex-1 flex-col pt-3">
        <TaskQueue />
        <FolderTree />
        <DocumentList />
      </div>

      <div className="flex items-center justify-between border-t border-line px-3 py-2.5">
        <div
          className="flex min-w-0 items-center gap-2 text-[11px] text-faint"
          title={
            healthError
              ? '无法连接后端'
              : health
                ? `${health.app} v${health.version}\nSTT: ${health.stt_engine}\nLLM: ${health.llm_model}`
                : '连接中…'
          }
        >
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              healthError ? 'bg-danger' : health ? 'bg-success' : 'bg-faint',
            )}
          />
          <span className="truncate">
            {healthError ? '后端未连接' : health ? `${health.stt_engine} · ${health.llm_model || '未配置模型'}` : '连接中…'}
          </span>
        </div>
        <div className="flex items-center">
          <ThemeToggle />
          <button
            onClick={() => openDialog({ type: 'settings' })}
            title="设置"
            aria-label="设置"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-sunken hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
