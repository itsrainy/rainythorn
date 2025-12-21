-- Add viewed_at column to track when invites are first opened
ALTER TABLE invites ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;

-- Wrap in transaction for atomicity
BEGIN;

-- Drop the old function first (required because Postgres thinks signature differs)
DROP FUNCTION IF EXISTS get_invite_by_token(text);

-- Recreate the function with viewed_at tracking
CREATE FUNCTION get_invite_by_token(token TEXT)
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
    -- Mark as viewed on first access
    UPDATE invites i SET viewed_at = NOW() 
    WHERE i.edit_token = token AND i.viewed_at IS NULL;
    
    -- Return the invite data
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMIT;
