import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// CORS headers configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

interface AIRequest {
  conversationId: string
  message: string
  fileData: {
    headers: string[]
    rows: Array<Record<string, string>>
  }
  messageType?: 'text' | 'action' | 'formula' | 'error'
  chatMode?: boolean
}

interface AIResponse {
  message: string
  messageType: 'text' | 'action' | 'formula' | 'error'
  actions?: Array<{
    type: 'cell_edit' | 'formula_add' | 'data_transform' | 'export' | 'analysis'
    data: any
  }>
  metadata?: any
}

const openAIApiKey = Deno.env.get('OPENAI_API_KEY')
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Missing authorization header', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    // Create Supabase client for Edge Function with user context
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Extract JWT token from Authorization header
    const token = authHeader.replace('Bearer ', '')
    
    // Get the user from the JWT token
    const {
      data: { user },
      error: authError
    } = await supabaseClient.auth.getUser(token)

    console.log('Auth check:', { 
      hasAuthHeader: !!authHeader,
      hasToken: !!token,
      user: user?.id || 'none',
      authError: authError?.message || 'none'
    })

    if (!user) {
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    const { conversationId, message, fileData, messageType = 'text', chatMode = false }: AIRequest = await req.json()

    console.log('Processing AI request:', { conversationId, message: message.substring(0, 100) })

    // Get conversation context
    const { data: conversation, error: convError } = await supabaseClient
      .from('ai_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single()

    if (convError) {
      throw new Error(`Conversation not found: ${convError.message}`)
    }

    // Get recent message history for context
    const { data: recentMessages, error: messagesError } = await supabaseClient
      .from('ai_messages')
      .select('role, content, message_type')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
    }

    // Process the AI request
    const aiResponse = await processAIRequest(message, fileData, recentMessages || [], chatMode)

    // Store the user message
    const { error: userMessageError } = await supabaseClient
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: message,
        message_type: messageType
      })

    if (userMessageError) {
      console.error('Error storing user message:', userMessageError)
    }

    // Store the AI response
    const { data: aiMessageData, error: aiMessageError } = await supabaseClient
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: aiResponse.message,
        message_type: aiResponse.messageType,
        metadata: aiResponse.metadata || {}
      })
      .select()
      .single()

    if (aiMessageError) {
      throw new Error(`Failed to store AI message: ${aiMessageError.message}`)
    }

    // Auto-generate conversation title based on first user message
    await updateConversationTitle(supabaseClient, conversation, message)

    // Store any actions if present
    if (aiResponse.actions && aiResponse.actions.length > 0) {
      const actionPromises = aiResponse.actions.map(action => 
        supabaseClient
          .from('ai_actions')
          .insert({
            conversation_id: conversationId,
            message_id: aiMessageData.id,
            action_type: action.type,
            action_data: action.data,
            status: 'pending'
          })
      )

      await Promise.all(actionPromises)
    }

    // Update conversation timestamp
    await supabaseClient
      .from('ai_conversations')
      .update({ 
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          messageId: aiMessageData.id,
          response: aiResponse.message,
          messageType: aiResponse.messageType,
          actions: aiResponse.actions || []
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('AI Assistant Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

async function processAIRequest(
  message: string, 
  fileData: { headers: string[], rows: Array<Record<string, string>> },
  conversationHistory: Array<{ role: string, content: string, message_type: string }>,
  chatMode: boolean = false
): Promise<AIResponse> {
  
  const intent = analyzeUserIntent(message, chatMode)
  
  // Prepare context for AI
  const dataContext = `
File Data Summary:
- Columns (${fileData.headers.length}): ${fileData.headers.join(', ')}
- Rows: ${fileData.rows.length}
- Complete data (all rows): ${JSON.stringify(fileData.rows, null, 2)}
`

  const conversationContext = conversationHistory.length > 0 
    ? `\nRecent conversation:\n${conversationHistory.reverse().map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
    : ''

  // Choose AI provider and make request
  let aiResponse: string
  
  if (anthropicApiKey) {
    aiResponse = await callAnthropicAI(message, dataContext, conversationContext, intent)
  } else if (openAIApiKey) {
    aiResponse = await callOpenAI(message, dataContext, conversationContext, intent)
  } else {
    // Fallback to enhanced rule-based system
    aiResponse = await fallbackAIResponse(message, fileData, intent)
  }

  return {
    message: aiResponse,
    messageType: intent.messageType,
    actions: intent.actions,
    metadata: { intent, timestamp: new Date().toISOString() }
  }
}

function analyzeUserIntent(message: string, chatMode: boolean = false): { 
  type: string
  messageType: 'text' | 'action' | 'formula' | 'error'
  actions?: Array<{ type: 'cell_edit' | 'formula_add' | 'data_transform' | 'export' | 'analysis', data: any }>
} {
  const lowerMessage = message.toLowerCase()
  
  // In chat mode, treat most questions as general conversation
  if (chatMode) {
    // Only specific keywords should trigger formula mode in chat
    if (lowerMessage.includes('create formula') || lowerMessage.includes('write formula') || lowerMessage.includes('give me formula')) {
      return { 
        type: 'formula_add', 
        messageType: 'formula',
        actions: [{ type: 'formula_add', data: { message } }]
      }
    }
    
    // Everything else in chat mode is conversational
    return { type: 'chat_query', messageType: 'text' }
  }
  
  // Formula mode (original behavior)
  // Cell editing patterns
  if (lowerMessage.includes('edit') || lowerMessage.includes('change') || lowerMessage.includes('update') && (lowerMessage.includes('cell') || lowerMessage.includes('row') || lowerMessage.includes('column'))) {
    return { 
      type: 'cell_edit', 
      messageType: 'action',
      actions: [{ type: 'cell_edit', data: { message } }]
    }
  }
  
  // Formula patterns
  if (lowerMessage.includes('formula') || lowerMessage.includes('calculate') || lowerMessage.includes('sum') || lowerMessage.includes('average') || lowerMessage.includes('count')) {
    return { 
      type: 'formula_add', 
      messageType: 'formula',
      actions: [{ type: 'formula_add', data: { message } }]
    }
  }
  
  // Analysis patterns
  if (lowerMessage.includes('analyze') || lowerMessage.includes('insights') || lowerMessage.includes('summary') || lowerMessage.includes('statistics')) {
    return { 
      type: 'data_analysis', 
      messageType: 'action',
      actions: [{ type: 'analysis', data: { message } }]
    }
  }
  
  // Export patterns
  if (lowerMessage.includes('export') || lowerMessage.includes('download') || lowerMessage.includes('save')) {
    return { 
      type: 'export', 
      messageType: 'action',
      actions: [{ type: 'export', data: { message } }]
    }
  }
  
  return { type: 'general', messageType: 'text' }
}

async function callAnthropicAI(
  message: string, 
  dataContext: string, 
  conversationContext: string,
  intent: any
): Promise<string> {
  const systemPrompt = `You are an expert data analysis assistant for a spreadsheet application. You help users analyze, manipulate, and understand their data.

Context about the current file:
${dataContext}

${intent.type === 'chat_query' ? `
**CHAT MODE - Conversational Responses Only**
- Provide direct, simple answers to user questions
- Do NOT suggest formulas unless explicitly asked
- Be conversational and friendly
- Answer questions about data directly (e.g., "Yes, Nishant is from Spain")
- Keep responses concise and natural
` : `
**FORMULA MODE - Technical Assistance**
Your capabilities:
1. Data Analysis - Provide insights, statistics, and patterns
2. Formula Suggestions - Recommend Excel-like formulas and calculations
3. Data Validation - Check for errors, duplicates, and data quality issues
4. Cell Editing - Help users modify specific data points
5. Export Guidance - Assist with data export and formatting

Guidelines:
- Be concise but thorough in your analysis
- Provide actionable insights and recommendations
- Use markdown formatting for better readability
- Include specific examples when suggesting formulas
- Always consider the user's data context when responding
- If suggesting changes, be specific about rows, columns, and values
`}

Current user intent: ${intent.type}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `${conversationContext}\n\nUser request: ${message}`
        }
      ]
    })
  })

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`)
  }

  const data = await response.json()
  return data.content[0].text
}

async function callOpenAI(
  message: string, 
  dataContext: string, 
  conversationContext: string,
  intent: any
): Promise<string> {
  const systemPrompt = `You are an expert data analysis assistant for a spreadsheet application. You help users analyze, manipulate, and understand their spreadsheet data.

