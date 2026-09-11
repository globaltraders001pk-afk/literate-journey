import { ERP_TOOLS } from './tools'
import { executeErpTool, ToolExecutionResult } from './executor'

export interface ChatMessage {
  role: 'user' | 'model' | 'assistant'
  content: string
}

export interface AgentRunResponse {
  reply: string
  actionsExecuted: ToolExecutionResult[]
}

const SYSTEM_INSTRUCTION = `You are the executive AI Command Agent for Qurbat ERP, an enterprise business, inventory, and point-of-sale management system.
You exclusively serve the Business Owner. You have direct authorization to manipulate the live database through your tools.

Core Instructions:
1. When the owner asks you to add, edit, or adjust anything (products, stock, batches, attendance, employees, vendors, purchase orders, expenses, tasks, settings, customers, sales, POS checkout), call the appropriate tool immediately.
2. Sales & POS Checkout: When the owner asks to create a checkout, ring up a sale, or sell items (e.g., "Create a checkout for 50 Lays cash", "Sell 2 burgers"), call 'create_sale_checkout' immediately. It automatically finds the product, calculates the totals, logs the invoice, records the payment method, and deducts the inventory stock.
3. Sales History & Reports: When the owner asks for sales reports, selling history, or revenue over past days/weeks/months (e.g., "Generate a report of the past 50 days of my selling", "Show past 30 days sales"), call 'query_sales_history' immediately with the requested days or period (e.g., days: 50). Then present a crisp, clean executive sales report with summary metrics, revenue totals, and clear tables. Do NOT add unnecessary technical boilerplate or meta-commentary.
4. If details are missing when creating records (e.g., payment method, SKU, unit, role, hire date), infer sensible defaults (e.g. payment_method 'CASH', unit 'pcs', auto-generated SKU, today's date, role 'Staff') so the owner never has to deal with tedious paperwork.
5. If the owner asks for summaries, financial status, expiring batches, low stock, sales history, or tasks, use your query tools to pull live database records.
6. Confirm what changes were committed to the database. Never hallucinate successful database operations without calling the corresponding tool.

Multilingual & Roman Urdu / Hindi Rules:
You understand English, Roman Urdu, and Hindi naturally:
- In Roman Urdu / Hindi: "or" / "aur" means "and" (NOT an English disjunction). For example: "Araf or Fasih k" means "Araf AND Fasih".
- "baki sab ko absent krdo" means "mark all other employees absent".
- "kardo", "krdo", "laga do", "daal do" means "do it / record it / add it".
- Always interpret the owner's true intent without confusion, execute the database tools, and respond in clean English with structured markdown.
- NEVER output your internal thinking, chain of thought, or raw tokens. Output only the final executive response.

Formatting & Response Structure (CRITICAL):
Always format your responses in a clean, executive, highly-structured Markdown presentation. Avoid unformatted walls of text. Follow this consistent layout:

1. **Executive Status Header**:
   - Begin with a clear, bold status heading with an appropriate emoji (e.g., "### ✅ Employee Registered Successfully", "### 📦 Product Added to Inventory", "### 📊 Sales Report (Past 50 Days)").
   - Follow with a 1-sentence executive summary confirming the result or total revenue.

2. **Structured Record Details**:
   - Whenever creating, updating, or viewing an individual entity (employee, product, expense, vendor, task, batch), ALWAYS present the key fields in a clean Markdown Table.
   - Whenever returning multiple records or reports (low stock, recent expenses, sales history, employee lists, tasks), ALWAYS organize them into a clean Markdown Table with intuitive columns (e.g., Date, Invoice, Customer, Payment, Amount).

3. **Inferred Defaults & Assumptions (Entity Creation ONLY)**:
   - ONLY include this section when CREATING or REGISTERING new records (like an employee, product, vendor) where optional business fields were omitted and you assigned standard defaults (e.g., auto-generated SKU, default role 'Staff', unit 'pcs').
   - NEVER include "Auto-Assigned Defaults" for query/analytics reports, sales reports, financial summaries, or read-only requests. Do NOT mention internal parameters or date interpretations. Reports must contain only business metrics and clean data.

4. **Actionable Next Steps**:
   - Provide 1 or 2 concise, high-value business insights or next steps under:
     #### 💡 Recommended Next Actions
     * Suggestion 1
     * Suggestion 2

Keep the response crisp, professional, and visually structured.`

function cleanJsonSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema
  if (Array.isArray(schema)) return schema.map(cleanJsonSchema)
  
  const cleaned: any = {}
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'type' && typeof v === 'string') {
      cleaned[k] = v.toLowerCase()
    } else if (typeof v === 'object' && v !== null) {
      cleaned[k] = cleanJsonSchema(v)
    } else {
      cleaned[k] = v
    }
  }
  return cleaned
}

function getOpenRouterTools() {
  return ERP_TOOLS.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: cleanJsonSchema({
        type: 'object',
        properties: t.parameters.properties || {},
        required: t.parameters.required || []
      })
    }
  }))
}

function cleanModelReply(raw: string): string {
  if (!raw) return 'Operation processed.'
  return raw
    .replace(/<unk>/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim() || 'Operation processed.'
}

async function runOpenRouterAgent(
  messages: ChatMessage[],
  profile: { id: string; role: string; organization_id: string; full_name: string },
  apiKey: string
): Promise<AgentRunResponse> {
  const primaryModel = process.env.OPENROUTER_MODEL || 'openrouter/free'
  const fallbackModels = [
    primaryModel,
    'openrouter/free',
    'meta-llama/llama-3.3-70b-instruct:free'
  ]
    .filter((m, idx, arr) => arr.indexOf(m) === idx)
    .slice(0, 3)

  const endpoint = 'https://openrouter.ai/api/v1/chat/completions'
  const tools = getOpenRouterTools()

  const openAiMessages: any[] = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    ...messages.map(m => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
      content: m.content
    }))
  ]

  const actionsExecuted: ToolExecutionResult[] = []
  let loopCount = 0
  const MAX_LOOPS = 5

  while (loopCount < MAX_LOOPS) {
    loopCount++

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Qurbat ERP'
      },
      body: JSON.stringify({
        model: primaryModel,
        ...(fallbackModels.length > 1 ? { models: fallbackModels } : {}),
        messages: openAiMessages,
        tools,
        temperature: 0.2
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenRouter API error response:', errorText)
      throw new Error(`OpenRouter (${response.status}): ${errorText}`)
    }

    const data = await response.json()

    // 1. Explicitly detect OpenRouter API error payloads in body
    if (data.error) {
      console.error('OpenRouter returned error payload:', data.error)
      throw new Error(`OpenRouter Error: ${data.error.message || JSON.stringify(data.error)}`)
    }

    const choice = data.choices?.[0]?.message
    if (!choice) {
      if (actionsExecuted.length > 0) {
        return {
          reply: `### ✅ Operations Executed\n\nSuccessfully committed ${actionsExecuted.length} database operation(s).`,
          actionsExecuted
        }
      }
      throw new Error(`OpenRouter returned no message choices. (Model: ${data.model || primaryModel})`)
    }

    const toolCalls = choice.tool_calls || []
    if (!toolCalls.length) {
      const rawText = choice.content || choice.reasoning || (choice as any).text || ''
      const cleaned = cleanModelReply(rawText)
      if (!cleaned || cleaned === 'Operation processed.') {
        if (actionsExecuted.length > 0) {
          return {
            reply: `### ✅ Request Completed\n\nSuccessfully executed ${actionsExecuted.length} database action(s).`,
            actionsExecuted
          }
        }
      }
      return {
        reply: cleaned || 'Operation processed successfully.',
        actionsExecuted
      }
    }

    // Append model assistant message with tool calls
    openAiMessages.push(choice)

    // Execute each requested tool call
    for (const tc of toolCalls) {
      let args: any = {}
      try {
        args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : (tc.function.arguments || {})
      } catch (e) {
        args = {}
      }

      const executionResult = await executeErpTool(tc.function.name, args || {}, profile)
      actionsExecuted.push(executionResult)

      openAiMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify({
          success: executionResult.success,
          action: executionResult.action,
          details: executionResult.details,
          data: executionResult.data
        })
      })
    }
  }

  return {
    reply: 'Completed requested operations.',
    actionsExecuted
  }
}

