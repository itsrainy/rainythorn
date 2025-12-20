-- Wedding RSVP Database Schema
-- Run this in Supabase SQL Editor (supabase.com → your project → SQL Editor)

-- Invites table (one per household)
CREATE TABLE invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_name TEXT NOT NULL,
    email TEXT,
    allows_plus_one BOOLEAN DEFAULT false,
    edit_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    welcome_party BOOLEAN DEFAULT NULL,
    wedding BOOLEAN DEFAULT NULL,
    setup_teardown_interest BOOLEAN DEFAULT false,
    plus_one_name TEXT,
    plus_one_dietary TEXT,
    submitted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Guests table (individual people on each invite)
CREATE TABLE guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invite_id UUID NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    is_child BOOLEAN DEFAULT false,
    attending BOOLEAN DEFAULT NULL,
    dietary_restrictions TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_guests_invite_id ON guests(invite_id);
CREATE INDEX idx_invites_edit_token ON invites(edit_token);

-- Function to load invite by token (secure, read-only)
CREATE OR REPLACE FUNCTION get_invite_by_token(token TEXT)
RETURNS TABLE(
    invite_id UUID,
    household_name TEXT,
    email TEXT,
    allows_plus_one BOOLEAN,
    edit_token TEXT,
    welcome_party BOOLEAN,
    wedding BOOLEAN,
    setup_teardown_interest BOOLEAN,
    plus_one_name TEXT,
    plus_one_dietary TEXT,
    submitted_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.household_name,
        i.email,
        i.allows_plus_one,
        i.edit_token,
        i.welcome_party,
        i.wedding,
        i.setup_teardown_interest,
        i.plus_one_name,
        i.plus_one_dietary,
        i.submitted_at
    FROM invites i
    WHERE i.edit_token = token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get guests for an invite by token
CREATE OR REPLACE FUNCTION get_guests_by_token(token TEXT)
RETURNS TABLE(
    guest_id UUID,
    first_name TEXT,
    last_name TEXT,
    is_child BOOLEAN,
    attending BOOLEAN,
    dietary_restrictions TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.first_name,
        g.last_name,
        g.is_child,
        g.attending,
        g.dietary_restrictions
    FROM guests g
    JOIN invites i ON g.invite_id = i.id
    WHERE i.edit_token = token
    ORDER BY g.is_child ASC, g.first_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to submit RSVP (secure update with token validation)
CREATE OR REPLACE FUNCTION submit_rsvp(
    token TEXT,
    rsvp_email TEXT,
    rsvp_welcome_party BOOLEAN,
    rsvp_wedding BOOLEAN,
    rsvp_setup_interest BOOLEAN,
    rsvp_plus_one_name TEXT,
    rsvp_plus_one_dietary TEXT,
    guest_updates JSONB  -- Array of {id: UUID, attending: BOOLEAN, dietary: TEXT}
)
RETURNS JSONB AS $$
DECLARE
    invite_record RECORD;
    guest_update JSONB;
BEGIN
    -- Find and lock the invite
    SELECT id, submitted_at INTO invite_record
    FROM invites
    WHERE edit_token = token
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid token');
    END IF;

    -- Update invite
    UPDATE invites SET
        email = rsvp_email,
        welcome_party = rsvp_welcome_party,
        wedding = rsvp_wedding,
        setup_teardown_interest = rsvp_setup_interest,
        plus_one_name = rsvp_plus_one_name,
        plus_one_dietary = rsvp_plus_one_dietary,
        submitted_at = COALESCE(submitted_at, now()),
        updated_at = now()
    WHERE id = invite_record.id;

    -- Update guests
    FOR guest_update IN SELECT * FROM jsonb_array_elements(guest_updates)
    LOOP
        UPDATE guests SET
            attending = (guest_update->>'attending')::BOOLEAN,
            dietary_restrictions = guest_update->>'dietary_restrictions'
        WHERE id = (guest_update->>'id')::UUID
        AND invite_id = invite_record.id;  -- Security: ensure guest belongs to this invite
    END LOOP;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Deny all direct access for anon users (use RPC functions instead)
-- Service role (admin) bypasses RLS, so admin panel will work
CREATE POLICY "Deny direct access to invites for anon" ON invites 
    FOR ALL 
    TO anon 
    USING (false);

CREATE POLICY "Deny direct access to guests for anon" ON guests 
    FOR ALL 
    TO anon 
    USING (false);

-- Allow service role full access (for admin operations)
CREATE POLICY "Allow service role full access to invites" ON invites 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow service role full access to guests" ON guests 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

-- Insert some test data (you can delete this later)
-- Run this AFTER the schema above

-- Test Family with plus one allowed
WITH new_invite AS (
    INSERT INTO invites (household_name, email, allows_plus_one)
    VALUES ('Test Family', 'test@example.com', true)
    RETURNING id, edit_token
)
INSERT INTO guests (invite_id, first_name, last_name, is_child)
SELECT id, first_name, last_name, is_child FROM new_invite
CROSS JOIN (VALUES
    ('Jane', 'Test', false),
    ('John', 'Test', false),
    ('Tommy', 'Test', true)
) AS g(first_name, last_name, is_child);

-- Show the test invite info
SELECT id, household_name, edit_token FROM invites WHERE household_name = 'Test Family';
