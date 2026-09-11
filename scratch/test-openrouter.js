const apiKey = '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';
const tools = [{
  type: 'function',
  function: {
    name: 'query_sales_history',
    description: 'Query sales history',
    parameters: {
      type: 'object',
      properties: { days: { type: 'number', description: 'number of days' } }
    }
  }
}];

async function run() {
  const choice = {
    role: 'assistant',
    content: null,
    tool_calls: [{
      type: 'function',
      id: 'call-123',
      function: { name: 'query_sales_history', arguments: JSON.stringify({ days: 50 }) }
    }]
  };
  const toolMsg = {
    role: 'tool',
    tool_call_id: 'call-123',
    content: JSON.stringify({ success: true, action: 'Sales History Queried', details: 'Found 0 sales in past 50 days', data: { total_revenue: 0, sales_count: 0, sales: [] } })
  };

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Qurbat ERP'
    },
    body: JSON.stringify({
      model: 'openrouter/free',
      models: ['openrouter/free', 'meta-llama/llama-3.3-70b-instruct:free'],
      messages: [
        { role: 'system', content: 'You are an ERP agent. Format the sales report in Markdown.' },
        { role: 'user', content: 'Generate a report of the past 50 days of my selling' },
        choice,
        toolMsg
      ],
      tools,
      include_reasoning: true,
      temperature: 0.2
    })
  });

  console.log('Status:', response.status);
  const text = await response.text();
  console.log('Body:', text);
}

run().catch(console.error);
