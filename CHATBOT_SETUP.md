# AI Chatbot Integration Guide

## Overview

The Cielo Vista apartment website now includes an AI-powered chatbot that appears as a floating widget on all pages. The chatbot helps visitors and tenants with questions about apartments, availability, pricing, bookings, maintenance, and more.

## Architecture

```
Frontend (ChatWidget.tsx)
    ↓
API Routes (Next.js)
    ↓
Backend (Supabase) + AI Service (OpenAI)
    ↓
Database (Supabase PostgreSQL)
```

## Setup Instructions

### 1. Database Setup

Run the migration to create chat tables:

```sql
-- In Supabase SQL Editor, run the file: scripts/009-create-chat-tables.sql
```

This creates:
- `chat_sessions` - Stores user sessions with role and contact info
- `chat_messages` - Stores individual messages with metadata

### 2. Environment Variables

Add these to your `.env.local` file:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Supabase Configuration (already should exist)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Install Dependencies

```bash
# Install OpenAI SDK
pnpm install openai@^4.52.0

# Or if using npm
npm install openai@^4.52.0
```

### 4. Verify Integration

The chat widget should now appear as a floating button on all pages. Test by:

1. Running `pnpm dev`
2. Opening your application in a browser
3. Clicking the chat icon in the bottom-right corner
4. Sending a message

## Features

### Floating Chat Widget
- **Location**: Bottom-right corner of all pages
- **States**: Minimized (icon) or Expanded (full chat window)
- **Auto-scroll**: Messages automatically scroll to latest
- **Responsive**: Works on desktop and mobile

### Session Management
- **Automatic Session Creation**: New chat session created on first visit
- **Session Persistence**: 24-hour session duration stored in localStorage
- **User Roles**: Supports "visitor" and "tenant" roles
- **Email/Name Tracking**: Optionally collects user info

### AI Features
- **Context-Aware Responses**: Uses chat history for context
- **Role-Based**: Acts as professional apartment receptionist
- **Error Handling**: Graceful fallbacks and error messages
- **Secure API**: Never exposes OpenAI key on frontend

### Database Features
- **Message History**: All messages stored for auditing/training
- **Session Tracking**: Understand user engagement
- **Row-Level Security**: RLS policies ensure data privacy
- **Indexed Queries**: Optimized queries for performance

## Customization

### Change AI Personality

Edit the system prompt in `app/api/chat/message.ts`:

```typescript
const systemPrompt = `You are a professional and friendly apartment receptionist...`
```

### Adjust Chat Window Size

Edit `components/ChatWidget.tsx`:

```typescript
className="... w-96 h-[600px] ..." // Change w-96 and h-[600px]
```

### Modify Colors

Update the Tailwind classes in `ChatWidget.tsx`:

```typescript
"from-blue-600 to-blue-700" // Change to your brand colors
```

### Change Model or Temperature

Edit `app/api/chat/message.ts`:

```typescript
body: JSON.stringify({
  model: "gpt-4o-mini", // Change model
  temperature: 0.7, // Adjust creativity (0-1)
})
```

## API Endpoints

### `POST /api/chat/session`
Creates a new chat session.

**Request:**
```json
{
  "userEmail": "user@example.com",
  "userName": "John Doe",
  "userRole": "visitor"
}
```

**Response:**
```json
{
  "sessionId": "uuid",
  "success": true
}
```

### `POST /api/chat/message`
Sends a message and gets AI response.

**Request:**
```json
{
  "sessionId": "uuid",
  "message": "What apartments are available?"
}
```

**Response:**
```json
{
  "reply": "We have several beautiful apartments..."
}
```

## Security Considerations

### API Key Protection
- ✅ OpenAI key stored in `SUPABASE_SERVICE_ROLE_KEY` environment variable
- ✅ Never exposed to frontend
- ✅ Only used server-side in API routes

### Data Privacy
- ✅ Row-Level Security (RLS) policies on Supabase tables
- ✅ Users can only see their own sessions
- ✅ Service role key only used for operations requiring elevation

### Rate Limiting
Consider adding rate limiting to prevent abuse:

```typescript
// Add to API routes
const rateLimit = new Map()
const MAX_REQUESTS_PER_HOUR = 100

function checkRateLimit(identifier: string) {
  const now = Date.now()
  const requests = rateLimit.get(identifier) || []
  const recentRequests = requests.filter(t => now - t < 3600000)
  
  if (recentRequests.length >= MAX_REQUESTS_PER_HOUR) {
    return false
  }
  
  recentRequests.push(now)
  rateLimit.set(identifier, recentRequests)
  return true
}
```

## Monitoring & Analytics

### View Chat Sessions
```sql
SELECT * FROM chat_sessions 
ORDER BY created_at DESC 
LIMIT 50;
```

### View Chat Messages
```sql
SELECT 
  cs.id as session_id,
  cs.user_email,
  cs.user_role,
  cm.sender_role,
  cm.message,
  cm.created_at
FROM chat_messages cm
JOIN chat_sessions cs ON cm.session_id = cs.id
ORDER BY cm.created_at DESC
LIMIT 100;
```

### Session Activity
```sql
SELECT 
  user_role,
  COUNT(*) as session_count,
  COUNT(DISTINCT user_email) as unique_users
FROM chat_sessions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY user_role;
```

## Troubleshooting

### Chat widget not appearing
- Check browser console for errors
- Verify `SUPABASE_SERVICE_ROLE_KEY` is in environment
- Clear localStorage and refresh page

### Messages not saving
- Check Supabase connection
- Verify RLS policies are set correctly
- Check database tables exist (run migration)

### AI responses are generic
- Increase context window: change `limit: 10` to higher value in API
- Adjust temperature in API
- Update system prompt for more specificity

### Slow responses
- Check OpenAI API status
- Consider using GPT-3.5-turbo instead for faster responses
- Add caching for common questions

## File Structure

```
app/
  api/chat/
    message.ts        # Handles user messages
    session.ts        # Creates chat sessions
components/
  ChatWidget.tsx      # Floating chat UI
scripts/
  009-create-chat-tables.sql  # Database schema
```

## Future Enhancements

- [ ] Admin dashboard to view all chat sessions
- [ ] Chat transcripts export
- [ ] Multi-language support
- [ ] File/image upload support
- [ ] Conversation ratings/feedback
- [ ] Analytics dashboard
- [ ] Integration with support tickets
- [ ] Chat templates for common questions

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review browser console for errors
3. Check Supabase logs
4. Review API responses
