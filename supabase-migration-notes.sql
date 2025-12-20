-- Migration: Add notes column to invites table
-- Run this in the Supabase SQL Editor

-- Add notes column to invites table
ALTER TABLE invites ADD COLUMN IF NOT EXISTS notes TEXT;

-- Drop existing functions first (required when changing return type)
DROP FUNCTION IF EXISTS get_invite_by_token(TEXT);
DROP FUNCTION IF EXISTS submit_rsvp(TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT, JSONB);

-- Recreate get_invite_by_token with notes
CREATE OR REPLACE FUNCTION get_invite_by_token(token TEXT)
RETURNS TABLE(
    id UUID,
    household_name TEXT,
    email TEXT,
    allows_plus_one BOOLEAN,
    edit_token TEXT,
    welcome_party BOOLEAN,
    wedding BOOLEAN,
    setup_teardown_interest BOOLEAN,
    plus_one_name TEXT,
    plus_one_dietary TEXT,
    submitted_at TIMESTAMPTZ,
    notes TEXT
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
        i.submitted_at,
        i.notes
    FROM invites i
    WHERE i.edit_token = token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update submit_rsvp to use notes instead of email
CREATE OR REPLACE FUNCTION submit_rsvp(
    token TEXT,
    rsvp_notes TEXT,
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
        notes = rsvp_notes,
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
