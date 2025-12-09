// Admin Panel JavaScript
const SUPABASE_URL = 'https://zebjmroualsnbnmibzce.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplYmptcm91YWxzbmJubWliemNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwNTgxNjgsImV4cCI6MjA4MDYzNDE2OH0.47ivldoazZ6OIqUDc8C9PNgDPfOw7Ym3T8Ru1ni7ByU';

// Simple password protection (in production, use proper auth)
const ADMIN_PASSWORD = 'rainy&thorn2026';  // Change this!

let supabase = null;
let allInvites = [];

// Initialize Supabase
function initSupabase() {
    if (!supabase && window.supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabase;
}

// Login
function login() {
    const password = document.getElementById('admin-password').value;
    if (password === ADMIN_PASSWORD) {
        localStorage.setItem('adminLoggedIn', 'true');
        showAdminPanel();
    } else {
        alert('Incorrect password');
    }
}

// Logout
function logout() {
    localStorage.removeItem('adminLoggedIn');
    location.reload();
}

// Show/hide panels
function showAdminPanel() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('admin-panel').classList.remove('hidden');
    loadInvites();
}

// Check if logged in on page load
document.addEventListener('DOMContentLoaded', function() {
    initSupabase();
    
    if (localStorage.getItem('adminLoggedIn') === 'true') {
        showAdminPanel();
    }
});

// Load all invites with admin access
async function loadInvites() {
    const client = initSupabase();
    
    // Note: This requires updating RLS policies to allow admin access
    // For now, we'll use a service key in production or update RLS
    const { data, error } = await client
        .from('invites')
        .select(`
            *,
            guests:guests(*)
        `)
        .order('household_name');

    if (error) {
        console.error('Error loading invites:', error);
        alert('Error loading invites. Check console for details.');
        return;
    }

    allInvites = data || [];
    renderInvites(allInvites);
    updateStats(allInvites);
}

// Render invites table
function renderInvites(invites) {
    const tbody = document.getElementById('invites-tbody');
    
    if (!invites || invites.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">No invites yet. Import a CSV to get started.</td></tr>';
        return;
    }

    tbody.innerHTML = invites.map(invite => {
        const guests = invite.guests || [];
        const guestNames = guests.map(g => `${g.first_name} ${g.last_name}`).join(', ');
        const attending = guests.filter(g => g.attending === true).length;
        const notAttending = guests.filter(g => g.attending === false).length;
        
        let statusBadge = '<span class="status-badge status-pending">Pending</span>';
        let rsvpInfo = '—';
        
        if (invite.submitted_at) {
            statusBadge = '<span class="status-badge status-submitted">Submitted</span>';
            rsvpInfo = `${attending} yes, ${notAttending} no`;
        }

        const rsvpUrl = `https://rainythorn.wedding/rsvp.html?token=${invite.edit_token}`;
        
        return `
            <tr>
                <td><strong>${invite.household_name}</strong></td>
                <td class="guest-list">${guestNames}</td>
                <td>${invite.email || '—'}</td>
                <td>${statusBadge}</td>
                <td>${rsvpInfo}</td>
                <td>
                    <a href="${rsvpUrl}" target="_blank" class="action-link">View RSVP</a>
                    <a href="#" onclick="copyInviteLink('${invite.edit_token}'); return false;" class="action-link">Copy Link</a>
                    <a href="#" onclick="deleteInvite('${invite.id}'); return false;" class="action-link" style="color: #dc3545;">Delete</a>
                </td>
            </tr>
        `;
    }).join('');
}

// Update statistics
function updateStats(invites) {
    const total = invites.length;
    const submitted = invites.filter(i => i.submitted_at).length;
    
    let totalAttending = 0;
    let totalNotAttending = 0;
    
    invites.forEach(invite => {
        if (invite.guests) {
            totalAttending += invite.guests.filter(g => g.attending === true).length;
            totalNotAttending += invite.guests.filter(g => g.attending === false).length;
        }
    });

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-submitted').textContent = submitted;
    document.getElementById('stat-attending').textContent = totalAttending;
    document.getElementById('stat-not-attending').textContent = totalNotAttending;
}

// Filter table by search
function filterTable() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const filtered = allInvites.filter(invite => 
        invite.household_name.toLowerCase().includes(search) ||
        (invite.email && invite.email.toLowerCase().includes(search)) ||
        (invite.guests && invite.guests.some(g => 
            `${g.first_name} ${g.last_name}`.toLowerCase().includes(search)
        ))
    );
    renderInvites(filtered);
}

