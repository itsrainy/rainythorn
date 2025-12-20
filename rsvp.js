// RSVP Module JavaScript
// This file handles all RSVP functionality for the wedding website

const RSVPModule = (function() {
    // Supabase configuration
    const SUPABASE_URL = 'https://zebjmroualsnbnmibzce.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplYmptcm91YWxzbmJubWliemNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwNTgxNjgsImV4cCI6MjA4MDYzNDE2OH0.47ivldoazZ6OIqUDc8C9PNgDPfOw7Ym3T8Ru1ni7ByU';

    // RSVP deadline - April 23, 2026
    const RSVP_DEADLINE = new Date('2026-04-23T23:59:59');

    let supabase = null;
    let currentInvite = null;
    let currentGuests = [];

    // Initialize Supabase client
    function initSupabase() {
        if (window.supabase && !supabase) {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }
        return supabase;
    }

    // Check if deadline has passed
    function isDeadlinePassed() {
        return new Date() > RSVP_DEADLINE;
    }

    // Check if user has RSVP'd (for private details access)
    function hasRSVPd() {
        return localStorage.getItem('rsvpCompleted') === 'true';
    }

    // Unlock private details on the page
    function unlockPrivateDetails() {
        document.querySelectorAll('.private-details').forEach(el => {
            el.classList.remove('hidden');
        });
        document.querySelectorAll('.public-only').forEach(el => {
            el.classList.add('hidden');
        });
    }

    // Show a specific RSVP step
    function showStep(stepId) {
        document.querySelectorAll('.rsvp-step').forEach(step => {
            step.classList.add('hidden');
            step.classList.remove('active');
        });
        const step = document.getElementById(stepId);
        if (step) {
            step.classList.remove('hidden');
            step.classList.add('active');
        }
    }

    // Send confirmation email via Supabase Edge Function
    async function sendConfirmationEmail(inviteUpdate) {
        try {
            // Build guest data with current attendance status
            const guestsWithAttendance = currentGuests.map(guest => {
                const attendingRadio = document.querySelector(`input[name="attending-${guest.id}"]:checked`);
                const dietary = document.getElementById(`dietary-${guest.id}`).value.trim();
                return {
                    first_name: guest.first_name,
                    last_name: guest.last_name,
                    attending: attendingRadio ? attendingRadio.value === 'true' : null,
                    dietary_restrictions: dietary || null,
                    is_child: guest.is_child
                };
            });

            const emailData = {
                household_name: currentInvite.household_name,
                email: inviteUpdate.email,
                edit_token: currentInvite.edit_token,
                guests: guestsWithAttendance,
                welcome_party: inviteUpdate.welcome_party,
                wedding: inviteUpdate.wedding,
                plus_one_name: inviteUpdate.plus_one_name || null,
                plus_one_dietary: inviteUpdate.plus_one_dietary || null
            };

            const response = await fetch(
                `${SUPABASE_URL}/functions/v1/send-rsvp-confirmation`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify(emailData)
                }
            );

            if (!response.ok) {
                const error = await response.json();
                console.error('Email send error:', error);
            } else {
                console.log('Confirmation email sent successfully');
            }
        } catch (err) {
            // Don't block the RSVP success on email failure
            console.error('Failed to send confirmation email:', err);
        }
    }

    // Load invite and guests by token
    async function loadInviteByToken(token) {
        const client = initSupabase();

        // Get invite data RPC function
        const { data: inviteData, error: inviteError } = await client.rpc('get_invite_by_token', {
            token: token
        });

        if (inviteError || !inviteData || inviteData.length === 0) {
            console.error('Error loading invite:', inviteError);
            return false;
        }

        // Get guests RPC function
        const { data: guestsData, error: guestsError } = await client.rpc('get_guests_by_token', {
            token: token
        });

        if (guestsError) {
            console.error('Error loading guests:', guestsError);
            return false;
        }

        // Map the RPC response to our expected format
        currentInvite = {
            id: inviteData[0].invite_id,
            household_name: inviteData[0].household_name,
            email: inviteData[0].email,
            allows_plus_one: inviteData[0].allows_plus_one,
            edit_token: inviteData[0].edit_token,
            welcome_party: inviteData[0].welcome_party,
            wedding: inviteData[0].wedding,
            setup_teardown_interest: inviteData[0].setup_teardown_interest,
            plus_one_name: inviteData[0].plus_one_name,
            plus_one_dietary: inviteData[0].plus_one_dietary,
            submitted_at: inviteData[0].submitted_at
        };

        currentGuests = guestsData.map(g => ({
            id: g.guest_id,
            first_name: g.first_name,
            last_name: g.last_name,
            is_child: g.is_child,
            attending: g.attending,
            dietary_restrictions: g.dietary_restrictions
        }));

        return true;
    }



    // Render the RSVP form with guest cards
    function renderInviteForm() {
        // Set household name
        document.getElementById('rsvp-household-name').textContent = currentInvite.household_name;

        // Pre-fill email if exists
        const emailField = document.getElementById('rsvp-email');
        if (currentInvite.email) {
            emailField.value = currentInvite.email;
        } else {
            // Try to get from localStorage (from landing page form)
            const guestInfo = localStorage.getItem('guestInfo');
            if (guestInfo) {
                const guest = JSON.parse(guestInfo);
                if (guest.email) {
                    emailField.value = guest.email;
                }
            }
        }

        // Render guest cards
        const guestsList = document.getElementById('rsvp-guests-list');
        guestsList.innerHTML = currentGuests.map(guest => `
            <div class="guest-card" data-guest-id="${guest.id}">
                <div class="guest-header">
                    <span class="guest-name">${guest.first_name} ${guest.last_name}</span>
                    ${guest.is_child ? '<span class="guest-badge">Child</span>' : ''}
                </div>
                <div class="guest-attendance">
                    <label class="radio-option">
                        <input type="radio" name="attending-${guest.id}" value="true"
                            ${guest.attending === true ? 'checked' : ''}>
                        <span>Attending</span>
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="attending-${guest.id}" value="false"
                            ${guest.attending === false ? 'checked' : ''}>
                        <span>Not Attending</span>
                    </label>
                </div>
                <div class="form-group dietary-group">
                    <label for="dietary-${guest.id}">Dietary Restrictions</label>
                    <input type="text" id="dietary-${guest.id}"
                        value="${guest.dietary_restrictions || ''}"
                        placeholder="Vegetarian, allergies, etc.">
                </div>
            </div>
        `).join('');

        // Show/hide plus one section
        const plusOneSection = document.getElementById('rsvp-plus-one');
        const plusOneCheckbox = document.getElementById('bringing-plus-one');
        const plusOneFields = document.getElementById('plus-one-fields');

        if (currentInvite.allows_plus_one) {
            plusOneSection.classList.remove('hidden');

            // Pre-fill plus-one data
            const hasExistingPlusOne = currentInvite.plus_one_name && currentInvite.plus_one_name.trim() !== '';
            plusOneCheckbox.checked = hasExistingPlusOne;
            plusOneFields.classList.toggle('hidden', !hasExistingPlusOne);

            document.getElementById('plus-one-name').value = currentInvite.plus_one_name || '';
            document.getElementById('plus-one-dietary').value = currentInvite.plus_one_dietary || '';

            // Toggle plus-one fields when checkbox changes
            plusOneCheckbox.addEventListener('change', function() {
                plusOneFields.classList.toggle('hidden', !this.checked);
                if (!this.checked) {
                    // Clear fields when unchecked
                    document.getElementById('plus-one-name').value = '';
                    document.getElementById('plus-one-dietary').value = '';
                }
            });
        } else {
            plusOneSection.classList.add('hidden');
        }

        // Pre-fill events
        document.getElementById('event-welcome').checked = currentInvite.welcome_party || false;
        document.getElementById('event-wedding').checked = currentInvite.wedding || false;
        document.getElementById('setup-teardown').checked = currentInvite.setup_teardown_interest || false;
    }

    // Handle RSVP form submission
    async function handleSubmit(e) {
        e.preventDefault();

        if (isDeadlinePassed()) {
            showStep('rsvp-deadline');
            return;
        }

        const btn = e.target.querySelector('.submit-btn');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<span class="btn-text">Submitting...</span>';
        btn.disabled = true;

        try {
            const client = initSupabase();

            // Collect guest updates
            const guestUpdates = currentGuests.map(guest => {
                const attendingRadio = document.querySelector(`input[name="attending-${guest.id}"]:checked`);
                const dietary = document.getElementById(`dietary-${guest.id}`).value.trim();
                
                return {
                    id: guest.id,
                    attending: attendingRadio ? attendingRadio.value === 'true' : null,
                    dietary_restrictions: dietary || null
                };
            });

            // Collect invite data
            const inviteUpdate = {
                email: document.getElementById('rsvp-email').value.trim(),
                welcome_party: document.getElementById('event-welcome').checked,
                wedding: document.getElementById('event-wedding').checked,
                setup_teardown_interest: document.getElementById('setup-teardown').checked
            };

            // Plus one data
            let plusOneName = null;
            let plusOneDietary = null;
            if (currentInvite.allows_plus_one) {
                plusOneName = document.getElementById('plus-one-name').value.trim() || null;
                plusOneDietary = document.getElementById('plus-one-dietary').value.trim() || null;
            }

            // Submit RPC function
            const { data, error } = await client.rpc('submit_rsvp', {
                token: currentInvite.edit_token,
                rsvp_email: inviteUpdate.email,
                rsvp_welcome_party: inviteUpdate.welcome_party,
                rsvp_wedding: inviteUpdate.wedding,
                rsvp_setup_interest: inviteUpdate.setup_teardown_interest,
                rsvp_plus_one_name: plusOneName,
                rsvp_plus_one_dietary: plusOneDietary,
                guest_updates: guestUpdates
            });

            if (error || !data || !data.success) {
                throw new Error(data?.error || 'Failed to submit RSVP');
            }

            // Mark as RSVP'd in localStorage
            localStorage.setItem('rsvpCompleted', 'true');
            localStorage.setItem('rsvpToken', currentInvite.edit_token);

            // Unlock private details
            unlockPrivateDetails();

            // Show success
            showStep('rsvp-success');

            // Send confirmation email via edge function
            inviteUpdate.plus_one_name = plusOneName;
            inviteUpdate.plus_one_dietary = plusOneDietary;
            sendConfirmationEmail(inviteUpdate);

        } catch (err) {
            console.error('Submit error:', err);
            alert('There was an error submitting your RSVP. Please try again.');
        } finally {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    }

    // Initialize the RSVP module
    function init() {
        // Wait for Supabase to load
        if (!window.supabase) {
            setTimeout(init, 100);
            return;
        }

        initSupabase();

        // Check for edit token in URL
        const urlParams = new URLSearchParams(window.location.search);
        const editToken = urlParams.get('token');

        if (editToken) {
            // Check deadline first
            if (isDeadlinePassed()) {
                showStep('rsvp-deadline');
                unlockPrivateDetails(); // Still show details if they have a token
            } else {
                // Load invite by token
                loadInviteByToken(editToken).then(loaded => {
                    if (loaded) {
                        renderInviteForm();
                        showStep('rsvp-form-container');
                        unlockPrivateDetails();
                    } else {
                        // Invalid token
                        showStep('rsvp-no-token');
                    }
                });
            }
        } else {
            // No token provided - show message
            showStep('rsvp-no-token');
        }

        // Check if already RSVP'd (for private details)
        if (hasRSVPd()) {
            unlockPrivateDetails();
        }

        // Bind form events
        const mainForm = document.getElementById('rsvp-main-form');

        if (mainForm) {
            mainForm.addEventListener('submit', handleSubmit);
        }
    }

    return { init, unlockPrivateDetails, hasRSVPd };
})();

// Initialize RSVP module when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    RSVPModule.init();
});
