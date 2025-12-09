import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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

    if (!data.email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build guest list HTML
    const attendingGuests = data.guests.filter(g => g.attending === true);
    const notAttendingGuests = data.guests.filter(g => g.attending === false);

    let guestListHtml = "";

    if (attendingGuests.length > 0) {
      guestListHtml += `<p><strong>Attending:</strong></p><ul>`;
      for (const guest of attendingGuests) {
        const dietary = guest.dietary_restrictions ? ` (${guest.dietary_restrictions})` : "";
        guestListHtml += `<li>${guest.first_name} ${guest.last_name}${dietary}</li>`;
      }
      guestListHtml += `</ul>`;
    }

    if (notAttendingGuests.length > 0) {
      guestListHtml += `<p><strong>Unable to attend:</strong></p><ul>`;
      for (const guest of notAttendingGuests) {
        guestListHtml += `<li>${guest.first_name} ${guest.last_name}</li>`;
      }
      guestListHtml += `</ul>`;
    }

    // Plus one
    if (data.plus_one_name) {
      const dietary = data.plus_one_dietary ? ` (${data.plus_one_dietary})` : "";
      guestListHtml += `<p><strong>Additional guest:</strong> ${data.plus_one_name}${dietary}</p>`;
    }

    // Events
    const events: string[] = [];
    if (data.welcome_party) events.push("Welcome Party (May 22nd)");
    if (data.wedding) events.push("Wedding Ceremony & Reception (May 23rd)");

    const eventsHtml = events.length > 0
      ? `<p><strong>Events:</strong> ${events.join(", ")}</p>`
      : "";

    const editUrl = `https://rainythorn.wedding/rsvp.html?token=${data.edit_token}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Georgia, serif; color: #5c4a3d; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #8b7355; font-size: 24px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #d4c4b0; margin-bottom: 20px; }
    .content { padding: 20px 0; }
    .events { background: #f5e6d3; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .edit-link { display: inline-block; background: #8b7355; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { border-top: 2px solid #d4c4b0; padding-top: 20px; margin-top: 30px; font-size: 14px; color: #888; }
    ul { margin: 10px 0; padding-left: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>RSVP Confirmed</h1>
    <p>Rainy & Thorn's Wedding</p>
  </div>

  <div class="content">
    <p>Dear ${data.household_name},</p>

    <p>Thank you for your RSVP! Here's a summary of your response:</p>

    ${guestListHtml}

    <div class="events">
      ${eventsHtml}
    </div>

    <p>Need to make changes? You can update your response anytime before <strong>April 23, 2026</strong>:</p>

    <a href="${editUrl}" class="edit-link">Edit Your RSVP</a>

    <p>We can't wait to celebrate with you!</p>

    <p>With love,<br>Rainy & Thorn</p>
  </div>

  <div class="footer">
    <p>May 23rd, 2026 | Pittsburgh, PA</p>
    <p><a href="https://rainythorn.wedding">rainythorn.wedding</a></p>
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
        to: [data.email],
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
