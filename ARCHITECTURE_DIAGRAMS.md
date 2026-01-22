# System Architecture Diagrams

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CIELO VISTA WEBSITE                     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   ALL PAGES                                │ │
│  │  /apartments  /booking  /tenant  /admin  /login etc...     │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │      Floating Chat Widget (Bottom-Right)            │  │ │
│  │  │      • Message display area                         │  │ │
│  │  │      • Input field                                  │  │ │
│  │  │      • Send button                                  │  │ │
│  │  │      • Auto-scroll                                  │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │         │                                                   │ │
│  │         │ Session Management                               │ │
│  │         │ localStorage.getItem('chat_session_id')         │ │
│  │         │                                                  │ │
│  └─────────┼──────────────────────────────────────────────────┘ │
│            │                                                     │
│            ▼ HTTPS                                               │
├──────────────────────────────────────────────────────────────────┤
│                    NEXT.JS BACKEND                               │
│                                                                  │
│  ┌────────────────────┐  ┌────────────────────┐                │
│  │  POST /api/chat/   │  │  POST /api/chat/   │                │
│  │     session        │  │     message        │                │
│  │                    │  │                    │                │
│  │  Creates new       │  │  • Stores message  │                │
│  │  chat session      │  │  • Calls OpenAI    │                │
│  │  in Supabase       │  │  • Stores response │                │
│  │  Returns sessionId │  │  • Returns reply   │                │
│  └────────────────────┘  └────────────────────┘                │
│                                │                                │
│  ┌────────────────────┐  ┌─────┼─────────────┐                │
│  │  GET /api/chat/    │  │ OPENAI API CALL  │                │
│  │     sessions       │  │                   │                │
│  │  (Admin)           │  │ POST https://api  │                │
│  │                    │  │ .openai.com/v1/   │                │
│  │  Returns all       │  │ chat/completions  │                │
│  │  sessions with     │  │                   │                │
│  │  message counts    │  │ Headers:          │                │
│  └────────────────────┘  │ Authorization:    │                │
│                          │ Bearer {API_KEY}  │                │
│  ┌────────────────────┐  │                   │                │
│  │  GET /api/chat/    │  │ Body:             │                │
│  │  conversation/     │  │ {model, messages, │                │
│  │  [sessionId]       │  │  max_tokens, ...} │                │
│  │  (Admin)           │  │                   │                │
│  │                    │  │ Response:         │                │
│  │  Returns full      │  │ {choices[0]       │                │
│  │  conversation      │  │  .message.content}│                │
│  │  history           │  └───────────────────┘                │
│  └────────────────────┘                                        │
│            │                                                    │
│            ▼ Service Role Key                                   │
├──────────────────────────────────────────────────────────────────┤
│                    SUPABASE DATABASE                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              chat_sessions Table                         │  │
│  │  ┌─────────┬──────────────────────────────────────────┐  │  │
│  │  │ id      │ UUID                                     │  │  │
│  │  │ user_id │ UUID (optional for auth users)          │  │  │
│  │  │ email   │ varchar(255)                             │  │  │
│  │  │ name    │ varchar(255)                             │  │  │
│  │  │ role    │ varchar(50) - 'visitor' or 'tenant'    │  │  │
│  │  │ created │ timestamp with timezone                 │  │  │
│  │  │ updated │ timestamp with timezone                 │  │  │
│  │  └─────────┴──────────────────────────────────────────┘  │  │
│  │              Indexes: session_id, created_at              │  │
│  │              RLS Policies: Users see own sessions        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              chat_messages Table                         │  │
│  │  ┌─────────┬──────────────────────────────────────────┐  │  │
│  │  │ id      │ UUID                                     │  │  │
│  │  │ session │ UUID (FK to chat_sessions)              │  │  │
│  │  │ sender  │ varchar(50) - 'user' or 'assistant'     │  │  │
│  │  │ message │ TEXT                                     │  │  │
│  │  │ created │ timestamp with timezone                 │  │  │
│  │  │ metadata│ JSONB (tokens, model, etc.)             │  │  │
│  │  └─────────┴──────────────────────────────────────────┘  │  │
│  │              Indexes: session_id, created_at              │  │
│  │              RLS Policies: Users see own messages        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Message Flow Sequence

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER SENDS A MESSAGE                         │
└─────────────────────────────────────────────────────────────────┘

1. CHAT WIDGET (Frontend)
   │
   ├─→ User types: "What's the rent?"
   │
   ├─→ User clicks Send button
   │
   ├─→ ChatWidget creates message object
   │   {
   │     sender_role: "user",
   │     message: "What's the rent?"
   │   }
   │
   ├─→ Message added to local state (displayed immediately)
   │
   ├─→ POST /api/chat/message
   │   {
   │     sessionId: "abc-123-def",
   │     message: "What's the rent?"
   │   }
   │
   └──→ Enter Loading State (show animated dots)

