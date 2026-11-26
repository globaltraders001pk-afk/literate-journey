'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { 
  Sparkles, 
  ArrowUp, 
  Loader2, 
  CheckCircle2, 
  Database,
  Package,
  CalendarCheck,
  DollarSign,
  ClipboardList,
  Copy,
  Check,
  Plus,
  Mic,
  Lightbulb,
  Receipt,
  Brain,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getChatSession, saveChatSession, createNewSession } from '@/lib/ai/chat-storage'
import { MarkdownContent } from '@/components/ai/markdown-content'
import { InvoiceModal, InvoiceModalData } from '@/components/ai/invoice-modal'

interface ActionReceipt {
  action: string
  details: string
  success: boolean
  // Set when the executor returned a preview instead of writing:
  // nothing has happened yet — the owner must confirm or cancel.
  requiresConfirmation?: boolean
  data?: { invoice_number?: string; [key: string]: unknown }
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  thinking?: string
  status?: string
  actions?: ActionReceipt[]
}

function ThinkingBlock({ thinking, status }: { thinking?: string; status?: string }) {
  const [open, setOpen] = React.useState(false)

  if (!thinking && !status) return null

  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 overflow-hidden text-xs my-2 max-w-xl shadow-2xs transition-all">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <div className="flex items-center gap-2 font-medium">
          <Brain className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span>{status ? status : 'Thought Process'}</span>
          {status && (
            <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping shrink-0" />
          )}
        </div>
        {thinking && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
            <span>{open ? 'Hide' : 'Show steps'}</span>
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </div>
        )}
      </button>

      {open && thinking && (
        <div className="px-3.5 py-2.5 border-t border-border/50 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap bg-background/50 max-h-56 overflow-y-auto select-text">
          {thinking}
        </div>
      )}
    </div>
  )
}

const TOPIC_PRESETS: Record<string, string> = {
  products: 'Show me inventory products and stock levels',
  attendance: 'Check staff attendance logs for today',
  expenses: 'Summarize our operational expenses and cash flow this month',
  tasks: 'List all pending and active tasks'
}

