# 🤖 AI Chatbot for Cielo Vista Apartments

Your apartment management website now includes an intelligent AI chatbot that helps visitors and tenants instantly with their questions!

## 🚀 Quick Start (5 minutes)

### 1. Get Your API Keys
- **OpenAI Key:** https://platform.openai.com/api-keys
- **Supabase Keys:** Dashboard → Settings → API

### 2. Create `.env.local`
```env
OPENAI_API_KEY=sk_xxx...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 3. Run Database Migration
1. Go to Supabase Dashboard
2. SQL Editor → New Query
3. Paste contents of `scripts/009-create-chat-tables.sql`
4. Click Run

### 4. Install & Test
```bash
pnpm install  # Install OpenAI dependency
pnpm dev      # Start dev server
```

Visit `http://localhost:3000` - Chat icon appears in bottom-right corner! 💬

## ✨ Features

### For Visitors & Tenants
- 💬 Instant answers to apartment questions
- 🏠 Information about availability and pricing
- 📅 Help booking visits and tours
- 🔧 Maintenance request assistance
- 📞 Contact information
- 🌙 24-hour session persistence

### For Admins
- 👀 View all chat conversations
- 📊 See visitor and tenant interactions
- 💾 Export chat history
- 📈 Analyze user questions
- 🎯 Understand customer needs

### For Developers
- 🔒 Secure API (no exposed keys)
- 📦 Modular, reusable components
- 🗄️ Full audit trail in database
- 🚀 Production-ready code
- 📝 Comprehensive documentation

## 📁 File Structure

```
components/
  ChatWidget.tsx                      # Main floating chat UI
  ChatSessionsManager.tsx             # Admin view (server)
  ChatSessionsManagerClient.tsx       # Admin view (client)
  ChatConversationDialog.tsx          # View individual chats

app/api/chat/
  message.ts                          # Handle messages & AI
  session.ts                          # Create sessions
  sessions.ts                         # Fetch all sessions
  conversation/[sessionId]/route.ts   # Get conversation history

scripts/
  009-create-chat-tables.sql         # Database schema

Documentation/
  CHATBOT_QUICKSTART.md              # Quick setup guide
  CHATBOT_SETUP.md                   # Detailed setup guide
  IMPLEMENTATION_SUMMARY.md          # Technical details
  ENV_EXAMPLE.md                     # Environment variables
```

## 🎨 Adding to Admin Dashboard

Add this to your admin page to view all chat sessions:

```tsx
import { ChatSessionsManagerClient } from "@/components/ChatSessionsManagerClient"

export default function AdminChatPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Chat Management</h1>
      <ChatSessionsManagerClient />
    </div>
  )
}
```

## 🔌 API Endpoints

### POST /api/chat/session
Create a new chat session
```json
{ "userEmail": "user@example.com", "userName": "John", "userRole": "visitor" }
```

### POST /api/chat/message  
Send message and get AI response
```json
{ "sessionId": "uuid", "message": "What apartments are available?" }
```

### GET /api/chat/sessions
Fetch all sessions (admin)

### GET /api/chat/conversation/[sessionId]
Fetch specific conversation

## ⚙️ Customization

### Change Chat Color
Edit `components/ChatWidget.tsx`:
```tsx
className="... from-blue-600 to-blue-700 ..."
// Change to your colors
```

### Adjust AI Personality
Edit `app/api/chat/message.ts` - update `systemPrompt`

### Switch AI Model
```typescript
model: "gpt-4o-mini",  // Current (fast, cheap)
model: "gpt-4o",       // Slower, smarter
model: "gpt-3.5-turbo" // Fastest, cheapest
```

## 🔐 Security

- ✅ OpenAI key stored in environment (never exposed)
- ✅ All API calls go through Next.js backend
- ✅ Database Row-Level Security (RLS) enabled
- ✅ Users can only see their own sessions
- ✅ Full audit trail maintained

## 📊 Monitoring

```sql
-- View all chat sessions
SELECT * FROM chat_sessions ORDER BY created_at DESC;

-- View all messages
SELECT cs.user_email, cm.sender_role, cm.message, cm.created_at
FROM chat_messages cm
JOIN chat_sessions cs ON cm.session_id = cs.id
ORDER BY cm.created_at DESC;

-- Activity by day
SELECT DATE(created_at), COUNT(*) FROM chat_sessions GROUP BY DATE(created_at);
```

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Chat widget not visible | Clear browser cache, restart dev server |
| "Invalid API key" | Verify `OPENAI_API_KEY` in `.env.local` |
| "Supabase connection failed" | Check Supabase URL and keys in `.env.local` |
| Slow responses | Check OpenAI status or switch to faster model |
| No messages saved | Verify database migration was run |

## 📚 More Information

- **Quick Start:** See `CHATBOT_QUICKSTART.md`
- **Detailed Setup:** See `CHATBOT_SETUP.md`
- **Technical Details:** See `IMPLEMENTATION_SUMMARY.md`
- **Environment Config:** See `ENV_EXAMPLE.md`

## 🚀 Next Steps

- [ ] Set up environment variables
- [ ] Run database migration
- [ ] Test the chatbot
- [ ] Customize colors/personality
- [ ] Add to admin dashboard
- [ ] Monitor usage
- [ ] Gather feedback
- [ ] Iterate on AI responses

## 💡 Future Enhancements

- Multi-language support
- Chat templates
- Integration with support tickets
- Sentiment analysis
- Conversation ratings
- Advanced analytics dashboard

## 📞 Support

For issues:
1. Check `CHATBOT_QUICKSTART.md` troubleshooting section
2. Review browser console (F12)
3. Check server logs
4. See `CHATBOT_SETUP.md` advanced configuration

---

**Happy chatting! 🎉**

Built with React, Next.js, OpenAI, Supabase, and Tailwind CSS.
