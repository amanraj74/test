import { NextRequest, NextResponse } from "next/server";
import { LLMRouter } from "@/lib/ai-router";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "override",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "override"
);

export async function POST(req: NextRequest) {
  try {
    const { callId } = await req.json();

    // 1. Fetch entire conversation transcript from Supabase
    const { data: transcripts, error: txError } = await supabase
      .from("transcripts")
      .select("text, role")
      .eq("call_id", callId)
      .order("timestamp", { ascending: true });

    if (txError || !transcripts?.length) return NextResponse.json({ error: "No transcripts found." }, { status: 404 });

    // 2. Extract strictly using Gemini fallback abstraction
    const extractedData = await LLMRouter.extractStructuredData(transcripts);

    // 3. ✨ SMART RISK ENGINE (Matrix Logic)
    let risk_score = 0;
    
    // Symptom Check
    const symptoms = extractedData.symptoms || [];
    if (symptoms.includes("chest pain") || symptoms.includes("chhati mein dard")) risk_score += 50;
    if (symptoms.includes("dizziness") || symptoms.includes("chakkar")) risk_score += 30;
    
    // Severity Weight multiplier
    const severityFactor = extractedData.severity === "high" ? 1.5 : (extractedData.severity === "medium" ? 1.0 : 0.5);
    risk_score = Math.min(100, Math.floor(risk_score * severityFactor));
    
    // Medication Adherence Penalty
    if (extractedData.medication_adherence === false) {
      risk_score += 20;
    }
    
    risk_score = Math.min(100, risk_score); // Cap at 100
    const risk_level = risk_score > 70 ? "high" : (risk_score > 30 ? "medium" : "low");

    // 4. Save Extracted Responses
    const { data: responseRow, error } = await supabase
      .from("responses")
      .insert({
        call_id: callId,
        extracted_data: extractedData,
        risk_score,
        risk_level
      })
      .select().single();

    if (error) throw new Error(error.message);

    // 5. ALERT TRIGGER (If high-risk, ping Doctor Dashboard)
    if (risk_level === "high" || extractedData.alerts?.length > 0) {
      await supabase.from("alerts").insert({
        call_id: callId,
        patient_id: extractedData.patient_id || null, // Best effort
        reason: extractedData.alerts?.join(", ") || "Critical Risk threshold crossed",
        is_acknowledged: false
      });
    }
    
    // Change call status to completed
    await supabase.from("calls").update({ status: "completed" }).eq("id", callId);

    return NextResponse.json({ success: true, risk_score, risk_level });

  } catch (error: any) {
    console.error("Extraction error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
