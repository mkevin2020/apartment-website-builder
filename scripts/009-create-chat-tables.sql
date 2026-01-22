-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email VARCHAR(255),
  user_role VARCHAR(50) DEFAULT 'visitor', -- 'visitor' or 'tenant'
  user_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender_role VARCHAR(50) NOT NULL, -- 'user' or 'assistant'
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB -- Store additional info like tokens used, model, etc.
);

-- Create indexes for better query performance
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_user_email ON chat_sessions(user_email);
CREATE INDEX idx_chat_sessions_created_at ON chat_sessions(created_at);
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_sessions
-- Users can view their own sessions
CREATE POLICY "Users can view their own sessions"
  ON chat_sessions
  FOR SELECT
  USING (
    auth.uid() = user_id OR user_id IS NULL
  );

-- Users can create sessions
CREATE POLICY "Users can create sessions"
  ON chat_sessions
  FOR INSERT
  WITH CHECK (true);

-- Users can update their own sessions
CREATE POLICY "Users can update their own sessions"
  ON chat_sessions
  FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- RLS Policies for chat_messages
-- Users can view messages from their sessions
CREATE POLICY "Users can view messages from their sessions"
  ON chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND (auth.uid() = chat_sessions.user_id OR chat_sessions.user_id IS NULL)
    )
  );

-- Users can insert messages to their sessions
CREATE POLICY "Users can insert messages to their sessions"
  ON chat_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = session_id 
      AND (auth.uid() = chat_sessions.user_id OR chat_sessions.user_id IS NULL)
    )
  );
