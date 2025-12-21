import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FROM_EMAIL = "Rainy & Thorn <invites@rainythorn.wedding>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendInvitationsRequest {
  mode: "test" | "all";  // test sends to one household, all sends to everyone
  test_email?: string;   // override email for test mode
  household_ids?: string[];  // optional: send to specific households only
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { mode, test_email, household_ids }: SendInvitationsRequest = await req.json();

    // Initialize Supabase with service key (admin access)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Build query
    let query = supabase
      .from("invites")
      .select(`
        id,
        household_name,
        email,
        edit_token,
        submitted_at,
        guests:guests(first_name, last_name)
      `)
      .order("household_name");

    // Filter by household IDs if provided
    if (household_ids && household_ids.length > 0) {
      query = query.in("id", household_ids);
    }

    // For test mode, only get one invite
    if (mode === "test") {
      query = query.limit(1);
    } else {
      // For production, only send to those who haven't been invited yet
      query = query.is("submitted_at", null);
    }

    const { data: invites, error } = await query;

    if (error) {
      throw error;
    }

    if (!invites || invites.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No invites to send",
          sent: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Send email to each household
    for (const invite of invites) {
      try {
        const guestNames = invite.guests
          .map((g: any) => `${g.first_name} ${g.last_name}`)
          .join(", ");

        const rsvpUrl = `https://rainythorn.wedding/rsvp.html?token=${invite.edit_token}`;
        
        // Use test email in test mode
        const recipientEmail = mode === "test" && test_email 
          ? test_email 
          : invite.email || "noreply@rainythorn.wedding";

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
    .invitation {
      padding: 20px 0;
    }
    .preheader {
      font-size: 14px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #a89080;
      margin-bottom: 8px;
    }
    .names { 
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
    .event {
      margin: 35px 0;
    }
    .event-name {
      font-size: 13px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #8b7355;
      margin-bottom: 12px;
    }
    .event-details {
      font-size: 16px;
      color: #5c4a3d;
      margin: 0;
      line-height: 1.7;
    }
    .event-note {
      font-size: 14px;
      font-style: italic;
      color: #a89080;
      margin-top: 8px;
    }
    .rsvp-button { 
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
  <div class="invitation">
    <p class="preheader">You're Invited</p>
    <h1 class="names">Rainy Sinclair & Thorn Harteau</h1>
    <p class="divider">─── ◇ ───</p>
    <div class="event">
      <p class="event-name">Welcome Party</p>
      <p class="event-details">
        Thursday, May 22nd, 2026<br>
        6:00 – 9:00 PM<br>
        Trace Brewing, Pittsburgh
      </p>
      <p class="event-note">Food truck & cash bar</p>
    </div>
    
    <div class="event">
      <p class="event-name">Wedding Ceremony & Reception</p>
      <p class="event-details">
        Friday, May 23rd, 2026<br>
        Ceremony at 3:00 PM<br>
        Riverview Park, Pittsburgh
      </p>
      <p class="event-note">Dinner & celebration to follow</p>
    </div>
    
    <a href="${rsvpUrl}" class="rsvp-button">RSVP</a>
    
    <div class="footer">
      <p>Please respond by April 23rd, 2026</p>
      <p><a href="https://rainythorn.wedding">rainythorn.wedding</a></p>
    </div>
  </div>
</body>
</html>
        `;

        // Send via Resend
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [recipientEmail],
            subject: mode === "test" 
              ? "[TEST] You're Invited - Rainy & Thorn's Wedding"
              : "You're Invited - Rainy & Thorn's Wedding",
            html: htmlBody,
          }),
        });

        const resendData = await res.json();

        if (!res.ok) {
          throw new Error(`Resend error: ${JSON.stringify(resendData)}`);
        }

        results.push({
          household: invite.household_name,
          email: recipientEmail,
          success: true,
          messageId: resendData.id,
        });
        successCount++;

      } catch (emailError: any) {
        console.error(`Failed to send to ${invite.household_name}:`, emailError);
        results.push({
          household: invite.household_name,
          email: invite.email,
          success: false,
          error: emailError.message,
        });
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        sent: successCount,
        failed: errorCount,
        results,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
