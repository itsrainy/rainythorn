-- Add follow_up_sent_at column to track which households have received the follow-up email
ALTER TABLE invites ADD COLUMN IF NOT EXISTS follow_up_sent_at TIMESTAMPTZ;
