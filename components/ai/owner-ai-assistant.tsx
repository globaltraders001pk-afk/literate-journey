'use client'

import * as React from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { MarkdownContent } from '@/components/ai/markdown-content'
import { 
  Sparkles, 
  Send, 
  Loader2, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Database,
  ArrowRight,
  ShieldCheck,
  Package,
  CalendarCheck,
  DollarSign,
  ClipboardList,
  Maximize2,
  Receipt,
  Brain,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { InvoiceModal, InvoiceModalData } from '@/components/ai/invoice-modal'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  status?: string
  actions?: Array<{
    action: string
    details: string
    success: boolean
  }>
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

const DEFAULT_PROMPTS = [
  {
    icon: Package,
    label: 'Add Product',
    prompt: 'Add a new product: Mozzarella Cheese Wheel, SKU MOZ-01, cost 8, price 16, category Dairy, stock 25'
  },
  {
    icon: CalendarCheck,
    label: 'Record Attendance',
    prompt: 'Record attendance for employee today as Present with arrival time 09:00 AM'
  },
  {
    icon: DollarSign,
    label: 'Log Expense',
    prompt: 'Log an expense of $120 for Kitchen Utensils under Maintenance category'
  },
  {
    icon: ClipboardList,
    label: 'Assign Task',
    prompt: 'Assign an urgent task to audit refrigerator temperatures due tomorrow'
  }
]

export function OwnerAIAssistant({ isOwner }: { isOwner: boolean }) {
  if (!isOwner) return null

  const [open, setOpen] = React.useState(false)
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  const [selectedInvoice, setSelectedInvoice] = React.useState<{ number: string | null; data: InvoiceModalData | null }>({ number: null, data: null })
  const [invoiceModalOpen, setInvoiceModalOpen] = React.useState(false)

  const handleOpenInvoice = (invNum: string, invoiceData?: any) => {
    setSelectedInvoice({ number: invNum, data: invoiceData || null })
    setInvoiceModalOpen(true)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  React.useEffect(() => {
    if (open) {
      scrollToBottom()
    }
  }, [messages, open])

  async function handleSend(textToSend?: string) {
    const query = (textToSend || input).trim()
    if (!query || loading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query
    }

    const updatedHistory = [...messages, userMsg]
    setMessages(updatedHistory)
    setInput('')
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
        throw new Error(errData.error || `Request failed with status ${res.status}`)
      }

      const assistantMsgId = (Date.now() + 1).toString()
      let currentContent = ''
      let currentThinking = ''
      let currentStatus = 'Analyzing business request...'
      let currentActions: any[] = []

      // Create streaming message placeholder with initial thinking status
      setMessages(prev => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
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
            } catch (e) {}
          }
        }
      } else {
        const data = await res.json()
        currentContent = data.reply || 'Operation processed.'
        currentActions = data.actionsExecuted || []
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsgId
              ? { ...m, content: currentContent, actions: currentActions, status: '' }
              : m
          )
        )
      }
    } catch (err: any) {
      setMessages(prev => {
        const filtered = prev.filter(m => m.content !== '' || m.role !== 'assistant')
        return [
          ...filtered,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `⚠️ **Agent Error**: ${err?.message || 'Failed to connect to the ERP Agent service.'}`
          }
        ]
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        {/* Floating AI Agent Trigger Button */}
        <div className="fixed bottom-6 right-6 z-40">
          <SheetTrigger render={
            <Button
              size="lg"
              className="h-14 px-5 rounded-full shadow-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 hover:from-emerald-500 hover:to-cyan-600 text-white font-medium border border-emerald-400/30 flex items-center gap-3 group transition-all duration-300 hover:scale-105"
            />
          }>
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-white" />
            </span>
            <Sparkles className="h-5 w-5 transition-transform group-hover:rotate-12" />
            <span className="hidden sm:inline font-semibold tracking-wide">Owner AI Agent</span>
          </SheetTrigger>
        </div>

        {/* Slide-over Assistant Drawer */}
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-lg p-0 flex flex-col h-full bg-background border-l shadow-2xl"
        >
          {/* Drawer Header */}
          <SheetHeader className="p-4 border-b bg-muted/30 flex-row items-center justify-between space-y-0">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <SheetTitle className="text-base font-semibold flex items-center gap-2">
                    Qurbat AI Agent
                    <Badge variant="outline" className="text-[10px] py-0 border-emerald-500/30 text-emerald-600 bg-emerald-500/5">
                      <ShieldCheck className="h-3 w-3 mr-1" /> Owner Mode
                    </Badge>
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground">
                    Direct database manipulation & operational commands
                  </SheetDescription>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Link 
                href="/chat" 
                onClick={() => setOpen(false)}
                className="h-8 px-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
                title="Open Full Page ChatGPT UI"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Full Page</span>
              </Link>
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Clear Conversation"
                  onClick={() => setMessages([])}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </SheetHeader>

          {/* Conversation Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-center px-4 space-y-6">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600">
                  <Database className="h-8 w-8" />
                </div>
                <div className="space-y-2 max-w-sm">
                  <h3 className="font-semibold text-lg">Autonomous Database Assistant</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Tell me what to do in natural language. I can insert products, log attendance, adjust stock movements, register vendors, record expenses, or run financial summaries directly on your database.
                  </p>
                </div>

                {/* Quick Prompts */}
                <div className="w-full space-y-2 pt-2">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Quick Action Commands
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {DEFAULT_PROMPTS.map((item, idx) => {
                      const Icon = item.icon
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSend(item.prompt)}
                          className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30 hover:bg-muted/70 text-left text-xs transition-colors group"
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span className="font-medium text-foreground">{item.label}</span>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-xs'
                        : 'bg-muted/60 text-foreground border rounded-bl-xs'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    ) : (
                      <>
                        {/* Live Thinking / Status Accordion */}
                        {(msg.thinking || msg.status) && (
                          <ThinkingBlock thinking={msg.thinking} status={msg.status} />
                        )}

                        {msg.content ? (
                          <MarkdownContent content={msg.content} />
                        ) : !msg.thinking && !msg.status ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                            <span>Consulting ERP intelligence...</span>
                          </div>
                        ) : null}
                      </>
                    )}

                    {/* Action Receipts if DB tools were executed */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-border/50 space-y-2">
                        <div className="text-[11px] font-semibold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Database Mutations Executed:
                        </div>
                        {msg.actions.map((act, i) => {
                          const isCheckout = (act.action === 'Sale Checkout Completed' || 
                                              act.action?.toLowerCase().includes('checkout')) &&
                                              !act.action?.toLowerCase().includes('query') &&
                                              !act.action?.toLowerCase().includes('history')
                          
                          const extractedInv = act.details?.match(/INV-[A-Za-z0-9-]+/)
                          const invNum = (act as any).data?.invoice_number || (extractedInv ? extractedInv[0] : null)

                          return (
                            <div
                              key={i}
                              className="p-2.5 rounded-lg bg-background/90 border text-xs space-y-1.5 shadow-2xs"
                            >
                              <div className="font-semibold text-foreground flex items-center justify-between">
                                <span>{act.action}</span>
                                <Badge
                                  variant={act.success ? 'default' : 'destructive'}
                                  className="text-[9px] h-4 py-0"
                                >
                                  {act.success ? 'Success' : 'Failed'}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-normal">{act.details}</p>

                              {/* View & Print Invoice Button - Only on Sales Checkouts */}
                              {isCheckout && invNum && (
                                <div className="pt-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleOpenInvoice(invNum, (act as any).data)}
                                    className="h-6 px-2.5 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer font-medium rounded-md"
                                  >
                                    <Receipt className="h-3 w-3" />
                                    <span>View & Print Invoice ({invNum})</span>
                                  </Button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {loading && !messages.some(m => m.role === 'assistant') && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/40 border max-w-[75%] text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600 shrink-0" />
                <span>Consulting ERP intelligence...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Drawer Footer Input */}
          <div className="p-3 border-t bg-background/95 backdrop-blur-md">
            <form
              onSubmit={e => {
                e.preventDefault()
                handleSend()
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Instruct the AI: e.g. Add product, record attendance..."
                disabled={loading}
                className="text-xs h-10"
              />
              <Button
                type="submit"
                size="sm"
                disabled={loading || !input.trim()}
                className="h-10 px-3 shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
            <p className="text-[10px] text-muted-foreground mt-1.5 px-1 text-center">
              Directly executes authenticated actions in Supabase for your organization.
            </p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Invoice Modal for View & Print */}
      <InvoiceModal
        open={invoiceModalOpen}
        onOpenChange={setInvoiceModalOpen}
        invoiceNumber={selectedInvoice.number}
        initialData={selectedInvoice.data}
      />
    </>
  )
}