Context about the current file:
${dataContext}

${intent.type === 'chat_query' ? `
**CHAT MODE - Conversational Responses Only**
- Provide direct, simple answers to user questions
- Do NOT suggest formulas unless explicitly asked
- Be conversational and friendly
- Answer questions about data directly (e.g., "Yes, Nishant is from Spain")
- Keep responses concise and natural
` : `
**FORMULA MODE - Technical Assistance**
Your capabilities:
1. Data Analysis - Provide insights, statistics, and patterns
2. Formula Suggestions - Recommend Excel-like formulas
3. Data Validation - Check for errors and quality issues
4. Cell Editing - Help modify specific data points
5. Export Guidance - Assist with data export

Guidelines:
- Be concise but thorough
- Provide actionable insights
- Use markdown formatting
- Include specific examples for formulas
- Consider the user's data context
- Be specific about rows, columns, and values when suggesting changes
`}

Current user intent: ${intent.type}`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openAIApiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${conversationContext}\n\nUser request: ${message}` }
      ],
      max_tokens: 1000,
      temperature: 0.3
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

async function fallbackAIResponse(
  message: string,
  fileData: { headers: string[], rows: Array<Record<string, string>> },
  intent: any
): Promise<string> {
  const { headers, rows } = fileData
  const lowerMessage = message.toLowerCase()

  // Enhanced fallback responses based on intent
  switch (intent.type) {
    case 'chat_query':
      return generateChatResponse(fileData, message)
      
    case 'data_analysis':
      return generateDataAnalysis(fileData)
    
    case 'formula_add':
      return generateFormulasSuggestions(fileData)
    
    case 'cell_edit':
      return `I can help you edit cells in your spreadsheet. Please specify:
• Row number and column name (e.g., "Change row 3, Name column to John Smith")
• Or use cell notation (e.g., "Update B5 to 1000")

Your current columns: ${headers.join(', ')}`
    
    case 'export':
      return `📁 **Export Options Available**

I can guide you through exporting your data:
• **Excel (.xlsx)** - Full formatting support
• **CSV (.csv)** - Simple comma-separated values  
• **PDF** - Print-ready format

Use the download buttons in the toolbar above the table to export your data.`
    
    default:
      return generateHelpResponse(fileData, message)
  }
}

