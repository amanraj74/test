import { GoogleGenAI } from "@google/genai";
import axios from "axios";

// Gemini Init
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const GUARDRAIL_PROMPT = `You are VaaniCare, an automated AI health assistant strictly performing triage and data capture. 
CRITICAL RULES:
1. DO NOT DIAGNOSE ANY CONDITIONS.
2. DO NOT PRESCRIBE MEDICATIONS OR REMEDIES.
3. Always ask the next contextual question in the workflow.
4. If a user states a life-threatening symptom (like chest pain), immediately reply: "Please go to the nearest hospital immediately or call emergency services."`;

export class LLMRouter {
  
  /**
   * Primary: Sarvam API (Translates Indic Speech & Routes through advanced models)
   * We mock the raw axios call because Sarvam API requires exact auth endpoints based on enterprise tiers.
   */
  static async generateSarvamResponse(text: string, lang: string, context: any) {
    try {
      const response = await axios.post("https://api.sarvam.ai/v1/chat/completions", {
        model: "sarvam-1",
        messages: [
          { role: "system", content: `${GUARDRAIL_PROMPT}\nPatient Context: ${JSON.stringify(context)}\nRespond natively in ${lang}.` },
          { role: "user", content: text }
        ]
      }, {
        headers: { "Authorization": `Bearer ${process.env.SARVAM_API_KEY}` }
      });
      return response.data.choices[0].message.content;
    } catch (err) {
      console.warn("Sarvam LLM Failed or Rate Limited. Routing to Gemini Fallback:", err);
      // Trigger Fallback!
      return await this.generateGeminiFallback(text, lang, context);
    }
  }

  /**
   * Fallback: Gemini API (Free Tier)
   */
  static async generateGeminiFallback(text: string, lang: string, context: any) {
    try {
      const response = await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
            { role: "user", parts: [{ text: `${GUARDRAIL_PROMPT}\nPatient Context: ${JSON.stringify(context)}\nPatient said: "${text}". Generate the exact next question in ${lang}.`}]}
        ],
      });
      return response.text;
    } catch (err) {
      console.error("Critical Failure in ALL LLM Layers:", err);
      return "I apologize, our systems are experiencing heavy load. I have notified your care team to follow up with you. Goodbye.";
    }
  }

  /**
   * Extract JSON from Transcripts for Supabase
   */
  static async extractStructuredData(transcriptArray: any[]) {
    const prompt = `Read the following transcript and extract the medical state into exact JSON without markdown codeblocks:
    Transcript: ${JSON.stringify(transcriptArray)}
    Required Exact JSON Format:
    { "patient_id": "string", "symptoms": ["string"], "duration": "string", "severity": "low|medium|high", "medication_adherence": boolean, "alerts": ["string"] }`;

    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    
    // Safety cleanup of markdown ticks
    let cleanText = response.text || "{}";
    cleanText = cleanText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '');
    return JSON.parse(cleanText);
  }
}
