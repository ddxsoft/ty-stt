import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useLibraryStore } from '@/store/libraryStore'

export default function SearchBox() {
  const query = useLibraryStore((s) => s.query)
  const [value, setValue] = useState(query)

  useEffect(() => {
    const t = setTimeout(() => {
      if (value !== useLibraryStore.getState().query) useLibraryStore.getState().setQuery(value)
    }, 260)
    return () => clearTimeout(t)
  }, [value])

  return (
    <div className="relative px-3">
      <Search className="pointer-events-none absolute left-5.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" style={{ left: 22 }} />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="搜索标题、标签、正文…"
        className="h-9 w-full rounded-lg border border-transparent bg-sunken pl-8 pr-8 text-[13px] text-foreground transition-colors placeholder:text-faint focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
      {value && (
        <button
          onClick={() => setValue('')}
          aria-label="清除搜索"
          className="absolute right-5 top-1/2 -translate-y-1/2 rounded p-0.5 text-faint hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
