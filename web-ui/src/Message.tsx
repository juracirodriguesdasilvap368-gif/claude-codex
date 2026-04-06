import type { UIMessage } from './types'
import Markdown from './Markdown'

interface MessageProps {
  message: UIMessage
  onApprove?: (requestId: string) => void
  onDeny?: (requestId: string) => void
}

export default function Message({ message, onApprove, onDeny }: MessageProps) {
  switch (message.type) {
    case 'user':
      return (
        <div className="message user">
          {message.content}
        </div>
      )

    case 'assistant':
      return (
        <div className="message assistant">
          <Markdown content={message.content} />
        </div>
      )

    case 'tool-use':
      return (
        <div className="message tool-use">
          <div className="tool-header">
            <span>🔧</span>
            <span>{message.toolName}</span>
          </div>
          <pre><code>{message.content}</code></pre>
        </div>
      )

    case 'tool-result':
      return (
        <div className="message tool-result">
          <div className="tool-header">
            <span>→</span>
            <span>Result</span>
          </div>
          <Markdown content={message.content} />
        </div>
      )

    case 'approval':
      return (
        <div className="message approval">
          <div className="approval-title">
            <span>⚠️</span>
            <span>Permission Request</span>
          </div>
          <div className="approval-tool">
            Tool: <strong>{message.toolName}</strong>
          </div>
          <div className="approval-input">
            <pre><code>{message.content}</code></pre>
          </div>
          {message.resolved ? (
            <div className={`approval-resolved ${message.resolved}`}>
              {message.resolved === 'approved' ? '✓ Approved' : '✗ Denied'}
            </div>
          ) : (
            <div className="approval-actions">
              <button
                className="btn btn-approve"
                onClick={() => onApprove?.(message.requestId!)}
              >
                Approve
              </button>
              <button
                className="btn btn-deny"
                onClick={() => onDeny?.(message.requestId!)}
              >
                Deny
              </button>
            </div>
          )}
        </div>
      )

    case 'system':
      return (
        <div className="message system">
          {message.content}
        </div>
      )

    default:
      return null
  }
}
