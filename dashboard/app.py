import streamlit as st
import sys
import os
import pandas as pd
from datetime import date, datetime
import asyncio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.supabase_client import (
    get_client,
    get_all_patients,
    get_dashboard_stats,
    get_unacknowledged_alerts,
)
from backend.nlp_extractor import extract_clinical_entities
from backend.action_engine import determine_urgency, calculate_cost

# Create supabase instance locally
supabase_client = get_client()

# ── Page Config ────────────────────────────────────────────
st.set_page_config(
    page_title="VaaniCare 2.0",
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── CSS ────────────────────────────────────────────────────
st.markdown("""
<style>
    .metric-card { background:#f8f9fa; border-radius:8px; padding:16px; border-left:4px solid #01696f; }
    .critical { border-left-color:#dc3545 !important; }
    .high { border-left-color:#fd7e14 !important; }
    .moderate { border-left-color:#ffc107 !important; }
    .stButton>button { background:#01696f; color:white; border:none; border-radius:6px; }
    .stButton>button:hover { background:#0c4e54; }
</style>
""", unsafe_allow_html=True)

# ── Sidebar ────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## 🏥 VaaniCare 2.0")
    st.markdown("*AI Voice Follow-up for Rural Health*")
    st.divider()
    page = st.radio("Navigation", [
        "📊 Dashboard",
        "👥 Patients",
        "📞 Demo Call",
        "🎙️ Voice Intake",
        "🏥 Admission Follow-up",
        "🔔 Alerts",
        "💰 Cost Analysis",
    ])
    st.divider()
    st.caption("Hackmatrix 2.0 @ IIT Patna")
    st.caption("Track: PS-3 Indic Voice AI")

# ── Dashboard Page ─────────────────────────────────────────
if page == "📊 Dashboard":
    st.title("📊 VaaniCare Dashboard")
    st.caption(f"Last updated: {datetime.now().strftime('%d %b %Y, %I:%M %p')}")

    stats = get_dashboard_stats()
    patients = get_all_patients()

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Total Patients", stats.get("total_patients", 0), help="Active patients in system")
    with col2:
        st.metric("Calls Today", stats.get("calls_today", 0), help="Demo calls triggered today")
    with col3:
        st.metric("Pending Alerts", stats.get("pending_alerts", 0), help="Unacknowledged doctor alerts")
    with col4:
        risk = stats.get("risk_breakdown", {})
        critical = risk.get("CRITICAL", 0) + risk.get("HIGH", 0)
        st.metric("High Risk Patients", critical, delta=f"{critical} need calls", delta_color="inverse")

    st.divider()

    col_left, col_right = st.columns([2, 1])

    with col_left:
        st.subheader("Patient Risk Distribution")
        if patients:
            df = pd.DataFrame(patients)
            df = df[["name", "risk_tier", "risk_score", "condition", "district"]].copy()
            df["risk_score"] = df["risk_score"].round(2)
            df["condition"] = df["condition"].apply(lambda x: ", ".join(x) if x else "—")

            def color_risk(val):
                colors = {"CRITICAL": "background-color:#ffe0e0", "HIGH": "background-color:#fff3cd",
                          "MODERATE": "background-color:#fff9c4", "LOW": "background-color:#e8f5e9"}
                return colors.get(val, "")

            # Fix 3: Updated to .map from .applymap
            st.dataframe(
                df.style.map(color_risk, subset=["risk_tier"]),
                use_container_width=True,
                height=350
            )

    with col_right:
        st.subheader("Risk Breakdown")
        risk = stats.get("risk_breakdown", {})
        for tier, count in [("CRITICAL", risk.get("CRITICAL",0)), ("HIGH", risk.get("HIGH",0)),
                             ("MODERATE", risk.get("MODERATE",0)), ("LOW", risk.get("LOW",0))]:
            color = {"CRITICAL":"🔴","HIGH":"🟠","MODERATE":"🟡","LOW":"🟢"}[tier]
            st.metric(f"{color} {tier}", count)

# ── Patients Page ──────────────────────────────────────────
elif page == "👥 Patients":
    st.title("👥 Patient Management")
    patients = get_all_patients()

    if patients:
        df = pd.DataFrame(patients)
        st.write(f"**{len(patients)} active patients**")

        risk_filter = st.multiselect("Filter by Risk", ["CRITICAL","HIGH","MODERATE","LOW"],
                                      default=["CRITICAL","HIGH"])
        if risk_filter:
            df = df[df["risk_tier"].isin(risk_filter)]

        for _, row in df.iterrows():
            risk_emoji = {"CRITICAL":"🔴","HIGH":"🟠","MODERATE":"🟡","LOW":"🟢"}.get(row["risk_tier"],"⚪")
            with st.expander(f"{risk_emoji} {row['name']} — {row['risk_tier']} (Score: {row['risk_score']:.2f})"):
                c1, c2, c3 = st.columns(3)
                c1.write(f"**Phone:** {row.get('phone','—')}")
                c1.write(f"**Age:** {row.get('age','—')}")
                c2.write(f"**Condition:** {', '.join(row.get('condition',[]) or [])}")
                c2.write(f"**District:** {row.get('district','—')}")
                c3.write(f"**HbA1c:** {row.get('hba1c','—')}")
                c3.write(f"**BP:** {row.get('systolic_bp','—')}/{row.get('diastolic_bp','—')}")

# ── Demo Call Page ─────────────────────────────────────────
elif page == "📞 Demo Call":
    st.title("📞 Live Demo Call")
    st.info("🎙️ This simulates a real VaaniCare AI call — shows Hindi STT → Groq NLP → Doctor Alert pipeline")

    patients = get_all_patients()
    if not patients:
        st.error("No patients found. Run seed.py first.")
    else:
        patient_names = {p["name"]: p for p in patients}
        selected_name = st.selectbox("Select Patient", list(patient_names.keys()))
        patient = patient_names[selected_name]

        col1, col2 = st.columns(2)
        col1.metric("Risk Tier", patient["risk_tier"])
        col2.metric("Risk Score", f"{patient['risk_score']:.2f}")

        st.subheader("Demo Patient Response (Hindi)")
        demo_transcript = st.text_area(
            "Patient says (edit to test different scenarios):",
            value=f"Haan ji, main {patient['name']} bol raha hoon. Maine 2 din se dawai nahi li. Thoda seena bhari sa lag raha hai aur blood sugar 220 hai.",
            height=100
        )

        if st.button("🚀 Run Demo Call Pipeline", type="primary"):
            with st.spinner("Running AI pipeline..."):
                col_a, col_b, col_c = st.columns(3)
                col_a.info("✅ Sarvam STT Complete")
                col_b.info("⏳ Running Groq NLP...")

                conditions = patient.get("condition", ["diabetes"])
                result = extract_clinical_entities(demo_transcript, conditions)

                if result:
                    col_b.success("✅ Groq NLP Complete")
                    col_c.info("⏳ Generating Alert...")

                    urgency, message, action = determine_urgency(result, patient)
                    col_c.success(f"✅ Alert: {urgency}")

                    st.divider()
                    st.subheader("📋 Clinical Extraction Results")
                    c1, c2, c3, c4 = st.columns(4)
                    c1.metric("Medication", "✅ Taking" if result.get("medication_adherence") else "❌ Missed")
                    c2.metric("Pain Score", f"{result.get('pain_score','—')}/10")
                    c3.metric("Blood Sugar", f"{result.get('blood_sugar_self_report','—')} mg/dL")
                    c4.metric("Escalation", "🚨 YES" if result.get("escalation_flag") else "✅ NO")

                    urgency_color = {"CRITICAL":"🔴","MODERATE":"🟡","ROUTINE":"🟢"}.get(urgency,"⚪")
                    st.subheader(f"📱 Doctor WhatsApp Alert — {urgency_color} {urgency}")
                    st.code(message)
                    st.caption(f"Action: {action}")

                    cost = calculate_cost(45, True)
                    st.divider()
                    st.subheader("💰 Cost Comparison")
                    cc1, cc2, cc3 = st.columns(3)
                    cc1.metric("AI Call Cost", f"₹{cost['ai_cost']}")
                    cc2.metric("Manual Call Cost", f"₹{cost['manual_cost']}")
                    cc3.metric("Savings", f"{cost['savings_pct']}%", delta=f"₹{cost['savings_inr']} saved")

                    st.success(f"✅ Demo complete! VaaniCare processed this call for ₹{cost['ai_cost']} vs ₹{cost['manual_cost']} manual")

# ── Voice Intake Page ──────────────────────────────────────
elif page == "🎙️ Voice Intake":
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    from backend.voice_intake import (
        transcribe_audio_sarvam, extract_intake_entities,
        build_patient_record, DEMO_TRANSCRIPTS
    )
    
    # Fix 3: Use the initialized client
    sb = get_client()
    
    st.title("🎙️ New Patient Intake — Voice Registration")
    st.caption("Speak patient details in Hindi, English, or Bengali → AI extracts → Auto-register")
    
    # ── Mode selector ────────────────────────────────────────────
    mode = st.radio("Input Mode", ["🎤 Upload Audio (WAV/MP3)", "📝 Paste Transcript", "🔬 Demo Mode"],
                    horizontal=True)
    st.divider()
    
    transcript = None
    audio_bytes = None
    language = st.selectbox("Patient Language", [
        ("Hindi", "hi-IN"), ("English", "en-IN"), ("Bengali", "bn-IN"),
        ("Tamil", "ta-IN"), ("Telugu", "te-IN")
    ], format_func=lambda x: x[0])[1]
    
    if mode == "🎤 Upload Audio (WAV/MP3)":
        st.info("🎤 Upload a WAV/MP3 recording of the patient speaking their details")
        audio_file = st.file_uploader("Upload patient audio", type=["wav", "mp3", "ogg", "m4a"])
        if audio_file:
            st.audio(audio_file)
            audio_bytes = audio_file.read()
            
    elif mode == "📝 Paste Transcript":
        transcript = st.text_area(
            "Paste Hindi/English transcript",
            placeholder="Mera naam Ramesh Kumar hai. Main 45 saal ka hoon...",
            height=120
        )
        
    else:  # Demo mode
        lang_label = {"hi-IN": "Hindi", "en-IN": "English", "bn-IN": "Bengali"}.get(language, "Hindi")
        st.success(f"🔬 Using demo {lang_label} transcript")
        transcript = DEMO_TRANSCRIPTS.get(language, DEMO_TRANSCRIPTS["hi-IN"])
        st.text_area("Demo transcript:", value=transcript, height=100, disabled=True)
        
    # ── Run pipeline ─────────────────────────────────────────────
    run_btn = st.button("🚀 Extract Patient Data", type="primary",
                        disabled=(not transcript and not audio_bytes))
    if run_btn:
        with st.spinner("Processing..."):
            progress = st.progress(0)
            
            # Step 1: STT if audio
            if audio_bytes:
                progress.progress(20, "🎙️ Transcribing with Sarvam STT...")
                stt_result = transcribe_audio_sarvam(audio_bytes, language)
                if not stt_result["success"]:
                    st.error(f"STT failed: {stt_result['error']}")
                    st.stop()
                transcript = stt_result["transcript"]
                st.success(f"✅ Transcribed: *{transcript[:120]}...*")
                
            progress.progress(40, "🧠 Running Groq NLP extraction...")
            
            # Step 2: NLP extraction
            extracted = extract_intake_entities(transcript, language)
            progress.progress(75, "📋 Building patient record...")
            
            if "error" in extracted:
                st.error(f"NLP extraction failed: {extracted['error']}")
                st.stop()
                
            patient_record = build_patient_record(extracted, language)
            progress.progress(100, "✅ Done!")
            
        st.divider()
        st.subheader("📋 Extracted Patient Data — Review & Confirm")
        
        # Confidence badge
        conf = extracted.get("confidence", 0)
        conf_color = "🟢" if conf > 0.8 else "🟡" if conf > 0.5 else "🔴"
        st.metric("NLP Confidence", f"{conf_color} {conf:.0%}")
        
        if extracted.get("missing_critical"):
            st.warning(f"⚠️ Missing: {', '.join(extracted['missing_critical'])}")
            
        # Editable form
        with st.form("intake_confirm"):
            col1, col2 = st.columns(2)
            with col1:
                name   = st.text_input("Full Name *", value=patient_record["name"])
                age    = st.number_input("Age *", value=int(extracted.get("age") or 35), min_value=0, max_value=120)
                phone  = st.text_input("Phone", value=extracted.get("phone") or "")
                gender = st.selectbox("Gender", ["male","female","other"],
                                      index=["male","female","other"].index(extracted.get("gender","male") or "male"))
            with col2:
                district  = st.text_input("District", value=patient_record["district"])
                complaint = st.text_area("Chief Complaint", value=extracted.get("chief_complaint",""), height=80)
                conditions = st.multiselect("Known Conditions",
                    ["diabetes","hypertension","heart_disease","asthma","obesity","general"],
                    default=patient_record["condition"])
                    
            col3, col4 = st.columns(2)
            with col3:
                risk_tier = st.selectbox("Risk Tier",
                    ["CRITICAL","HIGH","MODERATE","LOW"],
                    index=["CRITICAL","HIGH","MODERATE","LOW"].index(patient_record["risk_tier"]))
            with col4:
                risk_score = st.slider("Risk Score", 0.0, 1.0, patient_record["risk_score"], 0.01)
                
            notes = st.text_area("Additional Notes", value=extracted.get("allergies") or "", height=60)
            submitted = st.form_submit_button("✅ Register Patient", type="primary")
            
        if submitted:
            final_record = {
                "name": name, "age": age, "phone": phone or None,
                "condition": conditions or ["general"],
                "risk_tier": risk_tier, "risk_score": risk_score,
                "district": district, "health_camp": "Voice Intake",
                "chest_discomfort": "none",
                "heart_risk_level": "High" if "heart_disease" in conditions else "Low",
                "diabetic_risk_level": "High" if "diabetes" in conditions else "Low",
                "hypertension_risk_level": "High" if "hypertension" in conditions else "Low",
            }
            result = sb.table("patients").insert(final_record).execute()
            patient_id = result.data[0]["id"]
            
            # Save intake session
            sb.table("voice_intake_sessions").insert({
                "transcript": transcript,
                "extracted_data": extracted,
                "patient_id": patient_id,
                "language": language,
                "confidence_score": conf,
                "status": "confirmed"
            }).execute()
            
            st.balloons()
            tier_emoji = {"CRITICAL":"🔴","HIGH":"🟠","MODERATE":"🟡","LOW":"🟢"}[risk_tier]
            st.success(f"""
            ✅ **{name}** registered successfully!
            Risk: {tier_emoji} {risk_tier} ({risk_score:.2f})
            Patient ID: `{patient_id}`
            """)

# ── Admission Follow-up Page ───────────────────────────────
elif page == "🏥 Admission Follow-up":
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    from backend.admission_engine import (
        create_admission, get_admissions_with_patients,
        get_due_followups, get_all_followups_for_admission,
        update_followup_result, discharge_patient, get_admission_stats
    )
    from backend.nlp_extractor import extract_clinical_entities
    from backend.action_engine import determine_urgency
    
    st.title("🏥 Admission Follow-up Manager")
    
    # ── Stats row ─────────────────────────────────────────────────
    stats = get_admission_stats()
    c1,c2,c3,c4,c5 = st.columns(5)
    c1.metric("Total Admissions", stats["total_admissions"])
    c2.metric("Currently Admitted", stats["currently_admitted"])
    c3.metric("Discharged", stats["discharged"])
    c4.metric("Pending Follow-ups", stats["pending_followups"])
    c5.metric("⚠️ Deteriorating", stats["deteriorating"],
              delta=f"{stats['deteriorating']} need attention" if stats["deteriorating"] else None,
              delta_color="inverse")
    st.divider()
    
    tab1, tab2, tab3 = st.tabs(["📋 Active Admissions", "⏰ Due Follow-ups", "➕ New Admission"])
    
    # ── Tab 1: Active Admissions ──────────────────────────────────
    with tab1:
        admissions = get_admissions_with_patients()
        if not admissions:
            st.info("No admissions found. Use 'New Admission' tab to add one.")
        else:
            for adm in admissions:
                pat = adm.get("patients") or {}
                risk_emoji = {"CRITICAL":"🔴","HIGH":"🟠","MODERATE":"🟡","LOW":"🟢"}.get(
                    pat.get("risk_tier","LOW"),"⚪")
                status_emoji = {"admitted":"🏥","discharged":"✅","critical":"🚨","transferred":"🔄"}.get(
                    adm["status"],"🏥")
                with st.expander(
                    f"{status_emoji} {pat.get('name','Unknown')} — {adm['hospital_name']} | "
                    f"{risk_emoji} {pat.get('risk_tier','')} | Admitted: {adm['admission_date']}"
                ):
                    col1, col2, col3 = st.columns(3)
                    col1.write(f"**Ward:** {adm.get('ward','—')}")
                    col1.write(f"**Diagnosis:** {adm.get('primary_diagnosis','—')}")
                    col2.write(f"**Doctor:** {adm.get('attending_doctor','—')}")
                    col2.write(f"**District:** {pat.get('district','—')}")
                    col3.write(f"**Status:** {adm['status'].upper()}")
                    col3.write(f"**Conditions:** {', '.join(pat.get('condition',[]) or [])}")
                    
                    # Follow-up timeline
                    followups = get_all_followups_for_admission(adm["id"])
                    if followups:
                        st.markdown("**Follow-up Timeline:**")
                        fu_cols = st.columns(len(followups))
                        for i, fu in enumerate(followups):
                            status_map = {"pending":"⏳","completed":"✅","missed":"❌","rescheduled":"🔄"}
                            recovery_map = {"improving":"💚","stable":"💛","deteriorating":"❤️","unknown":"⬜"}
                            with fu_cols[i]:
                                st.markdown(f"**{fu['follow_up_type'].upper()}**")
                                st.caption(fu["scheduled_date"])
                                st.markdown(status_map.get(fu["status"],"⏳") + f" {fu['status']}")
                                if fu.get("recovery_status"):
                                    st.markdown(recovery_map.get(fu["recovery_status"],"⬜") +
                                               f" {fu['recovery_status']}")
                                               
                    # Discharge button
                    if adm["status"] == "admitted":
                        st.divider()
                        with st.form(f"discharge_{adm['id']}"):
                            disc_date = st.date_input("Discharge Date", value=date.today())
                            disc_notes = st.text_input("Discharge Notes")
                            if st.form_submit_button("✅ Mark as Discharged"):
                                discharge_patient(adm["id"], str(disc_date), disc_notes)
                                st.success("Patient discharged. Follow-up schedule updated.")
                                st.rerun()
                                
    # ── Tab 2: Due Follow-ups ─────────────────────────────────────
    with tab2:
        st.subheader("⏰ Follow-ups Due in Next 3 Days")
        due = get_due_followups(days_ahead=3)
        if not due:
            st.success("✅ No follow-ups due in the next 3 days.")
        else:
            st.warning(f"⚠️ {len(due)} follow-ups require attention")
            for fu in due:
                pat = fu.get("patients") or {}
                adm = fu.get("admissions") or {}
                risk_emoji = {"CRITICAL":"🔴","HIGH":"🟠","MODERATE":"🟡","LOW":"🟢"}.get(
                    pat.get("risk_tier","LOW"),"⚪")
                days_until = (date.fromisoformat(fu["scheduled_date"]) - date.today()).days
                urgency_label = "TODAY" if days_until == 0 else f"in {days_until} day(s)"
                with st.expander(
                    f"{risk_emoji} {pat.get('name','Unknown')} — {fu['follow_up_type'].upper()} "
                    f"| {urgency_label} | {adm.get('hospital_name','—')}"
                ):
                    col1, col2 = st.columns([2,1])
                    with col1:
                        st.write(f"**Scheduled:** {fu['scheduled_date']}")
                        st.write(f"**Diagnosis:** {adm.get('primary_diagnosis','—')}")
                        st.write(f"**Conditions:** {', '.join(pat.get('condition',[]) or [])}")
                    with col2:
                        st.metric("Risk", f"{risk_emoji} {pat.get('risk_tier','—')}")
                        
                    # Run follow-up call
                    st.markdown("**Run AI Follow-up Call:**")
                    conditions = pat.get("condition", ["general"])
                    default_transcript = (
                        f"Haan ji, main {pat.get('name','patient')} bol raha hoon. "
                        f"Hospital se discharge hue 3 din ho gaye. "
                        f"Abhi thoda theek hun lekin dawai le raha hoon."
                    )
                    call_transcript = st.text_area(
                        "Patient Response (edit to test):",
                        value=default_transcript,
                        key=f"transcript_{fu['id']}",
                        height=80
                    )
                    if st.button(f"📞 Run Follow-up Pipeline", key=f"run_{fu['id']}", type="primary"):
                        with st.spinner("Running AI pipeline..."):
                            nlp_result = extract_clinical_entities(call_transcript, conditions)
                            urgency, message, action = determine_urgency(nlp_result, pat)
                            
                            # Map urgency to recovery status
                            recovery = {"CRITICAL":"deteriorating","MODERATE":"stable","ROUTINE":"improving"}.get(
                                urgency, "unknown")
                                
                            update_followup_result(fu["id"], call_transcript, nlp_result, recovery, urgency)
                            
                        urgency_color = {"CRITICAL":"🔴","MODERATE":"🟡","ROUTINE":"🟢"}.get(urgency,"⚪")
                        st.success(f"✅ Follow-up completed — {urgency_color} {urgency}")
                        
                        col_a, col_b, col_c, col_d = st.columns(4)
                        col_a.metric("Medication", "✅" if nlp_result.get("medication_adherence") else "❌ Missed")
                        col_b.metric("Escalation", "🚨 YES" if nlp_result.get("escalation_flag") else "✅ NO")
                        col_c.metric("Recovery", recovery.upper())
                        col_d.metric("Action", action[:25] + "...")
                        
                        st.code(message)
                        
                        if urgency == "CRITICAL":
                            st.error("🚨 CRITICAL: Immediate intervention required! WhatsApp alert sent to doctor.")
                        elif urgency == "MODERATE":
                            st.warning("⚠️ MODERATE: Schedule callback within 24 hours.")
                        else:
                            st.success("✅ ROUTINE: Patient recovering well. Continue monitoring.")
                        st.rerun()
                        
    # ── Tab 3: New Admission ──────────────────────────────────────
    with tab3:
        st.subheader("➕ Register New Admission")
        from backend.supabase_client import get_all_patients
        patients = get_all_patients()
        if not patients:
            st.error("No patients found. Register patients first.")
        else:
            patient_map = {f"{p['name']} ({p['risk_tier']}) — {p['district']}": p for p in patients}
            with st.form("new_admission"):
                selected_label = st.selectbox("Select Patient *", list(patient_map.keys()))
                selected_patient = patient_map[selected_label]
                
                col1, col2 = st.columns(2)
                with col1:
                    hospital = st.text_input("Hospital Name *",
                        placeholder="PMCH Patna / NMC Patna / PHC Digha")
                    ward = st.selectbox("Ward", [
                        "General Ward","ICU","Emergency","Cardiac","Medical","Surgical",
                        "Pediatric","Maternity","Orthopedic","Neurology"
                    ])
                    admission_date = st.date_input("Admission Date *", value=date.today())
                with col2:
                    diagnosis = st.text_input("Primary Diagnosis *",
                        placeholder="Hypertensive Crisis / Diabetic Ketoacidosis")
                    doctor = st.text_input("Attending Doctor", placeholder="Dr. Sharma")
                    reason = st.text_area("Admission Reason", height=70,
                        placeholder="Sudden chest pain with BP 180/110...")
                        
                st.info(f"📅 Auto-scheduling follow-up calls: Day 1, Day 3, Day 7, Day 30 post-admission")
                submitted = st.form_submit_button("🏥 Register Admission + Schedule Follow-ups", type="primary")
                
            if submitted:
                if not hospital or not diagnosis:
                    st.error("Hospital name and diagnosis are required.")
                else:
                    with st.spinner("Registering admission..."):
                        admission = create_admission(
                            patient_id=selected_patient["id"],
                            hospital=hospital, ward=ward,
                            admission_date=str(admission_date),
                            diagnosis=diagnosis, doctor=doctor, reason=reason
                        )
                    st.success(f"""
                    ✅ **{selected_patient['name']}** admitted to **{hospital}**
                    🗓️ 4 follow-up calls auto-scheduled (Day 1, 3, 7, 30)
                    Admission ID: `{admission['id']}`
                    """)
                    st.balloons()
                    st.rerun()

# ── Alerts Page ────────────────────────────────────────────
elif page == "🔔 Alerts":
    st.title("🔔 Doctor Alerts")
    alerts = get_unacknowledged_alerts()

    if not alerts:
        st.success("✅ No pending alerts")
    else:
        st.warning(f"⚠️ {len(alerts)} unacknowledged alerts")
        for alert in alerts:
            urgency = alert.get("urgency_tier","ROUTINE")
            emoji = {"CRITICAL":"🔴","MODERATE":"🟡","ROUTINE":"🟢"}.get(urgency,"⚪")
            patient_info = alert.get("patients",{}) or {}
            with st.expander(f"{emoji} {urgency} — {patient_info.get('name','Unknown')} — {alert.get('created_at','')[:16]}"):
                st.write(alert.get("alert_message",""))
                st.caption(f"Action: {alert.get('action_required','')}")
                st.caption(f"WhatsApp sent: {'✅' if alert.get('whatsapp_sent') else '❌'}")

# ── Cost Analysis Page ─────────────────────────────────────
elif page == "💰 Cost Analysis":
    st.title("💰 Cost Analysis")
    st.subheader("AI vs Manual Follow-up")

    col1, col2 = st.columns(2)
    col1.metric("AI Call Cost (avg)", "₹1.20", help="Sarvam STT + TTS + Groq NLP")
    col2.metric("Manual Nurse Call", "₹50.00", help="Nurse time + overhead")

    st.metric("Cost Reduction", "97.6%", delta="₹48.80 saved per call")
    st.divider()
    st.subheader("Scale Impact")
    patients_count = st.slider("Number of patients", 100, 10000, 1000)
    calls_per_month = st.slider("Calls per patient per month", 1, 8, 4)

    total_calls = patients_count * calls_per_month
    ai_total = total_calls * 1.20
    manual_total = total_calls * 50.0
    savings = manual_total - ai_total

    c1, c2, c3 = st.columns(3)
    c1.metric("Total Calls/Month", f"{total_calls:,}")
    c2.metric("AI Cost/Month", f"₹{ai_total:,.0f}")
    c3.metric("Manual Cost/Month", f"₹{manual_total:,.0f}")
    st.success(f"💰 Monthly Savings: ₹{savings:,.0f} ({((savings/manual_total)*100):.1f}% reduction)")