async function runGeminiAgent(
  messages: ChatMessage[],
  profile: { id: string; role: string; organization_id: string; full_name: string },
  apiKey: string
): Promise<AgentRunResponse> {
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`

  const contents: any[] = messages.map(m => ({
    role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }))

  const actionsExecuted: ToolExecutionResult[] = []
  let loopCount = 0
  const MAX_LOOPS = 5

  while (loopCount < MAX_LOOPS) {
    loopCount++

    const requestBody = {
      system_instruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      contents,
      tools: [
        {
          function_declarations: ERP_TOOLS
        }
      ],
      generation_config: {
        temperature: 0.2
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error response:', errorText)
      throw new Error(`Gemini API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    const candidate = data.candidates?.[0]
    if (!candidate || !candidate.content) {
      return {
        reply: 'The AI model returned an empty response.',
        actionsExecuted
      }
    }

    const parts = candidate.content.parts || []
    const functionCallPart = parts.find((p: any) => p.functionCall)

    if (!functionCallPart) {
      const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text).join('\n')
      return {
        reply: textParts || 'Operation processed.',
        actionsExecuted
      }
    }

    // Process the function call
    const { name: toolName, args: toolArgs } = functionCallPart.functionCall
    const executionResult = await executeErpTool(toolName, toolArgs || {}, profile)
    actionsExecuted.push(executionResult)

    // Append model's function call message to contents (preserves thoughtSignature and all parts)
    contents.push(candidate.content)

    // Append tool response message to contents (Gemini API requires 'user' role for functionResponse)
    contents.push({
      role: 'user',
      parts: [
        {
          functionResponse: {
            name: toolName,
            response: {
              success: executionResult.success,
              action: executionResult.action,
              details: executionResult.details,
              data: executionResult.data
            }
          }
        }
      ]
    })
  }

  return {
    reply: 'Completed requested operations.',
    actionsExecuted
  }
}

export async function runErpAgent(
  messages: ChatMessage[],
  profile: { id: string; role: string; organization_id: string; full_name: string }
): Promise<AgentRunResponse> {
  const openRouterKey = process.env.OPENROUTER_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY

  // 1. Try OpenRouter if key is present
  if (openRouterKey) {
    try {
      return await runOpenRouterAgent(messages, profile, openRouterKey)
    } catch (err: any) {
      console.error('OpenRouter execution error:', err?.message || err)
      // If Gemini key is also available, attempt fallback
      if (geminiKey) {
        console.log('Falling back to Google Gemini API...')
        try {
          return await runGeminiAgent(messages, profile, geminiKey)
        } catch (geminiErr: any) {
          console.error('Gemini fallback also failed:', geminiErr?.message || geminiErr)
        }
      }
      return {
        reply: `⚠️ **AI Service Error**: Could not complete request via OpenRouter. ${err?.message || ''}`,
        actionsExecuted: []
      }
    }
  }

  // 2. Fallback to Gemini if OpenRouter key is not set
  if (geminiKey) {
    try {
      return await runGeminiAgent(messages, profile, geminiKey)
    } catch (err: any) {
      return {
        reply: `⚠️ **AI Service Error**: ${err?.message || 'Error connecting to Gemini AI.'}`,
        actionsExecuted: []
      }
    }
  }

  return {
    reply: '⚠️ **API Key Missing**: Please set `OPENROUTER_API_KEY` or `GEMINI_API_KEY` in your `.env.local` file to enable the AI Agent.',
    actionsExecuted: []
  }
}

export type StreamEvent =
  | { type: 'status'; message: string }
  | { type: 'thinking'; text: string }
  | { type: 'action'; action: ToolExecutionResult }
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; error: string }

