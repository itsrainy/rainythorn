-- Test invites for different RSVP scenarios
-- Run this in Supabase SQL Editor

-- 1. Single person WITHOUT plus-one allowed
WITH new_invite AS (
    INSERT INTO invites (household_name, email, allows_plus_one)
    VALUES ('Solo Guest (No +1)', 'test-solo@example.com', false)
    RETURNING id, edit_token
)
INSERT INTO guests (invite_id, first_name, last_name, is_child)
SELECT id, 'Alex', 'Johnson', false FROM new_invite;

-- 2. Single person WITH plus-one allowed
WITH new_invite AS (
    INSERT INTO invites (household_name, email, allows_plus_one)
    VALUES ('Solo Guest (With +1)', 'test-plus1@example.com', true)
    RETURNING id, edit_token
)
INSERT INTO guests (invite_id, first_name, last_name, is_child)
SELECT id, 'Jordan', 'Smith', false FROM new_invite;

-- 3. View the test invites with their tokens
SELECT 
    household_name, 
    allows_plus_one,
    edit_token,
    'https://rainythorn.wedding/rsvp.html?token=' || edit_token as rsvp_url
FROM invites 
WHERE household_name LIKE 'Solo Guest%'
ORDER BY created_at DESC;