// Copy invite link
function copyInviteLink(token) {
    const url = `https://rainythorn.wedding/rsvp.html?token=${token}`;
    navigator.clipboard.writeText(url).then(() => {
        alert('RSVP link copied to clipboard!');
    }).catch(() => {
        prompt('Copy this link:', url);
    });
}

// Delete invite
async function deleteInvite(id) {
    if (!confirm('Are you sure you want to delete this invite? This will also delete all associated guests.')) {
        return;
    }

    const client = initSupabase();
    const { error } = await client
        .from('invites')
        .delete()
        .eq('id', id);

    if (error) {
        alert('Error deleting invite: ' + error.message);
        return;
    }

    loadInvites();
}

// Show/hide import modal
function showImportModal() {
    document.getElementById('import-modal').classList.add('active');
}

function hideImportModal() {
    document.getElementById('import-modal').classList.remove('active');
}

// Import CSV
async function importCSV() {
    const csvText = document.getElementById('csv-input').value.trim();
    
    if (!csvText) {
        alert('Please paste CSV data');
        return;
    }

    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Group by household
    const households = {};
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',').map(v => v.trim());
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index];
        });
        
        const householdName = row.household_name;
        if (!households[householdName]) {
            households[householdName] = {
                household_name: householdName,
                email: row.email,
                allows_plus_one: row.allows_plus_one === 'true',
                guests: []
            };
        }
        
        households[householdName].guests.push({
            first_name: row.first_name,
            last_name: row.last_name,
            is_child: row.is_child === 'true'
        });
    }

    // Insert into database
    const client = initSupabase();
    let successCount = 0;
    
    for (const household of Object.values(households)) {
        try {
            // Insert invite
            const { data: invite, error: inviteError } = await client
                .from('invites')
                .insert({
                    household_name: household.household_name,
                    email: household.email,
                    allows_plus_one: household.allows_plus_one
                })
                .select()
                .single();

            if (inviteError) throw inviteError;

            // Insert guests
            const guestsToInsert = household.guests.map(g => ({
                invite_id: invite.id,
                first_name: g.first_name,
                last_name: g.last_name,
                is_child: g.is_child
            }));

            const { error: guestsError } = await client
                .from('guests')
                .insert(guestsToInsert);

            if (guestsError) throw guestsError;

            successCount++;
        } catch (err) {
            console.error(`Error importing ${household.household_name}:`, err);
        }
    }

    alert(`Imported ${successCount} households successfully!`);
    hideImportModal();
    loadInvites();
}

// Send test invite
async function sendTestInvite() {
    const email = prompt('Enter your email to receive a test invitation:');
    if (!email) return;

    const client = initSupabase();
    
    try {
        const response = await client.functions.invoke('send-invitations', {
            body: {
                mode: 'test',
                test_email: email
            }
        });

        if (response.error) throw response.error;
        
        alert('Test invitation sent! Check your email.');
    } catch (err) {
        console.error('Error sending test:', err);
        alert('Error sending test invitation: ' + err.message);
    }
}

// Send all invitations
async function sendAllInvites() {
    const pending = allInvites.filter(i => !i.submitted_at).length;
    
    if (!confirm(`This will send email invitations to ${pending} households. Are you sure?`)) {
        return;
    }

    const client = initSupabase();
    
    try {
        const response = await client.functions.invoke('send-invitations', {
            body: {
                mode: 'all'
            }
        });

        if (response.error) throw response.error;
        
        const result = response.data;
        alert(`Sent ${result.sent} invitations successfully!\nFailed: ${result.failed}`);
        loadInvites();
    } catch (err) {
        console.error('Error sending invitations:', err);
        alert('Error sending invitations: ' + err.message);
    }
}

// Export to CSV
function exportCSV() {
    const rows = [['Household', 'Guests', 'Email', 'Submitted', 'Attending', 'Not Attending', 'RSVP Link']];
    
    allInvites.forEach(invite => {
        const guests = invite.guests || [];
        const guestNames = guests.map(g => `${g.first_name} ${g.last_name}`).join('; ');
        const attending = guests.filter(g => g.attending === true).length;
        const notAttending = guests.filter(g => g.attending === false).length;
        const submitted = invite.submitted_at ? 'Yes' : 'No';
        const rsvpUrl = `https://rainythorn.wedding/rsvp.html?token=${invite.edit_token}`;
        
        rows.push([
            invite.household_name,
            guestNames,
            invite.email || '',
            submitted,
            attending,
            notAttending,
            rsvpUrl
        ]);
    });

    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wedding-rsvps-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}
