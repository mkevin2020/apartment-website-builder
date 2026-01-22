# 🧪 Chatbot Testing Guide

Complete guide to test the AI chatbot implementation.

## Pre-Testing Checklist

- [ ] All environment variables set in `.env.local`
- [ ] Database migration completed (chat tables created)
- [ ] Dependencies installed (`pnpm install`)
- [ ] Dev server running (`pnpm dev`)
- [ ] No errors in browser console (F12)
- [ ] No errors in server terminal

## Test 1: Visual Integration

### What to Check
- Chat icon appears in bottom-right corner
- Icon has blue gradient background
- Icon is clickable
- Chat window opens when icon is clicked
- Chat window closes when close button (X) is clicked

### Steps
1. Open `http://localhost:3000`
2. Look for message icon in bottom-right corner
3. Click to open chat window
4. Click X to close
5. Click again to reopen

### Expected Result
✅ Chat widget displays and toggles smoothly

---

## Test 2: Session Creation

### What to Check
- Session is created on first chat open
- Session ID is stored in localStorage
- Same session is reused within 24 hours
- New session created after localStorage clear

### Steps
1. Open browser DevTools (F12)
2. Go to Application → LocalStorage
3. Open chat widget
4. Check localStorage for `chat_session_id`
5. Refresh page and check session ID is same
6. Clear localStorage and open chat again
7. Verify new session ID is created

### Expected Result
✅ Session ID appears in localStorage and persists across refreshes

---

## Test 3: Message Sending

### What to Check
- User can type message
- Message displays in chat
- Send button is enabled
- Loading indicator appears
- Response appears within 5 seconds

### Steps
1. Open chat widget
2. Type "Hello, who are you?"
3. Click send button
4. Observe loading indicator (animated dots)
5. Wait for response

### Expected Result
✅ Message sent, response received: "I'm your Cielo Vista apartment assistant..."

---

## Test 4: AI Responses

### Test Different Question Types

**Availability Questions**
```
User: "What apartments do you have available?"
Expected: Response about apartment availability
Status: ✅/❌
```

**Pricing Questions**
```
User: "What are your rent prices?"
Expected: Response about pricing
Status: ✅/❌
```

**Booking Questions**
```
User: "How do I book a visit?"
Expected: Response about booking process
Status: ✅/❌
```

**Rules Questions**
```
User: "What are the apartment rules?"
Expected: Response about policies
Status: ✅/❌
```

**Maintenance Questions**
```
User: "How do I request maintenance?"
Expected: Response about maintenance process
Status: ✅/❌
```

**Out of Scope Questions**
```
User: "Tell me a joke"
Expected: Polite redirect to apartment-related topics
Status: ✅/❌
```

### Expected Result
✅ All responses are relevant, professional, and helpful

---

## Test 5: Database Storage

### Check Messages Are Saved

**Using Supabase Dashboard:**
1. Go to Supabase Dashboard
2. Select your project
3. Go to SQL Editor
4. Create new query
5. Run: `SELECT * FROM chat_sessions ORDER BY created_at DESC LIMIT 1;`
6. Run: `SELECT * FROM chat_messages WHERE session_id = 'YOUR_SESSION_ID' ORDER BY created_at;`

### Expected Result
✅ Sessions and messages appear in database

---

## Test 6: UI Responsiveness

### Desktop Testing
- [ ] Chat widget positioned correctly (bottom-right)
- [ ] Chat window width is appropriate (96 units)
- [ ] Chat window height is appropriate (600px)
- [ ] Messages display correctly
- [ ] Input field is usable
- [ ] Send button is clickable
- [ ] Header displays correctly
- [ ] Footer displays correctly

### Mobile Testing
1. Open DevTools (F12)
2. Click device toolbar icon
3. Select iPhone 12
4. [ ] Chat widget displays on mobile
5. [ ] Chat window fits screen
6. [ ] Messages are readable
7. [ ] Input is usable
8. [ ] No layout breaking

### Expected Result
✅ Chat works on desktop and mobile

---

## Test 7: Session Persistence

### What to Check
- Session persists across page refreshes
- Session persists across different pages
- Session expires after 24 hours (or localStorage clear)

### Steps
1. Open chat, send a message
2. Refresh page (Cmd+R)
3. Send another message to same session
4. Navigate to different page (`/apartments`, `/booking`, etc.)
5. Open chat and verify same session
6. Check database: both messages should be in same session

### Expected Result
✅ Session ID remains same across refreshes and page navigations

---

## Test 8: Error Handling

### Test Missing API Keys
1. Remove `OPENAI_API_KEY` from `.env.local`
2. Restart dev server
3. Try sending a message
4. Expected: Graceful error message

### Test Invalid Session
1. Manually edit localStorage session ID to invalid UUID
2. Try sending a message
3. Expected: Error message or new session created

