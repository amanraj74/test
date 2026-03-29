const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const WebSocket = require("ws");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev: true }); // Vercel Next App
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Twilio Media Streams -> WebSocket Listener
  const wss = new WebSocket.Server({ server, path: "/api/call/stream" });

  wss.on("connection", (ws, req) => {
    console.log("Client connected to Twilio Media Stream Socket");

    // In a real implementation:
    // 1. You receive base64 chunk parsing event 'media'
    // 2. Transmit to Sarvam STT (Audio -> Text)
    // 3. Route Text -> LLM Router (Groq/Gemini)
    // 4. Return Synthesized TTS base64 chunk (Sarvam TTS)
    // 5. Stream back to Twilio ws.send(...)

    ws.on("message", (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.event === "media") {
        // console.log(`Received Audio Payload: ${data.media.payload.slice(0, 10)}...`);
        // Here, integrate Sarvam API logic to translate speech stream chunks!
      }
    });

    ws.on("close", () => {
      console.log("Twilio Stream Disconnected. Triggering /api/extract locally...");
      // Trigger the extract pipeline automatically
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`🚀 VaaniCare Native WebSocket + Next.js Server Operational on port ${PORT}`);
  });
});
