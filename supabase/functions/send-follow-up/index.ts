import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FROM_EMAIL = "Rainy & Thorn <invites@rainythorn.wedding>";
const REPLY_TO_EMAIL = "invites@rainythorn.wedding";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendFollowUpRequest {
  mode: "test" | "all";
  test_email?: string;
  household_ids?: string[];
}

// Shared email styles matching the invitation aesthetic
const emailStyles = `
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
    .email-wrap {
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
    .section-content a {
      color: #8b7355;
      text-decoration: underline;
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
    .lodging-link {
      display: block;
      margin: 20px 0;
    }
    .lodging-link a {
      color: #8b7355;
      text-decoration: underline;
      font-size: 16px;
    }
    .lodging-link .lodging-note {
      font-size: 13px;
      color: #a89080;
      margin-top: 4px;
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
    .guest-status {
      font-size: 15px;
      color: #5c4a3d;
      line-height: 1.8;
    }
    .attending-yes {
      color: #5a7a52;
    }
    .attending-no {
      color: #a89080;
    }
`;

function buildRsvpReminderSection(rsvpUrl: string): string {
  return `
    <div class="section">
      <p class="section-label">RSVP Reminder</p>
      <p class="section-content">
        We'd love to know if you can make it!<br>
        Please let us know by <strong>April 23rd, 2026</strong>.
      </p>
      <a href="${rsvpUrl}" class="rsvp-button">RSVP Now</a>
    </div>
  `;
}

function buildRsvpConfirmationSection(
  invite: any,
  guests: any[],
  rsvpUrl: string
): string {
  const attendingGuests = guests.filter((g: any) => g.attending === true);
  const notAttendingGuests = guests.filter((g: any) => g.attending === false);

  let guestListHtml = "";

  for (const guest of attendingGuests) {
    guestListHtml += `<span class="attending-yes">✓ ${guest.first_name} ${guest.last_name}</span><br>`;
  }
  for (const guest of notAttendingGuests) {
    guestListHtml += `<span class="attending-no">${guest.first_name} ${guest.last_name} – unable to attend</span><br>`;
  }
  if (invite.plus_one_name) {
    guestListHtml += `<span class="attending-yes">✓ ${invite.plus_one_name} (+1)</span><br>`;
  }

  // Events
  let eventsHtml = "";
  if (invite.welcome_party && invite.wedding) {
    eventsHtml = "Welcome Party & Wedding";
  } else if (invite.welcome_party) {
    eventsHtml = "Welcome Party";
  } else if (invite.wedding) {
    eventsHtml = "Wedding";
  }

  return `
    <div class="section">
      <p class="section-label">Your RSVP</p>
      <div class="guest-status">
        ${guestListHtml}
      </div>
      ${eventsHtml ? `<p style="font-size: 14px; color: #a89080; margin-top: 10px;">Events: ${eventsHtml}</p>` : ""}
      <p style="font-size: 14px; color: #a89080; margin-top: 15px;">
        Need to make changes? You can update your RSVP anytime before April 23rd.
      </p>
      <a href="${rsvpUrl}" class="edit-button">Manage RSVP</a>
    </div>
  `;
}