function generateChatResponse(fileData: { headers: string[], rows: Array<Record<string, string>> }, message: string): string {
  const { headers, rows } = fileData
  const lowerMessage = message.toLowerCase()
  
  // Handle questions about specific people/values
  const words = message.toLowerCase().split(/\s+/)
  for (const word of words) {
    if (word.length > 2) {
      // Search for this word in all data values
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex]
        for (const header of headers) {
          const cellValue = row[header]?.toLowerCase() || ''
          if (cellValue.includes(word)) {
            // Found a match! Return simple conversational answer
            const personName = row[headers.find(h => h.toLowerCase().includes('name')) || headers[0]] || word
            const country = row[headers.find(h => h.toLowerCase().includes('country')) || ''] || 'unknown'
            
            if (lowerMessage.includes('country') || lowerMessage.includes('where') || lowerMessage.includes('from')) {
              return `Yes, ${personName} exists in your data and is from ${country}.`
            }
            
            // General info about the person
            const info = headers.map(h => `${h}: ${row[h] || 'N/A'}`).join(', ')
            return `Yes, I found ${personName} in your data. Here's their information: ${info}`
          }
        }
      }
    }
  }
  
  // Handle general questions about data
  if (lowerMessage.includes('how many') || lowerMessage.includes('count')) {
    if (lowerMessage.includes('row') || lowerMessage.includes('record') || lowerMessage.includes('people') || lowerMessage.includes('customer')) {
      return `You have ${rows.length} records in your data.`
    }
    if (lowerMessage.includes('column') || lowerMessage.includes('field')) {
      return `You have ${headers.length} columns: ${headers.join(', ')}.`
    }
  }
  
  // Handle questions about data content
  if (lowerMessage.includes('what') && (lowerMessage.includes('data') || lowerMessage.includes('information'))) {
    return `Your data contains ${rows.length} records with ${headers.length} columns: ${headers.join(', ')}. Each record has information about customers including their personal details.`
  }
  
  // Handle questions about insights
  if (lowerMessage.includes('insight') || lowerMessage.includes('tell me about') || lowerMessage.includes('summary')) {
    const countries = [...new Set(rows.map(row => row[headers.find(h => h.toLowerCase().includes('country')) || '']).filter(Boolean))]
    const avgAge = rows.length > 0 ? Math.round(rows.reduce((sum, row) => {
      const age = parseInt(row[headers.find(h => h.toLowerCase().includes('age')) || ''] || '0')
      return sum + (isNaN(age) ? 0 : age)
    }, 0) / rows.length) : 0
    
    return `Here's what I can tell you about your data:
• You have ${rows.length} customers
• They're from ${countries.length} different countries: ${countries.join(', ')}
• Average age is ${avgAge} years
• The youngest customer is ${Math.min(...rows.map(row => parseInt(row[headers.find(h => h.toLowerCase().includes('age')) || ''] || '0')).filter(age => !isNaN(age)))} and oldest is ${Math.max(...rows.map(row => parseInt(row[headers.find(h => h.toLowerCase().includes('age')) || ''] || '0')).filter(age => !isNaN(age)))}`
  }
  
  return `I'm here to help you understand your data! You have ${rows.length} records with information about customers. You can ask me questions like:
• "Is there a person named [name]?"
• "What countries are represented?"
• "Tell me about my data"
• "How many customers do I have?"

What would you like to know?`
}