2. NEXT.JS API ROUTE (Backend)
   │
   ├─→ POST /api/chat/message received
   │
   ├─→ Validate inputs
   │   ├─ sessionId exists?
   │   └─ message not empty?
   │
   ├─→ Supabase: Store user message
   │   INSERT INTO chat_messages
   │   (session_id, sender_role, message)
   │   VALUES ('abc-123-def', 'user', 'What\'s the rent?')
   │
   ├─→ Supabase: Fetch conversation history (last 10 messages)
   │   SELECT sender_role, message
   │   FROM chat_messages
   │   WHERE session_id = 'abc-123-def'
   │   ORDER BY created_at
   │   LIMIT 10
   │
   ├─→ Build messages array for OpenAI:
   │   [
   │     { role: "system", content: "You are apartment receptionist..." },
   │     { role: "user", content: "Previous message..." },
   │     { role: "assistant", content: "Previous response..." },
   │     ...
   │     { role: "user", content: "What's the rent?" }
   │   ]
   │
   └──→ Call OpenAI API

3. OPENAI API (AI Service)
   │
   ├─→ POST https://api.openai.com/v1/chat/completions
   │   Headers:
   │     Authorization: Bearer sk_live_xxxxxx
   │     Content-Type: application/json
   │
   ├─→ Body:
   │   {
   │     model: "gpt-4o-mini",
   │     messages: [ ... ],
   │     temperature: 0.7,
   │     max_tokens: 500
   │   }
   │
   ├─→ OpenAI processes message
   │
   ├─→ Generate response about rent
   │
   └──→ Return response:
       {
         choices: [
           {
             message: {
               content: "Our rent ranges from $500 to $2000..."
             }
           }
         ]
       }

4. NEXT.JS API ROUTE (Backend) - Continue
   │
   ├─→ Extract response from OpenAI
   │   const reply = "Our rent ranges from $500..."
   │
   ├─→ Supabase: Store assistant message
   │   INSERT INTO chat_messages
   │   (session_id, sender_role, message)
   │   VALUES ('abc-123-def', 'assistant', 'Our rent ranges...')
   │
   ├─→ Return response:
   │   { reply: "Our rent ranges from $500..." }
   │
   └──→ Response sent to frontend

5. CHAT WIDGET (Frontend) - Receive Response
   │
   ├─→ Fetch completes, get response
   │
   ├─→ Clear loading state
   │
   ├─→ Create assistant message:
   │   {
   │     sender_role: "assistant",
   │     message: "Our rent ranges from $500..."
   │   }
   │
   ├─→ Add to messages state
   │   messages = [
   │     { sender_role: "user", message: "What's the rent?" },
   │     { sender_role: "assistant", message: "Our rent ranges..." }
   │   ]
   │
   ├─→ Component re-renders
   │
   ├─→ Both messages visible in chat
   │
   └──→ Auto-scroll to newest message

6. DATABASE (Supabase) - Final State
   │
   ├─→ chat_sessions
   │   id: "abc-123-def"
   │   user_email: "visitor@example.com"
   │   user_role: "visitor"
   │   created_at: "2026-01-22 10:30:00"
   │   message_count: 2
   │
   └─→ chat_messages
       [
         {
           id: "msg-1",
           session_id: "abc-123-def",
           sender_role: "user",
           message: "What's the rent?"
           created_at: "2026-01-22 10:30:15"
         },
         {
           id: "msg-2",
           session_id: "abc-123-def",
           sender_role: "assistant",
           message: "Our rent ranges from $500..."
           created_at: "2026-01-22 10:30:18"
         }
       ]
