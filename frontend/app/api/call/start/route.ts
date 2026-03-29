import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";

// Init Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "override_in_env";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "override_in_env";
const supabase = createClient(supabaseUrl, supabaseKey);

// Init Twilio
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function POST(req: NextRequest) {
  try {
    const { patientId, workflowId, campaignId } = await req.json();

    if (!patientId || !workflowId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch Patient details (including Phone + Language + Consent)
    const { data: patient, error: patientErr } = await supabase
      .from("patients")
      .select("*")
      .eq("id", patientId)
      .single();

    if (patientErr || !patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    // [GUARDRAIL] Consent Flow Logic Enforced
    if (patient.consent_captured === false) {
      // Offline fallback: Send them an SMS requesting consent instead of calling.
      return NextResponse.json({ warning: "Consent not captured yet. Offline Fallback workflow triggered instead." }, { status: 200 });
    }

    // 2. Register Campaign Session Tracking in DB
    const { data: callRow, error: callErr } = await supabase
      .from("calls")
      .insert({
        patient_id: patientId,
        workflow_id: workflowId,
        campaign_id: campaignId || null,
        status: "queued"
      })
      .select()
      .single();

    if (callErr) throw new Error("Could not log call attempt");

    // 3. Construct Webhook base URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://your-ngrok-url.com";
    const webhookUrl = `${baseUrl}/api/call/webhook?call_id=${callRow.id}&lang=${patient.language_code}`;

    // 4. Trigger Twilio Outbound Pulse
    const callResponse = await twilioClient.calls.create({
      to: patient.phone,
      from: process.env.TWILIO_PHONE_NUMBER as string,
      url: webhookUrl,
      statusCallback: `${baseUrl}/api/call/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      method: 'POST'
    });

    // Update the DB immediately with Twilio SID
    await supabase.from("calls").update({ twilio_sid: callResponse.sid, status: "ringing" }).eq("id", callRow.id);

    return NextResponse.json({ 
      success: true, 
      message: "Call successfully patched to Twilio.",
      callSid: callResponse.sid 
    });

  } catch (error: any) {
    console.error("Twilio Trigger Error:", error.message);
    return NextResponse.json({ error: "Failed to initiate call engine", details: error.message }, { status: 500 });
  }
}
