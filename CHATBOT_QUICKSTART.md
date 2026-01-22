# AI Chatbot - Quick Start Guide

## What Was Added

Your apartment management website now has a fully integrated AI chatbot that:
- ✅ Appears as a floating widget on all pages
- ✅ Answers questions about apartments, pricing, bookings, maintenance, etc.
- ✅ Stores chat history in Supabase
- ✅ Supports visitor and tenant roles
- ✅ Provides admin dashboard to view conversations
- ✅ Securely calls OpenAI API (no exposed keys)

## Files Added/Modified

### New Files:
```
components/
  ├── ChatWidget.tsx (Floating chat UI)
  ├── ChatSessionsManager.tsx (Admin view - server component)
  ├── ChatSessionsManagerClient.tsx (Admin view - client component)
  └── ChatConversationDialog.tsx (View individual chats)

app/api/chat/
  ├── message.ts (Handle chat messages & AI calls)
  ├── session.ts (Create chat sessions)
  ├── sessions.ts (Fetch all sessions for admin)
  └── conversation/[sessionId]/route.ts (Fetch specific conversation)

scripts/
  └── 009-create-chat-tables.sql (Database schema)

CHATBOT_SETUP.md (Detailed documentation)
```

### Modified Files:
```
package.json (Added openai dependency)
components/root-layout-client.tsx (Added ChatWidget import)
```

## Setup Steps (Do These Now!)

### Step 1: Add Environment Variables
Create or update `.env.local`:

```env
# Get this from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-xxx...

# These should already exist
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Step 2: Run Database Migration
1. Go to Supabase Dashboard
2. Open SQL Editor
3. Create new query
4. Copy contents of `scripts/009-create-chat-tables.sql`
5. Paste and run

### Step 3: Install Dependencies
```bash
pnpm install
# or
npm install
```

### Step 4: Test
```bash
pnpm dev
```

Then open http://localhost:3000 and look for the chat icon (bottom-right corner).

## Testing the Chatbot

1. **Click the chat icon** in bottom-right corner
2. **Try these questions:**
   - "What apartments do you have available?"
   - "What are your rental prices?"
   - "How do I book a visit?"
   - "What are the apartment rules?"
   - "How do I request maintenance?"

3. **Check Supabase:**
   - Go to Supabase Dashboard > SQL Editor
   - Run: `SELECT * FROM chat_sessions;`
   - Run: `SELECT * FROM chat_messages;`

## Using the Admin Dashboard

Add this to your admin page to see all chat sessions:

```tsx
import { ChatSessionsManagerClient } from "@/components/ChatSessionsManagerClient"

export default function AdminChatPage() {
  return (
    <div>
      <h1>Chat Management</h1>
      <ChatSessionsManagerClient />
    </div>
  )
}
```

Or use the server component:
```tsx
import { ChatSessionsManager } from "@/components/ChatSessionsManager"

export default function AdminChatPage() {
  return (
    <div>
      <h1>Chat Management</h1>
      <ChatSessionsManager />
    </div>
  )
}
```

## Key Features

### 🤖 AI Assistant Personality
- Talks like a professional apartment receptionist
- Helps with availability, pricing, bookings, rules, maintenance
- Politely redirects for questions it can't answer

### 💬 Floating Chat Widget
- Stays on all pages
- Minimizes to icon when closed
- Auto-scrolls to latest message
- Clean, modern design with blue theme

### 🔒 Secure Backend
- OpenAI key never exposed to frontend
- All API calls go through Next.js backend
- Row-level security in Supabase

### 📊 Session Management
- Tracks visitor vs tenant interactions
- 24-hour session persistence
- Optional email/name collection
- Full message history stored

### 👨‍💼 Admin Features
- View all chat sessions
- Read full conversations
- Export chats to text files
- See who's asking what

## Customization Examples

### Change Chat Widget Color
Edit `components/ChatWidget.tsx`:
```tsx
// Find this line:
className="... bg-gradient-to-r from-blue-600 to-blue-700 ..."
// Change to:
className="... bg-gradient-to-r from-green-600 to-green-700 ..."
```

### Change AI Personality
Edit `app/api/chat/message.ts` - update the `systemPrompt`:
```typescript
const systemPrompt = `You are a friendly chatbot for Cielo Vista Apartments...`
```

### Change Response Speed
Edit `app/api/chat/message.ts`:
```typescript
model: "gpt-4o-mini",  // Faster and cheaper
// or
model: "gpt-4",        // Slower but smarter
```

## Troubleshooting

### Chat widget doesn't appear
- Clear browser cache and localStorage
- Check browser console (F12) for errors
- Verify environment variables are set

### "Chat failed to send"
- Check OpenAI API key is valid
- Check Supabase connection
- Look at server logs

### Responses are slow
- Check OpenAI status: https://status.openai.com/
- Try cheaper model: change to `gpt-3.5-turbo`
- Check internet connection

## Next Steps

1. ✅ Set up environment variables
2. ✅ Run database migration
3. ✅ Test the chatbot
4. ✅ Add to admin dashboard
5. Consider: Rate limiting, custom domain training, analytics

## Support Resources

- [OpenAI API Docs](https://platform.openai.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- See `CHATBOT_SETUP.md` for advanced configuration

---

**That's it! Your AI chatbot is ready to use! 🚀**