function generateDataAnalysis(fileData: { headers: string[], rows: Array<Record<string, string>> }): string {
  const { headers, rows } = fileData
  
  // Basic statistics
  const totalRows = rows.length
  const totalCells = totalRows * headers.length
  let filledCells = 0
  
  const columnStats = headers.map(header => {
    const values = rows.map(row => row[header]).filter(val => val && val.trim())
    filledCells += values.length
    
    const uniqueValues = new Set(values).size
    const emptyCount = totalRows - values.length
    
    // Check if numeric
    const numericValues = values.filter(val => !isNaN(Number(val.replace(/[,\s]/g, ''))))
    const isNumeric = numericValues.length > values.length * 0.7
    
    return {
      column: header,
      uniqueValues,
      emptyCount,
      isNumeric,
      sampleValues: values.slice(0, 3)
    }
  })
  
  const completeness = (filledCells / totalCells * 100).toFixed(1)
  const completenessNum = parseFloat(completeness)
  const mostDiverse = columnStats.sort((a, b) => b.uniqueValues - a.uniqueValues)[0]
  const numericColumns = columnStats.filter(col => col.isNumeric)
  
  return `📊 **Data Analysis Summary**

**Overview:**
• Total Rows: ${totalRows}
• Total Columns: ${headers.length}
• Data Completeness: ${completeness}%

**Column Analysis:**
${columnStats.map(col => 
  `• **${col.column}**: ${col.uniqueValues} unique values, ${col.emptyCount} empty${col.isNumeric ? ' (numeric)' : ''}`
).join('\n')}

**Key Insights:**
• Most diverse column: **${mostDiverse.column}** (${mostDiverse.uniqueValues} unique values)
• Numeric columns: ${numericColumns.length > 0 ? numericColumns.map(col => col.column).join(', ') : 'None detected'}
• Data quality: ${completenessNum > 90 ? 'Excellent' : completenessNum > 70 ? 'Good' : 'Needs improvement'}

**Recommendations:**
${numericColumns.length > 0 ? '• Consider adding sum/average calculations for numeric columns' : ''}
${completenessNum < 90 ? '• Review and fill empty cells for better data quality' : ''}
• Check for duplicate entries to ensure data accuracy`
}

function generateFormulasSuggestions(fileData: { headers: string[], rows: Array<Record<string, string>> }): string {
  const { headers, rows } = fileData
  
  // Find numeric columns
  const numericColumns = headers.filter(header => {
    const values = rows.map(row => row[header]).filter(val => val && val.trim())
    const numericValues = values.filter(val => !isNaN(Number(val.replace(/[,\s]/g, ''))))
    return numericValues.length > values.length * 0.7 && values.length > 0
  })
  
  if (numericColumns.length === 0) {
    return `🧮 **Formula Suggestions**

No numeric columns detected in your data. Here are some general formulas you can use:

• **COUNT()** - Count non-empty cells in any column
• **COUNTA()** - Count all non-empty cells
• **LEN()** - Calculate text length
• **CONCATENATE()** - Combine text from multiple columns

Would you like help with specific text operations or data transformations?`
  }
  
  const suggestions: string[] = []
  
  numericColumns.forEach(column => {
    const values = rows
      .map(row => Number(row[column]?.replace(/[,\s]/g, '') || 0))
      .filter(val => !isNaN(val))
    
    if (values.length > 0) {
      const sum = values.reduce((a, b) => a + b, 0)
      const avg = (sum / values.length).toFixed(2)
      const max = Math.max(...values)
      const min = Math.min(...values)
      
      suggestions.push(`**${column} Column:**`)
      suggestions.push(`• SUM(${column}) = ${sum}`)
      suggestions.push(`• AVERAGE(${column}) = ${avg}`)
      suggestions.push(`• MAX(${column}) = ${max}`)
      suggestions.push(`• MIN(${column}) = ${min}`)
      suggestions.push(`• COUNT(${column}) = ${values.length}`)
      suggestions.push('')
    }
  })
  
  return `🧮 **Formula Suggestions**

Based on your numeric columns, here are calculated results:

${suggestions.join('\n')}

**Additional Formulas:**
• **COUNTIF()** - Count cells meeting criteria
• **SUMIF()** - Sum cells meeting criteria
• **VLOOKUP()** - Look up values from other data

What specific calculation would you like to perform?`
}