export function ChatClient() {
  const searchParams = useSearchParams()
  const topic = searchParams.get('topic')
  const sessionId = searchParams.get('session')

  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(sessionId)
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [thinkMode, setThinkMode] = React.useState(false)
  const [showAttachMenu, setShowAttachMenu] = React.useState(false)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  const [selectedInvoice, setSelectedInvoice] = React.useState<{ number: string | null; data: InvoiceModalData | null }>({ number: null, data: null })
  const [invoiceModalOpen, setInvoiceModalOpen] = React.useState(false)

  const handleOpenInvoice = (invNum: string, invoiceData?: InvoiceModalData | null) => {
    setSelectedInvoice({ number: invNum, data: invoiceData || null })
    setInvoiceModalOpen(true)
  }

  // Sync active session with URL ?session=...
  React.useEffect(() => {
    if (sessionId) {
      const existing = getChatSession(sessionId)
      if (existing) {
        setMessages(existing.messages)
        setActiveSessionId(existing.id)
      } else {
        setMessages([])
        setActiveSessionId(null)
      }
    } else if (!topic) {
      // Empty state for New Chat
      setMessages([])
      setActiveSessionId(null)
    }
  }, [sessionId, topic])

  // Auto-resize textarea
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`
    }
  }, [input])

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Confirmations the owner has already answered (Confirm/Cancel),
  // keyed by message id + action index — a preview must be
  // answerable exactly once.
  const [answeredConfirm, setAnsweredConfirm] = React.useState<Record<string, boolean>>({})

  const handleSend = React.useCallback(async (textToSend?: string) => {
    const query = (textToSend || input).trim()
    if (!query || loading) return

    const now = new Date()
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: timeStr
    }

    let currSessionId = activeSessionId
    let currTitle = ''

    // If starting a brand new conversation, create session immediately
    if (!currSessionId) {
      const newSession = createNewSession(query)
      currSessionId = newSession.id
      currTitle = newSession.title
      setActiveSessionId(currSessionId)
      saveChatSession({
        ...newSession,
        messages: [userMsg]
      })
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/chat?session=${currSessionId}`)
      }
    }

    const updatedHistory = [...messages, userMsg]
    setMessages(updatedHistory)
    setInput('')
    setShowAttachMenu(false)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedHistory.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            content: m.content
          }))
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Request failed with HTTP ${res.status}`)
      }

      const assistantMsgId = (Date.now() + 1).toString()
      const assistantTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      let currentContent = ''
      let currentThinking = ''
      let currentStatus = 'Analyzing business request...'
      let currentActions: ActionReceipt[] = []

      // Create streaming message placeholder with initial thinking status
      setMessages(prev => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          timestamp: assistantTimestamp,
          status: currentStatus,
          thinking: '',
          actions: []
        }
      ])

      const contentType = res.headers.get('content-type') || ''

      if (contentType.includes('text/event-stream')) {
        const reader = res.body?.getReader()
        if (!reader) throw new Error('No readable stream received from server.')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const jsonStr = trimmed.slice(5).trim()
            if (!jsonStr) continue

            try {
              const event = JSON.parse(jsonStr)
              if (event.type === 'status') {
                currentStatus = event.message || ''
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMsgId
                      ? { ...m, status: currentStatus }
                      : m
                  )
                )
              } else if (event.type === 'thinking' && event.text) {
                currentThinking = (currentThinking ? currentThinking + '\n' : '') + event.text
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMsgId
                      ? { ...m, thinking: currentThinking }
                      : m
                  )
                )
              } else if (event.type === 'action' && event.action) {
                currentActions = [...currentActions, event.action]
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMsgId
                      ? { ...m, actions: [...currentActions] }
                      : m
                  )
                )
              } else if (event.type === 'delta' && event.text) {
                currentContent += event.text
                currentStatus = ''
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMsgId
                      ? { ...m, content: currentContent, status: '' }
                      : m
                  )
                )
              } else if (event.type === 'error' && event.error) {
                currentContent += `\n\n⚠️ **Agent Error**: ${event.error}`
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMsgId
                      ? { ...m, content: currentContent, status: '' }
                      : m
                  )
                )
              }
            } catch {}
          }
        }
      } else {
        const data = await res.json()
        currentContent = data.reply || 'Operation executed successfully.'
        currentActions = data.actionsExecuted || []
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsgId
              ? { ...m, content: currentContent, actions: currentActions, status: '' }
              : m
          )
        )
      }

      // Persist full conversation to active session
      const finalAssistantMsg: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: currentContent || 'Operation executed successfully.',
        timestamp: assistantTimestamp,
        actions: currentActions,
        thinking: currentThinking || undefined,
        status: undefined
      }

      const fullHistory = [...updatedHistory, finalAssistantMsg]
      if (currSessionId) {
        const existing = getChatSession(currSessionId)
        saveChatSession({
          id: currSessionId,
          title: existing?.title || currTitle || query.slice(0, 28),
          createdAt: existing?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: fullHistory
        })
      }
    } catch (err: unknown) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ **Agent Error**: ${err instanceof Error ? err.message : 'Failed to connect to database service.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setMessages(prev => {
        const filtered = prev.filter(m => m.content !== '' || m.role !== 'assistant')
        return [...filtered, errorMsg]
      })
      if (currSessionId) {
        const existing = getChatSession(currSessionId)
        saveChatSession({
          id: currSessionId,
          title: existing?.title || currTitle || query.slice(0, 28),
          createdAt: existing?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [...updatedHistory, errorMsg]
        })
      }
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, activeSessionId])

  // When clicking a tree sub-item topic in the sidebar, trigger topic prompt
  // (once per topic — the ref stops handleSend's identity changes
  // from re-firing the preset on every message).
  const topicSentRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (topic && TOPIC_PRESETS[topic] && topicSentRef.current !== topic) {
      topicSentRef.current = topic
      handleSend(TOPIC_PRESETS[topic])
    }
  }, [topic, handleSend])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -m-4 md:-m-6 bg-background text-foreground overflow-hidden select-none transition-colors">
      


      {/* ============================================================ */}
      {/* CONVERSATION CANVAS (Matches Theme)                          */}
      {/* ============================================================ */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6">
        <div className="max-w-[768px] mx-auto h-full flex flex-col">

          {/* EMPTY STATE: "Where should we begin?" (Matches Theme) */}
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center items-center pb-24">
              <h1 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight mb-8 text-center animate-in fade-in duration-300">
                Where should we begin?
              </h1>

              {/* Centered Capsule Input Bar */}
              <div className="w-full max-w-[720px] relative">
                <div className="relative rounded-[28px] bg-card border border-border/80 shadow-md p-2 pl-3 transition-all focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
                  <div className="flex items-center gap-2">
                    {/* + Quick Actions Button */}
                    <button
                      type="button"
                      onClick={() => setShowAttachMenu(!showAttachMenu)}
                      className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                      title="Quick database actions"
                    >
                      <Plus className="h-4 w-4" />
                    </button>

                    {/* Input textarea */}
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask anything"
                      rows={1}
                      className="chat-input-textarea w-full resize-none border-0 border-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none shadow-none py-1.5 min-h-[36px] max-h-[160px] leading-relaxed select-text"
                      style={{
                        border: 'none',
                        boxShadow: 'none',
                        outline: 'none',
                        background: 'transparent',
                      }}
                    />

                    {/* Right Action Icons: Think, Mic, Send */}
                    <div className="flex items-center gap-1.5 shrink-0 pr-1">
                      <button
                        type="button"
                        onClick={() => setThinkMode(!thinkMode)}
                        className={`h-7 px-2.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors ${
                          thinkMode 
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' 
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                        title="Reasoning mode"
                      >
                        <Lightbulb className="h-3.5 w-3.5" />
                        <span>Think</span>
                      </button>

                      <button
                        type="button"
                        className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Voice input"
                      >
                        <Mic className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSend()}
                        disabled={!input.trim() || loading}
                        className={`h-8 w-8 rounded-full flex items-center justify-center transition-all shadow-xs ${
                          input.trim()
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : 'bg-muted text-muted-foreground/40 cursor-not-allowed'
                        }`}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Action Dropdown Menu */}
                  {showAttachMenu && (
                    <div className="absolute top-full left-0 mt-2 w-64 rounded-2xl bg-popover text-popover-foreground border border-border shadow-xl p-1.5 z-30 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                      <button
                        onClick={() => handleSend('Add a new product: Smoked Cheddar Cheese, SKU CHD-02, cost Rs 900, price Rs 1,800, category Dairy, stock 30')}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted text-xs text-left text-foreground transition-colors"
                      >
                        <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <div>
                          <div className="font-medium">Add Product</div>
                          <div className="text-[10px] text-muted-foreground">Catalog, pricing & stock</div>
                        </div>
                      </button>
                      <button
                        onClick={() => handleSend('Record attendance for employee today as Present with arrival 09:00 AM')}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted text-xs text-left text-foreground transition-colors"
                      >
                        <CalendarCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <div>
                          <div className="font-medium">Log Attendance</div>
                          <div className="text-[10px] text-muted-foreground">Daily staff check-in</div>
                        </div>
                      </button>
                      <button
                        onClick={() => handleSend('Log an expense of Rs 15,000 for Kitchen Supplies under Maintenance')}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted text-xs text-left text-foreground transition-colors"
                      >
                        <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <div>
                          <div className="font-medium">Record Expense</div>
                          <div className="text-[10px] text-muted-foreground">Utilities & bills</div>
                        </div>
                      </button>
                      <button
                        onClick={() => handleSend('Assign an urgent task to audit refrigerator temperatures due tomorrow')}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted text-xs text-left text-foreground transition-colors"
                      >
                        <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <div>
                          <div className="font-medium">Assign Task</div>
                          <div className="text-[10px] text-muted-foreground">Operational duty</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* MESSAGE THREAD (Matches Theme) */
            <div className="py-6 space-y-6 flex-1 select-text">
              {messages.map(msg => (
                <div key={msg.id} className="space-y-2 group">
                  {msg.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="max-w-[75%] rounded-[22px] px-4 py-2.5 bg-primary text-primary-foreground text-sm leading-relaxed shadow-xs">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4 justify-start">
                      <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 space-y-3">
                        {/* Live Thinking / Status Accordion */}
                        {(msg.thinking || msg.status) && (
                          <ThinkingBlock thinking={msg.thinking} status={msg.status} />
                        )}

                        <div className="text-sm leading-relaxed text-foreground">
                          {msg.content ? (
                            <MarkdownContent content={msg.content} />
                          ) : !msg.thinking && !msg.status ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                              <span>Consulting ERP intelligence...</span>
                            </div>
                          ) : null}
                        </div>

                        {/* Database Mutation Action Receipts */}
                        {msg.actions && msg.actions.length > 0 && (
                          <div className="pt-2 space-y-2 max-w-xl">
                            <div className="text-[11px] font-semibold flex items-center gap-1.5 text-primary uppercase tracking-wider">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Database Committed:
                            </div>
                            {msg.actions.map((act, i) => {
                              // Only show invoice print button for actual sales checkout transactions, not reports or queries
                              const isCheckout = (act.action === 'Sale Checkout Completed' || 
                                                  act.action?.toLowerCase().includes('checkout')) &&
                                                  !act.action?.toLowerCase().includes('query') &&
                                                  !act.action?.toLowerCase().includes('history')
                              
                              const extractedInv = act.details?.match(/INV-[A-Za-z0-9-]+/)
                              const invNum = act.data?.invoice_number || (extractedInv ? extractedInv[0] : null)

                              return (
                                <div
                                  key={i}
                                  className="p-3.5 rounded-xl bg-card border border-border text-xs space-y-2 shadow-2xs"
                                >
                                  <div className="font-semibold text-foreground flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                      <Database className="h-3.5 w-3.5 text-primary" />
                                      {act.action}
                                    </span>
                                    <Badge
                                      variant={act.requiresConfirmation ? 'outline' : act.success ? 'default' : 'destructive'}
                                      className="text-[9px] h-4 py-0"
                                    >
                                      {act.requiresConfirmation ? 'Needs confirmation' : act.success ? 'Success' : 'Failed'}
                                    </Badge>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground leading-normal">{act.details}</p>

                                  {/* Confirmation step (QA audit M12): a financial
                                      write only happens after the owner confirms
                                      this preview — Confirm sends an explicit
                                      confirmation, Cancel drops it. */}
                                  {act.requiresConfirmation && !answeredConfirm[`${msg.id}:${i}`] && (
                                    <div className="flex items-center gap-2 pt-1">
                                      <Button
                                        type="button"
                                        size="sm"
                                        disabled={loading}
                                        onClick={() => {
                                          setAnsweredConfirm(prev => ({ ...prev, [`${msg.id}:${i}`]: true }))
                                          handleSend('Yes, confirmed — please proceed with the above.')
                                        }}
                                        className="h-7 px-3 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer font-medium rounded-lg"
                                      >
                                        Confirm
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={loading}
                                        onClick={() => {
                                          setAnsweredConfirm(prev => ({ ...prev, [`${msg.id}:${i}`]: true }))
                                          handleSend('Cancelled — do not proceed with the above.')
                                        }}
                                        className="h-7 px-3 text-xs cursor-pointer font-medium rounded-lg"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  )}

                                  {/* View & Print Invoice Button - Only on Sales Checkouts */}
                                  {isCheckout && invNum && (
                                    <div className="pt-1">
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => handleOpenInvoice(invNum, act.data as InvoiceModalData)}
                                        className="h-7 px-3 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-500 shadow-xs cursor-pointer font-medium rounded-lg"
                                      >
                                        <Receipt className="h-3.5 w-3.5" />
                                        <span>View & Print Invoice ({invNum})</span>
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
                            title="Copy"
                          >
                            {copiedId === msg.id ? (
                              <Check className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {loading && !messages.some(m => m.role === 'assistant') && (
                <div className="flex gap-4 items-center text-xs text-muted-foreground">
                  <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span>Executing database actions...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* BOTTOM PINNED INPUT (When messages exist)                    */}
      {/* ============================================================ */}
      {messages.length > 0 && (
        <div className="p-4 bg-gradient-to-t from-background via-background to-transparent pt-3 transition-colors">
          <div className="max-w-[768px] mx-auto">
            <div className="relative rounded-[28px] bg-card border border-border/80 shadow-md p-2 pl-3 transition-all focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                  title="Quick actions"
                >
                  <Plus className="h-4 w-4" />
                </button>

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything"
                  rows={1}
                  className="chat-input-textarea w-full resize-none border-0 border-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none shadow-none py-1.5 min-h-[36px] max-h-[160px] leading-relaxed select-text"
                  style={{
                    border: 'none',
                    boxShadow: 'none',
                    outline: 'none',
                    background: 'transparent',
                  }}
                />

                <div className="flex items-center gap-1.5 shrink-0 pr-1">
                  <button
                    type="button"
                    onClick={() => setThinkMode(!thinkMode)}
                    className={`h-7 px-2.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      thinkMode 
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                    title="Reasoning mode"
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Think</span>
                  </button>

                  <button
                    type="button"
                    className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Voice input"
                  >
                    <Mic className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={!input.trim() || loading}
                    className={`h-8 w-8 rounded-full flex items-center justify-center transition-all shadow-xs ${
                      input.trim()
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-muted text-muted-foreground/40 cursor-not-allowed'
                    }`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {showAttachMenu && (
                <div className="absolute bottom-full left-0 mb-2 w-64 rounded-2xl bg-popover text-popover-foreground border border-border shadow-xl p-1.5 z-30 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={() => handleSend('Add a new product: Smoked Cheddar Cheese, SKU CHD-02, cost Rs 900, price Rs 1,800, category Dairy, stock 30')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted text-xs text-left text-foreground transition-colors"
                  >
                    <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <div>
                      <div className="font-medium">Add Product</div>
                      <div className="text-[10px] text-muted-foreground">Catalog & stock</div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleSend('Record attendance for employee today as Present with arrival 09:00 AM')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted text-xs text-left text-foreground transition-colors"
                  >
                    <CalendarCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <div>
                      <div className="font-medium">Log Attendance</div>
                      <div className="text-[10px] text-muted-foreground">Staff check-in</div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleSend('Log an expense of Rs 15,000 for Kitchen Supplies under Maintenance')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted text-xs text-left text-foreground transition-colors"
                  >
                    <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <div>
                      <div className="font-medium">Record Expense</div>
                      <div className="text-[10px] text-muted-foreground">Utilities & bills</div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleSend('Assign an urgent task to audit refrigerator temperatures due tomorrow')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted text-xs text-left text-foreground transition-colors"
                  >
                    <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <div>
                      <div className="font-medium">Assign Task</div>
                      <div className="text-[10px] text-muted-foreground">Operational duty</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Global Traders AI directly manipulates your live database. Check details before making critical changes.
            </p>
          </div>
        </div>
      )}

      {/* Invoice View & Print Dialog */}
      <InvoiceModal
        open={invoiceModalOpen}
        onOpenChange={setInvoiceModalOpen}
        invoiceNumber={selectedInvoice.number}
        initialData={selectedInvoice.data}
      />
    </div>
  )
}
