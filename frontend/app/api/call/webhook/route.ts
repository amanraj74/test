import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Twilio sends url-encoded data with CallSid, From, To, etc. 
    // And any Custom Parameters we appended to the Webhook URL (like call_id and lang).
    const parsedUrl = new URL(req.url);
    const callId = parsedUrl.searchParams.get("call_id") || "test_id";
    const languageCode = parsedUrl.searchParams.get("lang") || "hi-IN";

    // Host domain logic
    const host = process.env.NEXT_PUBLIC_BASE_URL || `https://${req.headers.get("host") || "localhost:3000"}`;
    // Replace http:// with wss://
    const wssHost = host.replace("http://", "ws://").replace("https://", "wss://");
    const streamUrl = `${wssHost}/api/call/stream?call_id=${callId}&lang=${languageCode}`;

    // Generate strict TwiML XML instructing Twilio to open a bi-directional Media Stream Websocket
    const twiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="en-IN" voice="Polly.Aditi">Connecting you to VaaniCare AI.</Say>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="call_id" value="${callId}" />
      <Parameter name="language_code" value="${languageCode}" />
    </Stream>
  </Connect>
  <Pause length="120" />
</Response>`;

    return new NextResponse(twiML, {
      status: 200,
      headers: { "Content-Type": "text/xml" }
    });

  } catch (err: any) {
    console.error("Webhook Error:", err);
    return new NextResponse("Webhook error block triggered.", { status: 500 });
  }
}
