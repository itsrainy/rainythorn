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
      font-family: Georgia, serif; 
      color: #5c4a3d; 
      line-height: 1.6; 
      max-width: 600px; 
      margin: 0 auto; 
      padding: 20px;
      background: #fefefe;
    }
    .header { 
      text-align: center; 
      padding: 40px 0; 
      border-bottom: 3px solid #d4c4b0; 
      margin-bottom: 30px; 
    }
    h1 { 
      font-family: 'Playfair Display', serif;
      color: #8b7355; 
      font-size: 32px; 
      margin: 0 0 10px 0;
    }
    .subtitle {
      color: #a89080;
      font-size: 18px;
      font-style: italic;
    }
    .content { 
      padding: 20px 0; 
    }
    .details-box {
      background: #f5e6d3;
      padding: 25px;
      border-radius: 8px;
      margin: 25px 0;
      border-left: 4px solid #8b7355;
    }
    .event {
      margin: 15px 0;
    }
    .event-title {
      font-weight: bold;
      color: #8b7355;
      font-size: 18px;
    }
    .rsvp-button { 
      display: inline-block; 
      background: #8b7355; 
      color: white !important; 
      padding: 16px 40px; 
      text-decoration: none; 
      border-radius: 6px; 
      margin: 30px 0;
      font-size: 18px;
      font-weight: 500;
    }
    .rsvp-button:hover {
      background: #6f5a44;
    }
    .footer { 
      border-top: 3px solid #d4c4b0; 
      padding-top: 20px; 
      margin-top: 40px; 
      font-size: 14px; 
      color: #888; 
      text-align: center;
    }
    .note {
      background: #fff9f0;
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
      font-size: 14px;
      border: 1px solid #f0e6d8;
    }
  </style>
</head>
<body>
  <div class="header">
    <p class="subtitle">You're Invited to Celebrate</p>
    <h1>Rainy & Thorn</h1>
  </div>

  <div class="content">
    <p>Dear ${invite.household_name},</p>

    <p>We're thrilled to invite you to our wedding celebration in Pittsburgh!</p>

    <div class="details-box">
      <div class="event">
        <div class="event-title">Welcome Party</div>
        <p style="margin: 5px 0;">Thursday, May 22nd, 2026 at 6:00 PM<br>
        Trace Brewing, Pittsburgh</p>
      </div>

      <div class="event">
        <div class="event-title">Wedding Ceremony & Reception</div>
        <p style="margin: 5px 0;">Friday, May 23rd, 2026 at 4:00 PM<br>
        Riverview Park, Pittsburgh</p>
      </div>
    </div>

    <p style="text-align: center;">
      <a href="${rsvpUrl}" class="rsvp-button">RSVP Now</a>
    </p>

    <div class="note">
      <strong>📝 Please RSVP by April 23rd, 2026</strong><br>
      Your unique RSVP link above will take you to a form pre-filled with your party: ${guestNames}
      <br><br>
      You can update your response anytime using the same link.
    </div>

    <p>Visit our website for more details about the venue, accommodations, and ways to celebrate with us:</p>
    <p style="text-align: center;">
      <a href="https://rainythorn.wedding" style="color: #8b7355;">rainythorn.wedding</a>
    </p>

    <p>We can't wait to see you there!</p>

    <p>With love,<br>
    <strong>Rainy & Thorn</strong></p>
  </div>

  <div class="footer">
    <p>May 23rd, 2026 | Pittsburgh, PA</p>
    <p style="font-size: 12px; margin-top: 10px;">
      Questions? Reply to this email or visit our website.
    </p>
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