### Test Network Error
1. Disconnect internet (or use DevTools offline mode)
2. Try sending a message
3. Expected: Error message in chat

### Expected Result
✅ All errors handled gracefully with user-friendly messages

---

## Test 9: Auto-Scroll

### What to Check
- Chat auto-scrolls when window is full
- Latest message is always visible
- No scrolling lag

### Steps
1. Send 10+ messages
2. Verify newest message is at bottom
3. Observe auto-scroll on each new message
4. Try scrolling up then sending message
5. Verify auto-scrolls to newest

### Expected Result
✅ Chat automatically scrolls to show latest message

---

## Test 10: UI Polish

### Visual Checks
- [ ] Buttons have hover effects
- [ ] Icons are properly sized
- [ ] Colors are consistent
- [ ] Spacing is appropriate
- [ ] Font sizes are readable
- [ ] Loading animation is smooth
- [ ] Transitions are smooth
- [ ] Shadows look good
- [ ] Border radius is consistent

### Expected Result
✅ UI looks professional and polished

---

## Test 11: Multiple Sessions

### Test Multiple Users
1. Open chat in Main browser window
2. Open incognito/private window
3. Send messages in both
4. Check localStorage - different session IDs
5. Check database - both sessions exist

### Expected Result
✅ Each browser/session has unique session ID

---

## Test 12: Admin Dashboard (If Added)

### What to Check
- [ ] Can view all sessions
- [ ] Session list shows correct count
- [ ] Can click "View" to see conversation
- [ ] Can export conversation
- [ ] Exported file contains all messages

### Steps
1. Add `ChatSessionsManagerClient` to a page
2. Create multiple chat sessions
3. View the admin page
4. Click "View" on a session
5. Verify conversation displays
6. Click "Download" to export
7. Check exported file

### Expected Result
✅ Admin can view and manage all chat sessions

---

## Performance Testing

### Response Time
- First message response: < 5 seconds
- Subsequent messages: < 3 seconds

### Database Query Performance
```sql
-- Should complete in < 100ms
SELECT * FROM chat_messages 
WHERE session_id = 'YOUR_SESSION_ID' 
ORDER BY created_at DESC;

-- Should complete in < 50ms
SELECT * FROM chat_sessions 
WHERE created_at > NOW() - INTERVAL '7 days'
LIMIT 50;
```

### Expected Result
✅ Responses are fast and queries are performant

---

## Browser Compatibility

Test in multiple browsers:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge

### Expected Result
✅ Works in all modern browsers

---

## Production Checklist

Before deploying to production:

- [ ] All tests pass
- [ ] Environment variables configured
- [ ] Database migration completed
- [ ] No console errors
- [ ] No server errors
- [ ] Performance acceptable
- [ ] Security review completed
- [ ] Rate limiting considered
- [ ] Monitoring set up
- [ ] Backup strategy in place

---

## Troubleshooting Test Failures

### Chat widget not appearing
```bash
# Check browser console for errors
# Verify ChatWidget imported in root-layout-client.tsx
# Check CSS is loaded
# Try clearing cache and restarting
```

### Messages not sending
```bash
# Check OpenAI API key is valid
# Check Supabase connection
# Check database tables exist
# Review browser DevTools Network tab
# Check server logs for errors
```

### Database queries failing
```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Verify RLS policies
SELECT * FROM pg_policies;

-- Test insert
INSERT INTO chat_sessions (user_email, user_role) 
VALUES ('test@example.com', 'visitor');
```

### Slow responses
```
- Check OpenAI API status: https://status.openai.com/
- Monitor API usage: https://platform.openai.com/account/usage/overview
- Consider using faster model: gpt-3.5-turbo
- Check internet connection
- Check server load
```

---

## Monitoring Commands

```bash
# Watch server logs
tail -f ~/.pm2/logs/next-app-error.log

# Check API usage (via OpenAI Dashboard)
# Monitor database size
# Track error rates
# Monitor response times
```

---

## Test Report Template

```
Date: ___________
Tester: _________
Environment: Dev / Staging / Production

Test 1 - Visual Integration: ✅ / ❌
Test 2 - Session Creation: ✅ / ❌
Test 3 - Message Sending: ✅ / ❌
Test 4 - AI Responses: ✅ / ❌
Test 5 - Database Storage: ✅ / ❌
Test 6 - UI Responsiveness: ✅ / ❌
Test 7 - Session Persistence: ✅ / ❌
Test 8 - Error Handling: ✅ / ❌
Test 9 - Auto-Scroll: ✅ / ❌
Test 10 - UI Polish: ✅ / ❌
Test 11 - Multiple Sessions: ✅ / ❌
Test 12 - Admin Dashboard: ✅ / ❌

Notes: _______________________________________________

Overall Status: ✅ Ready for Deployment / ❌ Needs Fixes
```

---

**Happy testing! 🧪**