function buildLodgingSection(): string {
  const trypLink =
    "https://www.wyndhamhotels.com/tryp/pittsburgh-pennsylvania/tryp-by-wyndham-pittsburgh-lawrenceville/rooms-rates?brand_id=WT&checkInDate=5/22/2026&checkOutDate=5/24/2026&children=0&groupCode=052126HAR&adults=1&rooms=1";
  const airbnbLink =
    "https://www.airbnb.com/s/Pittsburgh--PA/homes?checkin=2026-05-22&checkout=2026-05-24&adults=2";
  const hotelsLink =
    "https://www.google.com/travel/hotels/Lawrenceville+Pittsburgh+PA?q=hotels+near+lawrenceville+pittsburgh&g2lb=4814050&hl=en-US&gl=us&un=1&ap=MABoAQ&dates=2026-05-22_2026-05-24";
  return `
    <div class="section">
      <p class="section-label">Lodging</p>
      <p class="section-content">
        Coming from out of town? Here are some options
        for the weekend of the wedding.
      </p>

      <div class="lodging-link">
        <a href="${trypLink}">TRYP by Wyndham Lawrenceville</a>
        <p class="lodging-note">We have a small block of rooms reserved for May 22&ndash;24</p>
      </div>

      <div class="lodging-link">
        <a href="${airbnbLink}">Airbnb</a>
        <p class="lodging-note">Plenty of options in Lawrenceville, Bloomfield &amp; beyond</p>
      </div>

      <div class="lodging-link">
        <a href="${hotelsLink}">Other Hotels</a>
        <p class="lodging-note">More options nearby</p>
      </div>
    </div>
  `;
}

function getGreetingName(invite: any): string {
  const guests = invite.guests || [];
  const firstNames = guests.map((g: any) => g.first_name);
  if (firstNames.length === 0) return "";
  if (firstNames.length === 1) return firstNames[0];
  if (firstNames.length === 2) return `${firstNames[0]} & ${firstNames[1]}`;
  return `${firstNames[0]}, ${firstNames.slice(1, -1).join(", ")} & ${firstNames[firstNames.length - 1]}`;
}

