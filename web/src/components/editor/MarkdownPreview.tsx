import { memo, useDeferredValue, type ComponentProps, type JSX } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/utils/cn'

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

function heading(Tag: HeadingTag) {
  const H = ({ node, children }: ComponentProps<HeadingTag> & { node?: { position?: { start: { line: number } } } }) => {
    const line = node?.position?.start.line
    const El = Tag as keyof JSX.IntrinsicElements
    return <El data-line={line}>{children}</El>
  }
  return H
}

const components = {
  h1: heading('h1'),
  h2: heading('h2'),
  h3: heading('h3'),
  h4: heading('h4'),
  h5: heading('h5'),
  h6: heading('h6'),
  a: ({ href, children }: ComponentProps<'a'>) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
  table: ({ children }: ComponentProps<'table'>) => (
    <div className="table-wrap">
      <table>{children}</table>
    </div>
  ),
}

interface Props {
  content: string
  className?: string
}

function MarkdownPreviewInner({ content, className }: Props) {
  const deferred = useDeferredValue(content)
  return (
    <article className={cn('prose-doc', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {deferred}
      </ReactMarkdown>
    </article>
  )
}

const MarkdownPreview = memo(MarkdownPreviewInner)
export default MarkdownPreview
