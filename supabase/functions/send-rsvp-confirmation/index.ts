import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FROM_EMAIL = "Rainy & Thorn <noreply@rainythorn.wedding>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Guest {
  first_name: string;
  last_name: string;
  attending: boolean | null;
  dietary_restrictions: string | null;
  is_child: boolean;
}

interface RSVPData {
  household_name: string;
  email: string;
  edit_token: string;
  guests: Guest[];
  welcome_party: boolean;
  wedding: boolean;
  plus_one_name?: string;
  plus_one_dietary?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const data: RSVPData = await req.json();

    if (!data.edit_token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate the token exists and get the actual email from the database
    // This prevents someone from using the anon key to spam arbitrary emails
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select("email, household_name")
      .eq("edit_token", data.edit_token)
      .single();

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use the email from the database, not the request (security)
    const recipientEmail = invite.email;

    if (!recipientEmail || recipientEmail.startsWith('NEEDS_EMAIL')) {
      return new Response(
        JSON.stringify({ error: "No valid email for this invite" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build guest list HTML
    const attendingGuests = data.guests.filter(g => g.attending === true);
    const notAttendingGuests = data.guests.filter(g => g.attending === false);

    let guestListHtml = "";

    if (attendingGuests.length > 0) {
      for (const guest of attendingGuests) {
        const dietary = guest.dietary_restrictions ? ` · ${guest.dietary_restrictions}` : "";
        guestListHtml += `${guest.first_name} ${guest.last_name}${dietary}<br>`;
      }
    }

    if (notAttendingGuests.length > 0) {
      for (const guest of notAttendingGuests) {
        guestListHtml += `<span style="color: #a89080;">${guest.first_name} ${guest.last_name} (Unable to attend)</span><br>`;
      }
    }

    // Plus one
    if (data.plus_one_name) {
      const dietary = data.plus_one_dietary ? ` · ${data.plus_one_dietary}` : "";
      guestListHtml += `${data.plus_one_name}${dietary}<br>`;
    }

    // Events attending
    let eventsHtml = "";
    if (data.welcome_party && data.wedding) {
      eventsHtml = "Welcome Party & Wedding";
    } else if (data.welcome_party) {
      eventsHtml = "Welcome Party Only";
    } else if (data.wedding) {
      eventsHtml = "Wedding Only";
    }

    const editUrl = `https://rainythorn.wedding/rsvp.html?token=${data.edit_token}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { 
      font-family: Georgia, 'Times New Roman', serif; 
      color: #5c4a3d; 
      line-height: 1.8; 
      max-width: 500px; 
      margin: 0 auto; 
      padding: 40px 20px;
      background: #fefefe;
      text-align: center;
    }
    .confirmation {
      padding: 20px 0;
    }
    .preheader {
      font-size: 14px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #a89080;
      margin-bottom: 8px;
    }
    .title { 
      font-size: 28px; 
      color: #6b5b4f;
      margin: 0 0 30px 0;
      font-weight: normal;
    }
    .divider {
      margin: 30px 0;
      font-size: 16px;
      letter-spacing: 3px;
      color: #7a8471;
    }
    .section {
      margin: 35px 0;
    }
    .section-label {
      font-size: 13px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #8b7355;
      margin-bottom: 12px;
    }
    .section-content {
      font-size: 16px;
      color: #5c4a3d;
      line-height: 1.7;
    }
    .edit-button { 
      display: inline-block; 
      background: #8b7355; 
      color: white !important; 
      padding: 14px 50px; 
      text-decoration: none; 
      font-size: 13px;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin: 35px 0;
    }
    .footer {
      margin-top: 40px;
      padding-top: 30px;
      border-top: 1px solid #e8e0d8;
      font-size: 13px;
      color: #a89080;
      line-height: 2;
    }
    .footer a {
      color: #8b7355;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="confirmation">
    <p class="preheader">RSVP Confirmed</p>
    <h1 class="title">Thank You!</h1>
    <p class="divider">─── ◇ ───</p>
    
    <div class="section">
      <p class="section-label">Your Party</p>
      <p class="section-content">
        ${guestListHtml}
      </p>
    </div>
    
    ${eventsHtml ? `
    <div class="section">
      <p class="section-label">Attending</p>
      <p class="section-content">${eventsHtml}</p>
    </div>
    ` : ''}
    
    <p style="font-size: 14px; color: #a89080; margin: 30px 0;">
      Need to make changes?<br>
      You can update your RSVP anytime before April 23rd.
    </p>
    
    <a href="${editUrl}" class="edit-button">Edit RSVP</a>
    
    <div class="footer">
      <p>We can't wait to celebrate with you!</p>
      <p>Rainy & Thorn</p>
      <p><a href="https://rainythorn.wedding">rainythorn.wedding</a></p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [recipientEmail],
        subject: "RSVP Confirmed - Rainy & Thorn's Wedding",
        html: htmlBody,
      }),
    });

    const resendData = await res.json();

    if (!res.ok) {
      console.error("Resend error:", resendData);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: resendData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, messageId: resendData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