function buildFollowUpEmail(
  invite: any,
  hasRsvpd: boolean,
  rsvpUrl: string
): string {
  const rsvpSection = hasRsvpd
    ? buildRsvpConfirmationSection(invite, invite.guests, rsvpUrl)
    : buildRsvpReminderSection(rsvpUrl);

  const greeting = getGreetingName(invite);
  const greetingLine = greeting ? `Dear ${greeting},` : "";
  const introText = hasRsvpd
    ? `Thank you for RSVPing! We're so excited to celebrate with you.<br>Here are a few details to help you plan.`
    : `We're getting excited as the big day draws near!`;

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    ${emailStyles}
  </style>
</head>
<body>
  <div class="email-wrap">
    <p class="preheader">A Quick Update</p>
    <h1 class="title">Rainy & Thorn</h1>
    <p class="divider">─── ◇ ───</p>

    <div class="section">
      ${greetingLine ? `<p class="section-content" style="font-size: 18px; margin-bottom: 15px;">${greetingLine}</p>` : ""}
      <p class="section-content">
        ${introText}
      </p>
    </div>

    ${rsvpSection}

    ${hasRsvpd ? `
    <p class="divider">─── ◇ ───</p>

    ${buildLodgingSection()}
    ` : ""}

    <p class="divider">─── ◇ ───</p>

    <div class="section">
      <p class="section-label">Questions?</p>
      <p class="section-content" style="font-size: 15px;">
        Just reply to this email — we're happy to help!
      </p>
    </div>

    <div class="footer">
      <p>With love,</p>
      <p>Rainy & Thorn</p>
      <p><a href="https://rainythorn.wedding">rainythorn.wedding</a></p>
    </div>
  </div>
</body>
</html>
  `;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller has the service role key (admin only)
    const authHeader = req.headers.get("authorization") || "";
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";

    let isServiceRole = false;
    if (bearerToken) {
      try {
        const payloadBase64 = bearerToken.split(".")[1];
        const payload = JSON.parse(atob(payloadBase64));
        isServiceRole = payload.role === "service_role";
      } catch (e) {
        console.log("Failed to parse JWT:", e);
      }
    }

    if (!isServiceRole) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - admin access required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { mode, test_email, household_ids }: SendFollowUpRequest =
      await req.json();

    // SAFETY: In test mode, test_email is required — refuse to proceed without it
    if (mode === "test" && !test_email) {
      return new Response(
        JSON.stringify({ error: "test_email is required in test mode" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch all invites with guests
    let query = supabase
      .from("invites")
      .select(
        `
        id,
        household_name,
        email,
        edit_token,
        invited_at,
        submitted_at,
        welcome_party,
        wedding,
        plus_one_name,
        plus_one_dietary,
        guests:guests(first_name, last_name, attending, dietary_restrictions, is_child)
      `
      )
      .order("household_name");

    // Filter by household IDs if provided
    if (household_ids && household_ids.length > 0) {
      query = query.in("id", household_ids);
    }

    // For test mode, get two invites: one that has RSVPd and one that hasn't,
    // so both email variants can be previewed
    if (mode === "test") {
      query = query.limit(20);
    }

    const { data: invites, error } = await query;

    if (error) {
      throw error;
    }

    if (!invites || invites.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No invites found",
          sent: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter logic:
    // 1. Must have a valid email
    // 2. Exclude households where everyone RSVPd "no" (submitted but no one attending)
    const eligibleInvites = invites.filter((invite) => {
      // Must have valid email
      if (!invite.email || invite.email.startsWith("NEEDS_EMAIL")) {
        return false;
      }

      // If they've RSVPd, check if everyone declined
      if (invite.submitted_at) {
        const anyoneAttending =
          invite.guests?.some((g: any) => g.attending === true) ||
          !!invite.plus_one_name;
        // Skip if everyone declined
        if (!anyoneAttending) {
          return false;
        }
      }

      return true;
    });

    // In test mode, pick one RSVPd invite and one non-RSVPd invite
    // so you can preview both email variants
    let invitesToSend = eligibleInvites;
    if (mode === "test") {
      const rsvpd = eligibleInvites.find((i: any) => i.submitted_at);
      const notRsvpd = eligibleInvites.find((i: any) => !i.submitted_at);
      invitesToSend = [rsvpd, notRsvpd].filter(Boolean) as any[];
    }

    if (invitesToSend.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No eligible invites to send follow-up to",
          sent: 0,
          skipped: invites.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];
    let successCount = 0;
    let errorCount = 0;
    let skippedDeclined = 0;

    // Rate limit helper
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    for (const invite of invitesToSend) {
      try {
        const rsvpUrl = `https://rainythorn.wedding/rsvp.html?token=${invite.edit_token}`;
        const hasRsvpd = !!invite.submitted_at;

        // SAFETY: In test mode, ALWAYS send to test_email, never to real guests
        let recipientEmail: string;
        if (mode === "test") {
          // test_email is guaranteed non-null here (validated above)
          recipientEmail = test_email!;
        } else {
          recipientEmail = invite.email || "noreply@rainythorn.wedding";
        }

        const htmlBody = buildFollowUpEmail(invite, hasRsvpd, rsvpUrl);

        const subjectLine = hasRsvpd
          ? "Rainy & Thorn Wedding: RSVP and Lodging"
          : "Reminder to RSVP";

        // Send via Resend
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [recipientEmail],
            reply_to: REPLY_TO_EMAIL,
            subject:
              mode === "test"
                ? `[TEST] ${subjectLine}`
                : subjectLine,
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
          hasRsvpd,
          messageId: resendData.id,
        });
        successCount++;

        // Mark follow-up as sent (skip in test mode)
        if (mode !== "test") {
          await supabase
            .from("invites")
            .update({ follow_up_sent_at: new Date().toISOString() })
            .eq("id", invite.id);
        }

        // Rate limit: wait 600ms between sends
        await delay(600);
      } catch (emailError: any) {
        console.error(
          `Failed to send to ${invite.household_name}:`,
          emailError
        );
        results.push({
          household: invite.household_name,
          email: invite.email,
          success: false,
          error: emailError.message,
        });
        errorCount++;
      }
    }

    // Count declined that were skipped
    skippedDeclined = invites.filter((invite) => {
      if (!invite.submitted_at) return false;
      const anyoneAttending =
        invite.guests?.some((g: any) => g.attending === true) ||
        !!invite.plus_one_name;
      return !anyoneAttending;
    }).length;

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        sent: successCount,
        failed: errorCount,
        skippedDeclined,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