```

## Admin Dashboard Flow

```
┌─────────────────────────────────────────────────────┐
│        Admin Opens Chat Management Page             │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│  ChatSessionsManagerClient Component Renders       │
│                                                    │
│  - useEffect hook triggers                         │
│  - Calls: GET /api/chat/sessions                   │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│  Next.js API Returns Sessions                      │
│  [                                                 │
│    {                                               │
│      id: "session-1",                              │
│      user_email: "john@example.com",               │
│      user_role: "visitor",                         │
│      message_count: 5                              │
│    },                                              │
│    {...}                                           │
│  ]                                                 │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│  Display Table of Sessions                         │
│  ┌─────────────────────────────────────────────┐   │
│  │ Email      │ Name │ Role    │ Msgs │ Actions │   │
│  ├─────────────────────────────────────────────┤   │
│  │ john@...   │ John │ Visitor │  5   │ View |  │   │
│  │ jane@...   │ Jane │ Tenant  │  8   │ View |  │   │
│  │ ...        │ ...  │ ...     │ ...  │ ...  │  │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
          │
          ├─→ Admin clicks "View" button
          │           │
          │           ▼
          │   ┌─────────────────────┐
          │   │ Call fetchMessages  │
          │   │ GET /api/chat/      │
          │   │ conversation/{id}   │
          │   └─────────────────────┘
          │           │
          │           ▼
          │   ┌──────────────────────────┐
          │   │ Return conversation data │
          │   │ [                        │
          │   │   {sender: "user", ...}  │
          │   │   {sender: "assistant"...}
          │   │   ...                    │
          │   │ ]                        │
          │   └──────────────────────────┘
          │           │
          │           ▼
          │   ┌────────────────────────┐
          │   │ Show Modal with chat   │
          │   │ Display all messages   │
          │   └────────────────────────┘
          │
          └─→ Admin clicks "Download" button
                      │
                      ▼
              ┌──────────────────────┐
              │ Generate text file   │
              │ Chat-session-id.txt  │
              │ Download to computer │
              └──────────────────────┘
```

## Data Relationships

```
┌─────────────────────────────────────────┐
│          chat_sessions (Parent)         │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ id (UUID, Primary Key)          │   │
│  │ user_id (UUID, nullable)        │   │
│  │ user_email (varchar)            │   │
│  │ user_name (varchar)             │   │
│  │ user_role (varchar)             │   │
│  │ created_at (timestamp)          │   │
│  │ updated_at (timestamp)          │   │
│  │ is_active (boolean)             │   │
│  └─────────────────────────────────┘   │
│            │ (1 to Many)                │
│            │ Foreign Key: session_id    │
│            ▼                            │
│  ┌─────────────────────────────────┐   │
│  │      chat_messages (Child)      │   │
│  │                                 │   │
│  │  ┌─────────────────────────┐    │   │
│  │  │ id (UUID, Primary Key)  │    │   │
│  │  │ session_id (UUID, FK)   │◄───┘   │
│  │  │ sender_role (varchar)   │        │
│  │  │ message (text)          │        │
│  │  │ created_at (timestamp)  │        │
│  │  │ metadata (jsonb)        │        │
│  │  └─────────────────────────┘        │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘

ONE SESSION → MANY MESSAGES
Example:
  Session ABC-123
    ├─ Message 1: "Hello"
    ├─ Message 2: "Hi there..."
    ├─ Message 3: "How can I book?"
    └─ Message 4: "You can book..."
```

## Component Hierarchy

```
RootLayoutClient
    │
    ├─ LanguageProvider
    │       │
    │       └─ All pages
    │             │
    │             └─ ChatWidget ◄─ Renders on all pages
    │                   │
    │                   ├─ Floating Button
    │                   ├─ Chat Window
    │                   │   ├─ Header
    │                   │   ├─ Messages Container
    │                   │   └─ Input Form
    │                   │
    │                   └─ useEffect hooks
    │                       ├─ Initialize session
    │                       ├─ Auto-scroll
    │                       └─ Message sending
    │
    └─ Admin Dashboard (optional page)
        │
        ├─ ChatSessionsManager (Server Component)
        │   └─ Display sessions table
        │
        └─ ChatSessionsManagerClient (Client Component)
            ├─ ChatSessionsManagerClient
            │   ├─ Table with sessions
            │   ├─ View/Export buttons
            │   └─ useEffect to fetch sessions
            │
            └─ ChatConversationDialog
                ├─ Modal display
                ├─ Message display
                └─ useEffect to fetch messages
```

## Security Flow

```
Frontend (Browser)
   │
   │ User sends message
   ▼
POST /api/chat/message
   │
   ├─ API receives request over HTTPS
   │
   ├─ Validate session exists
   │
   ├─ Store user message in Supabase
   │  (RLS policy checks: user owns session)
   │
   ├─ Fetch context from Supabase
   │  (RLS policy checks: user owns session)
   │
   └─ NEVER expose OpenAI key to frontend
      │
      ├─ Read OpenAI key from environment
      │  (OPENAI_API_KEY in .env.local)
      │
      ├─ Send to OpenAI API over HTTPS
      │
      ├─ Get response
      │
      └─ Store response in Supabase
```

---

These diagrams show:
1. **Complete System Architecture** - How all components interact
2. **Message Flow** - Step-by-step process of sending a message
3. **Admin Dashboard** - How admins view conversations
4. **Data Relationships** - How database tables connect
5. **Component Hierarchy** - React component structure
6. **Security Flow** - How API keys are protected

For more information, see IMPLEMENTATION_SUMMARY.md
