import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Sparkles, Mic, ArrowUp } from 'lucide-react'

export default function ChatLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -m-4 md:-m-6 bg-background text-foreground overflow-hidden animate-in fade-in-50 duration-200">
      <div className="flex-1 overflow-y-auto px-4 md:px-6">
        <div className="max-w-[768px] mx-auto h-full flex flex-col justify-center items-center pb-24">
          {/* Centered Heading */}
          <h1 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight mb-8 text-center">
            Where should we begin?
          </h1>

          {/* Centered Capsule Input Bar */}
          <div className="w-full max-w-[720px]">
            <div className="rounded-[28px] bg-card border border-border/80 shadow-md p-2 pl-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground shrink-0">
                  <Plus className="h-4 w-4" />
                </div>

                <div className="w-full py-1.5 min-h-[36px] flex items-center">
                  <span className="text-sm text-muted-foreground">Ask anything</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 pr-1">
                  <div className="h-7 px-2.5 rounded-full text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500/60" />
                    <span>Think</span>
                  </div>
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground">
                    <Mic className="h-4 w-4" />
                  </div>
                  <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                    <ArrowUp className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Topic Chips */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              {[
                'Show me inventory products and stock levels',
                'Check staff attendance logs for today',
                'Summarize operational expenses and cash flow',
                'List all pending and active tasks'
              ].map((topic, i) => (
                <div 
                  key={i} 
                  className="px-3 py-1.5 rounded-full text-xs border border-border/60 bg-muted/20 text-muted-foreground"
                >
                  {topic}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
