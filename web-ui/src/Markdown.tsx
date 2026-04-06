import { useState, useCallback, lazy, Suspense } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Lazy load syntax highlighter — it's 900KB+ and not needed immediately
const SyntaxHighlighter = lazy(() =>
  import('react-syntax-highlighter/dist/esm/prism-async-light').then(mod => ({
    default: mod.default,
  }))
)

const oneDarkPromise = import(
  'react-syntax-highlighter/dist/esm/styles/prism/one-dark'
).then(mod => mod.default)

let cachedStyle: Record<string, React.CSSProperties> | null = null
oneDarkPromise.then(s => { cachedStyle = s })

interface MarkdownProps {
  content: string
}

function CodeBlock({
  language,
  children,
}: {
  language: string
  children: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [children])

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{language || 'text'}</span>
        <button className="copy-btn" onClick={handleCopy}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <Suspense fallback={<pre style={{ margin: 0, padding: '10px 12px', background: '#282c34', borderRadius: '0 0 6px 6px', fontSize: '13px' }}><code>{children}</code></pre>}>
        <SyntaxHighlighter
          language={language || 'text'}
          style={cachedStyle || {}}
          customStyle={{
            margin: 0,
            borderRadius: '0 0 6px 6px',
            border: '1px solid var(--border)',
            borderTop: 'none',
            fontSize: '13px',
          }}
        >
          {children}
        </SyntaxHighlighter>
      </Suspense>
    </div>
  )
}

export default function Markdown({ content }: MarkdownProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const text = String(children).replace(/\n$/, '')

            if (match) {
              return <CodeBlock language={match[1]!} children={text} />
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