function generateHelpResponse(fileData: { headers: string[], rows: Array<Record<string, string>> }, message: string): string {
  const { headers, rows } = fileData
  
  if (message.toLowerCase().includes('help')) {
    return `🤖 **AI Assistant Help**

I can help you with your ${rows.length} rows and ${headers.length} columns of data:

**Data Analysis:**
• Get insights and statistics about your data
• Check data quality and completeness
• Find patterns and anomalies

**Formula Assistance:**
• Suggest calculations based on your data
• Help create custom formulas
• Explain formula results

**Data Operations:**
• Edit specific cells or ranges
• Validate and clean data
• Guide data transformations

**Export & Sharing:**
• Export to Excel, CSV, or PDF formats
• Format data for specific needs

**Try asking:**
• "Analyze my data"
• "Create a sum formula for [column name]"
• "How many unique values in [column]?"
• "Help me clean this data"`
  }
  
  // Handle column-specific questions
  const mentionedColumn = headers.find(header => 
    message.toLowerCase().includes(header.toLowerCase())
  )
  
  if (mentionedColumn) {
    const values = rows.map(row => row[mentionedColumn]).filter(val => val && val.trim())
    const uniqueValues = new Set(values)
    
    return `📋 **${mentionedColumn} Column Analysis**

• Total values: ${values.length}
• Empty cells: ${rows.length - values.length}
• Unique values: ${uniqueValues.size}
• Sample values: ${Array.from(uniqueValues).slice(0, 5).join(', ')}${uniqueValues.size > 5 ? '...' : ''}

What would you like to know about this column?`
  }
  
  // Handle questions about specific data values (e.g., "tell me about Aditya")
  const words = message.toLowerCase().split(/\s+/)
  for (const word of words) {
    if (word.length > 2) { // Only check words longer than 2 characters
      // Search for this word in all data values
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex]
        for (const header of headers) {
          const cellValue = row[header]?.toLowerCase() || ''
          if (cellValue.includes(word)) {
            // Found a match! Return information about this row
            const rowData = headers.map(h => `**${h}**: ${row[h] || 'N/A'}`).join('\n')
            return `🔍 **Found data for "${word}"**

**Row ${rowIndex + 1} details:**
${rowData}

Would you like to know more about this data or search for something else?`
          }
        }
      }
    }
  }
  
  return `I'm here to help you work with your data! You have ${rows.length} rows and ${headers.length} columns.

**Quick suggestions:**
• Ask me to "analyze my data" for insights
• Request formula help for calculations  
• Ask about specific columns: ${headers.slice(0, 3).join(', ')}${headers.length > 3 ? '...' : ''}

What would you like to explore?`
}

async function updateConversationTitle(
  supabaseClient: any,
  conversation: any,
  userMessage: string
) {
  try {
    // Only update if this is still the default title or empty
    const isDefaultTitle = !conversation.title || 
                          conversation.title === 'AI Assistant Chat' ||
                          conversation.title.startsWith('Chat ');

    if (!isDefaultTitle) return;

    // Check if this is the first user message in the conversation
    const { data: messageCount } = await supabaseClient
      .from('ai_messages')
      .select('id', { count: 'exact' })
      .eq('conversation_id', conversation.id)
      .eq('role', 'user');

    if (messageCount && messageCount.length <= 1) {
      // Generate title from first message
      const title = generateTitleFromMessage(userMessage);
      
      await supabaseClient
        .from('ai_conversations')
        .update({ 
          title: title,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation.id);
    }
  } catch (error) {
    console.error('Error updating conversation title:', error);
    // Don't throw - this is not critical for the main flow
  }
}

function generateTitleFromMessage(message: string): string {
  // Clean and truncate the message
  const cleanMessage = message
    .replace(/[^\w\s]/gi, '') // Remove special characters
    .trim()
    .split(' ')
    .slice(0, 4) // First 4 words
    .join(' ');

  if (cleanMessage.length > 30) {
    return cleanMessage.substring(0, 27) + '...';
  }

  return cleanMessage || 'New Chat';
}