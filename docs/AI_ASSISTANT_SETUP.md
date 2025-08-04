# AI Assistant Setup Guide

The EasyRecord AI Assistant uses Supabase Edge Functions to provide intelligent data analysis, formula suggestions, and conversational assistance. This guide explains how to set up and configure the AI assistant.

## 🏗️ Architecture Overview

```
Frontend (React) → Supabase Edge Function → AI Provider (OpenAI/Anthropic) → Database
```

**Components:**
- **Frontend**: `AIAssistant.tsx` - Chat interface and user interaction
- **Edge Function**: `ai-assistant/index.ts` - Server-side AI processing
- **Database**: AI conversation and message storage
- **AI Providers**: OpenAI GPT or Anthropic Claude integration

## 🔧 Setup Instructions

### 1. Database Migration

First, apply the AI assistant database tables:

```bash
npx supabase db push
```

This creates:
- `ai_conversations` - File-scoped conversation threads
- `ai_messages` - Chat message history
- `ai_actions` - AI operation tracking

### 2. AI Provider Configuration

Choose one of the following AI providers:

#### Option A: OpenAI (Recommended)

1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Add to Supabase secrets:

```bash
npx supabase secrets set OPENAI_API_KEY=your_openai_api_key_here
```

#### Option B: Anthropic Claude

1. Get an API key from [Anthropic Console](https://console.anthropic.com/)
2. Add to Supabase secrets:

```bash
npx supabase secrets set ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### 3. Deploy Edge Function

Deploy the AI assistant function to Supabase:

```bash
npx supabase functions deploy ai-assistant
```

### 4. Test the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Upload a file and navigate to its workspace (`/files/:fileId`)

3. Test the AI assistant with these example queries:
   - "Analyze my data"
   - "Help me create a formula"
   - "How many unique customers do I have?"

## 🎯 AI Capabilities

### Data Analysis
- **Data Quality**: Completeness, duplicates, validation
- **Statistics**: Row/column counts, unique values, numeric analysis
- **Insights**: Pattern detection, anomaly identification
- **Recommendations**: Data cleaning suggestions

### Formula Assistance
- **Smart Suggestions**: Context-aware formula recommendations
- **Calculations**: SUM, AVERAGE, COUNT, MAX, MIN with real results
- **Custom Formulas**: Help with complex calculations
- **Excel Compatibility**: Standard spreadsheet functions

### Natural Language Processing
- **Column Queries**: "How many unique values in Name column?"
- **Data Questions**: "What's the total revenue?"
- **Help Requests**: "How do I clean this data?"
- **Export Guidance**: "How can I download this as Excel?"

### Conversational Context
- **Memory**: Remembers conversation history per file
- **Context Awareness**: Understands file structure and data
- **Action Tracking**: Monitors AI operations and results
- **Error Handling**: Graceful fallbacks and error recovery

## 🚀 Advanced Configuration

### Fallback Mode

If no AI provider is configured, the system uses an enhanced rule-based fallback that provides:
- Basic data analysis
- Formula suggestions based on data patterns
- Help responses and guidance
- Column-specific insights

### Custom Prompts

You can modify the AI prompts in `supabase/functions/ai-assistant/index.ts`:

```typescript
const systemPrompt = `You are an expert data analysis assistant...`
```

### Rate Limiting

Consider implementing rate limiting for production:

```typescript
// Add to Edge Function
const rateLimitCheck = await checkUserRateLimit(user.id)
if (rateLimitCheck.exceeded) {
  return new Response('Rate limit exceeded', { status: 429 })
}
```

## 🔒 Security Considerations

### API Key Protection
- ✅ API keys stored securely in Supabase secrets
- ✅ Never exposed to client-side code
- ✅ Server-side processing only

### Data Privacy
- ✅ User data isolated by Row Level Security
- ✅ Conversation history encrypted in transit
- ✅ No data stored by AI providers (ephemeral requests)

### Access Control
- ✅ User authentication required
- ✅ File-level access control
- ✅ Database-level security policies

## 🐛 Troubleshooting

### Common Issues

**Edge Function Not Responding**
```bash
# Check function logs
npx supabase functions logs ai-assistant

# Redeploy function
npx supabase functions deploy ai-assistant
```

**Database Connection Errors**
```bash
# Verify migration applied
npx supabase db diff

# Check RLS policies
npx supabase db inspect
```

**AI Provider Errors**
- Verify API key is correctly set in Supabase secrets
- Check API key has sufficient credits/quota
- Monitor function logs for specific error messages

### Testing Locally

For local development, set environment variables:

```bash
# .env.local (for Edge Function testing)
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
```

## 📊 Usage Analytics

Track AI assistant usage:

```sql
-- Conversation activity
SELECT COUNT(*) as total_conversations 
FROM ai_conversations 
WHERE created_at > NOW() - INTERVAL '30 days';

-- Message volume
SELECT COUNT(*) as total_messages,
       AVG(LENGTH(content)) as avg_message_length
FROM ai_messages 
WHERE created_at > NOW() - INTERVAL '30 days';

-- Popular message types
SELECT message_type, COUNT(*) as count
FROM ai_messages 
WHERE role = 'assistant'
GROUP BY message_type;
```

## 🎨 Customization

### UI Customization

Modify the chat interface in `src/components/ai/AIAssistant.tsx`:
- Message styling and layout
- Quick action buttons
- Loading states and animations

### Response Customization

Adjust AI responses in the Edge Function:
- System prompts and context
- Fallback responses
- Error messages and guidance

## 📈 Performance Optimization

### Caching Strategy
- Conversation history cached locally
- Message pagination for long conversations
- Optimistic UI updates

### Request Optimization
- Batch multiple user requests
- Compress conversation context
- Implement request debouncing

## 🔄 Updates and Maintenance

### Regular Tasks
- Monitor API usage and costs
- Update AI model versions
- Review conversation quality
- Update fallback responses

### Version Updates
```bash
# Update Edge Function
npx supabase functions deploy ai-assistant

# Update database schema
npx supabase db push
```

---

## 🎯 Next Steps

1. **Deploy the Edge Function** with your chosen AI provider
2. **Test basic functionality** with sample data
3. **Monitor usage and performance** in production
4. **Customize prompts** for your specific use case
5. **Add advanced features** like data visualization or bulk operations

The AI assistant provides a foundation for building sophisticated data analysis tools. With proper setup, it delivers a bolt.new/Lovable-style experience tailored specifically for spreadsheet operations.