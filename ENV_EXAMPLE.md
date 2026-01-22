# Example Environment Configuration

## .env.local (Create this file in the root directory)

```env
# ============================================================
# OpenAI Configuration
# ============================================================
# Get your API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=your-openai-api-key-here

# ============================================================
# Supabase Configuration
# ============================================================
# Get these from Supabase Dashboard > Settings > API

# Your Supabase project URL
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Public anonymous key (safe to expose)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdXItcHJvamVjdCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjMwNzA5ODAwLCJleHAiOjE5OTk5OTk5OTl9.xxxxx

# Service role key (KEEP SECRET - never commit to git!)
# Only use server-side in API routes
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdXItcHJvamVjdCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2MzA3MDk4MDAsImV4cCI6MTk5OTk5OTk5OX0.xxxxx

# ============================================================
# Optional: Additional Configuration
# ============================================================

# Change AI model (default: gpt-4o-mini)
# Options: gpt-4o-mini (recommended), gpt-4o, gpt-4, gpt-3.5-turbo
# CHATBOT_MODEL=gpt-4o-mini

# Change AI temperature (0-1, default: 0.7)
# Lower = more deterministic, Higher = more creative
# CHATBOT_TEMPERATURE=0.7

# Max context messages to include (default: 10)
# CHATBOT_CONTEXT_SIZE=10

# Max tokens per response (default: 500)
# CHATBOT_MAX_TOKENS=500
```

## How to Get Your Keys

### OpenAI API Key
1. Go to https://platform.openai.com/account/api-keys
2. Click "Create new secret key"
3. Copy the key immediately (you won't see it again)
4. Paste into `OPENAI_API_KEY`

### Supabase Keys
1. Go to your Supabase Dashboard
2. Click Settings (bottom left)
3. Click API
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon Public Key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Service Role Secret → `SUPABASE_SERVICE_ROLE_KEY`

## Security Notes

⚠️ **IMPORTANT:**
- Never commit `.env.local` to Git
- `.env.local` is already in `.gitignore`
- Service role key should ONLY be used server-side
- Never expose `OPENAI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to frontend
- Rotate keys regularly if compromised

## Testing Your Configuration

After setting up environment variables:

```bash
# Test that Next.js can read the variables
node -e "console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Missing')"

# Run your app
pnpm dev

# Try sending a message in the chat widget
# Check that it works without errors
```

## Production Deployment

When deploying to production (Vercel, etc.):

1. Go to your deployment dashboard
2. Add environment variables:
   - `OPENAI_API_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. `NEXT_PUBLIC_*` variables are included automatically from build
4. Redeploy your application

## Example Values (For Testing Only)

```env
# DO NOT USE THESE IN PRODUCTION - GET YOUR OWN KEYS

# Format example (not real):
OPENAI_API_KEY=your-openai-api-key-here
NEXT_PUBLIC_SUPABASE_URL=https://example-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Troubleshooting

### "Missing OpenAI API Key"
- Check `.env.local` exists in root directory
- Verify `OPENAI_API_KEY` starts with `sk_`
- Restart dev server after adding keys

### "Supabase connection failed"
- Verify `NEXT_PUBLIC_SUPABASE_URL` starts with `https://`
- Check URL ends with `.supabase.co`
- Verify anon key format (long string starting with `eyJ`)

### "Failed to fetch from API"
- Check all required env vars are set
- Restart dev server
- Check network tab in browser DevTools
- Review server logs

## Environment Variable Reference

| Variable | Location | Required | Secret | Purpose |
|----------|----------|----------|--------|---------|
| `OPENAI_API_KEY` | `.env.local` | ✓ | ✓ | OpenAI API authentication |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | ✓ | ✗ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` | ✓ | ✗ | Supabase public key |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | ✓ | ✓ | Supabase server-side key |

---

For more information, see `CHATBOT_SETUP.md` and `CHATBOT_QUICKSTART.md`