async function runOpenRouterAgentWithStreaming(
  messages: ChatMessage[],
  profile: { id: string; role: string; organization_id: string; full_name: string },
  apiKey: string,
  sendEvent: (event: StreamEvent) => void
): Promise<void> {
  const primaryModel = process.env.OPENROUTER_MODEL || 'openrouter/free'
  const fallbackModels = [
    primaryModel,
    'openrouter/free',
    'meta-llama/llama-3.3-70b-instruct:free'
  ]
    .filter((m, idx, arr) => arr.indexOf(m) === idx)
    .slice(0, 3)

  const endpoint = 'https://openrouter.ai/api/v1/chat/completions'
  const tools = getOpenRouterTools()

  const openAiMessages: any[] = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    ...messages.map(m => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
      content: m.content
    }))
  ]

  sendEvent({ type: 'status', message: 'Analyzing business request...' })

  let loopCount = 0
  const MAX_LOOPS = 5

  while (loopCount < MAX_LOOPS) {
    loopCount++

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Qurbat ERP'
      },
      body: JSON.stringify({
        model: primaryModel,
        ...(fallbackModels.length > 1 ? { models: fallbackModels } : {}),
        messages: openAiMessages,
        tools,
        include_reasoning: true,
        temperature: 0.2
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenRouter (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    if (data.error) {
      throw new Error(`OpenRouter Error: ${data.error.message || JSON.stringify(data.error)}`)
    }

    const choice = data.choices?.[0]?.message
    if (!choice) {
      throw new Error(`OpenRouter returned no message choices.`)
    }

    // Extract thinking/reasoning if provided by the model
    const reasoningText = choice.reasoning || (choice as any).reasoning_content || ''
    if (reasoningText) {
      sendEvent({ type: 'thinking', text: reasoningText })
    }

    const thinkMatch = (choice.content || '').match(/<think>([\s\S]*?)<\/think>/i)
    if (thinkMatch) {
      sendEvent({ type: 'thinking', text: thinkMatch[1].trim() })
    }

    const toolCalls = choice.tool_calls || []

    if (!toolCalls.length) {
      sendEvent({ type: 'status', message: '' })
      const rawText = choice.content || choice.reasoning || (choice as any).text || ''
      const cleaned = cleanModelReply(rawText)
      const textToStream = cleaned || 'Operation processed successfully.'
      
      const chunkSize = 16
      for (let i = 0; i < textToStream.length; i += chunkSize) {
        sendEvent({ type: 'delta', text: textToStream.slice(i, i + chunkSize) })
        await new Promise(r => setTimeout(r, 12))
      }
      return
    }

    // Execute requested tools
    const toolNames = toolCalls.map((t: any) => t.function.name).join(', ')
    sendEvent({ type: 'status', message: `Running database tool (${toolNames})...` })
    sendEvent({ type: 'thinking', text: `Triggered database operation: ${toolNames}` })

    openAiMessages.push(choice)

    for (const tc of toolCalls) {
      let args: any = {}
      try {
        args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : (tc.function.arguments || {})
      } catch (e) {
        args = {}
      }

      const executionResult = await executeErpTool(tc.function.name, args || {}, profile)
      sendEvent({ type: 'action', action: executionResult })
      sendEvent({ type: 'status', message: `Processed ${executionResult.action}. Formulating response...` })

      openAiMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify({
          success: executionResult.success,
          action: executionResult.action,
          details: executionResult.details,
          data: executionResult.data
        })
      })
    }
  }

  sendEvent({ type: 'status', message: '' })
  sendEvent({ type: 'delta', text: 'All operations executed and committed to database.' })
}

export function createAgentStream(
  messages: ChatMessage[],
  profile: { id: string; role: string; organization_id: string; full_name: string }
): ReadableStream {
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      const sendEvent = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch (e) {
          // Client closed connection
        }
      }

      try {
        const openRouterKey = process.env.OPENROUTER_API_KEY
        const geminiKey = process.env.GEMINI_API_KEY

        if (openRouterKey) {
          try {
            await runOpenRouterAgentWithStreaming(messages, profile, openRouterKey, sendEvent)
            sendEvent({ type: 'done' })
            return
          } catch (err: any) {
            console.error('OpenRouter streaming error, falling back if possible:', err?.message || err)
            if (!geminiKey) {
              sendEvent({ type: 'error', error: err?.message || 'OpenRouter streaming failed' })
              return
            }
          }
        }

        // Fallback to static runErpAgent and stream tokens
        const response = await runErpAgent(messages, profile)
        for (const act of response.actionsExecuted) {
          sendEvent({ type: 'action', action: act })
        }
        const text = response.reply || 'Completed.'
        const chunkSize = 16
        for (let i = 0; i < text.length; i += chunkSize) {
          sendEvent({ type: 'delta', text: text.slice(i, i + chunkSize) })
          await new Promise(r => setTimeout(r, 12))
        }
        sendEvent({ type: 'done' })
      } catch (err: any) {
        console.error('Streaming agent fatal error:', err)
        sendEvent({ type: 'error', error: err?.message || 'Internal Agent Streaming Error' })
      } finally {
        try {
          controller.close()
        } catch (e) {}
      }
    }
  })
}
