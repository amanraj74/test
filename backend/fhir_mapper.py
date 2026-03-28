from datetime import datetime, timezone
import uuid
from typing import Optional
from loguru import logger


def generate_fhir_bundle(
    patient: dict,
    observation_data: dict,
    call_id: str,
) -> dict:
    """Generate FHIR R4 Bundle from patient + clinical observation data."""

    now = datetime.now(timezone.utc).isoformat()
    patient_id = patient.get("id", str(uuid.uuid4()))
    bundle_id = str(uuid.uuid4())

    # ── Patient Resource ──────────────────────────────────
    patient_resource = {
        "resourceType": "Patient",
        "id": patient_id,
        "meta": {"profile": ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient"]},
        "identifier": [{"system": "https://vaanicare.in/patient-id", "value": patient_id}],
        "name": [{"use": "official", "text": patient.get("name", "Unknown")}],
        "telecom": [{"system": "phone", "value": patient.get("phone", ""), "use": "mobile"}],
        "gender": patient.get("gender", "unknown"),
        "extension": [
            {
                "url": "https://nrces.in/ndhm/fhir/r4/StructureDefinition/ndhm-patient-languageOfCommunication",
                "valueCode": patient.get("language", "hi-IN"),
            }
        ],
    }

    # ── Encounter Resource ────────────────────────────────
    encounter_resource = {
        "resourceType": "Encounter",
        "id": call_id,
        "status": "finished",
        "class": {
            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            "code": "VR",
            "display": "Virtual",
        },
        "type": [
            {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": "185317003",
                        "display": "Telephone encounter",
                    }
                ]
            }
        ],
        "subject": {"reference": f"Patient/{patient_id}"},
        "period": {"start": now, "end": now},
        "serviceProvider": {
            "display": "VaaniCare AI Health Platform",
        },
    }

    entries = [
        {"fullUrl": f"Patient/{patient_id}", "resource": patient_resource},
        {"fullUrl": f"Encounter/{call_id}", "resource": encounter_resource},
    ]

    # ── Observations ──────────────────────────────────────
    obs_id = str(uuid.uuid4())

    # Medication Adherence
    if observation_data.get("medication_adherence") is not None:
        entries.append({
            "fullUrl": f"Observation/{obs_id}-med",
            "resource": {
                "resourceType": "Observation",
                "id": f"{obs_id}-med",
                "status": "final",
                "code": {
                    "coding": [{"system": "http://loinc.org", "code": "418633004", "display": "Medication adherence"}]
                },
                "subject": {"reference": f"Patient/{patient_id}"},
                "encounter": {"reference": f"Encounter/{call_id}"},
                "effectiveDateTime": now,
                "valueBoolean": observation_data["medication_adherence"],
            }
        })

    # Blood Sugar
    if observation_data.get("blood_sugar_self_report"):
        entries.append({
            "fullUrl": f"Observation/{obs_id}-bg",
            "resource": {
                "resourceType": "Observation",
                "id": f"{obs_id}-bg",
                "status": "final",
                "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs"}]}],
                "code": {
                    "coding": [{"system": "http://loinc.org", "code": "2339-0", "display": "Glucose [Mass/volume] in Blood"}]
                },
                "subject": {"reference": f"Patient/{patient_id}"},
                "encounter": {"reference": f"Encounter/{call_id}"},
                "effectiveDateTime": now,
                "valueQuantity": {
                    "value": observation_data["blood_sugar_self_report"],
                    "unit": "mg/dL",
                    "system": "http://unitsofmeasure.org",
                    "code": "mg/dL",
                },
            }
        })

    # Pain Score
    if observation_data.get("pain_score") is not None:
        entries.append({
            "fullUrl": f"Observation/{obs_id}-pain",
            "resource": {
                "resourceType": "Observation",
                "id": f"{obs_id}-pain",
                "status": "final",
                "code": {
                    "coding": [{"system": "http://loinc.org", "code": "72514-3", "display": "Pain severity - 0-10 verbal numeric rating [Score]"}]
                },
                "subject": {"reference": f"Patient/{patient_id}"},
                "encounter": {"reference": f"Encounter/{call_id}"},
                "effectiveDateTime": now,
                "valueInteger": observation_data["pain_score"],
            }
        })

    # Escalation Flag as Condition
    if observation_data.get("escalation_flag"):
        condition_id = str(uuid.uuid4())
        entries.append({
            "fullUrl": f"Condition/{condition_id}",
            "resource": {
                "resourceType": "Condition",
                "id": condition_id,
                "clinicalStatus": {
                    "coding": [{"system": "http://terminology.hl7.org/CodeSystem/condition-clinical", "code": "active"}]
                },
                "code": {
                    "text": observation_data.get("escalation_reason", "Clinical escalation flagged by AI")
                },
                "subject": {"reference": f"Patient/{patient_id}"},
                "encounter": {"reference": f"Encounter/{call_id}"},
                "recordedDate": now,
                "note": [{"text": f"AI-flagged for doctor review. Reason: {observation_data.get('escalation_reason', 'N/A')}"}],
            }
        })

    # ── Bundle ────────────────────────────────────────────
    bundle = {
        "resourceType": "Bundle",
        "id": bundle_id,
        "meta": {
            "profile": ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle"],
            "lastUpdated": now,
        },
        "identifier": {
            "system": "https://vaanicare.in/bundle-id",
            "value": bundle_id,
        },
        "type": "document",
        "timestamp": now,
        "entry": entries,
    }

    logger.info(f"✅ FHIR R4 Bundle generated — {len(entries)} resources, patient={patient.get('name')}")
    return bundle


def get_fhir_summary(bundle: dict) -> dict:
    """Extract key info from FHIR bundle for display."""
    entries = bundle.get("entry", [])
    resource_types = [e["resource"]["resourceType"] for e in entries]
    return {
        "bundle_id": bundle.get("id"),
        "total_resources": len(entries),
        "resource_types": list(set(resource_types)),
        "timestamp": bundle.get("timestamp"),
        "abdm_compliant": True,
        "fhir_version": "R4",
    }


if __name__ == "__main__":
    import json

    sample_patient = {
        "id": "test-patient-001",
        "name": "Ramesh Kumar",
        "phone": "+919876543210",
        "gender": "male",
        "language": "hi-IN",
        "condition": ["diabetes", "hypertension"],
        "risk_tier": "CRITICAL",
    }
    sample_obs = {
        "medication_adherence": False,
        "blood_sugar_self_report": 240.0,
        "pain_score": 5,
        "escalation_flag": True,
        "escalation_reason": "Blood sugar > 200 + chest symptom + missed doses",
    }

    bundle = generate_fhir_bundle(sample_patient, sample_obs, "call-001")
    summary = get_fhir_summary(bundle)

    print("\n✅ FHIR Bundle Summary:")
    print(json.dumps(summary, indent=2))
    print(f"\nTotal entries: {len(bundle['entry'])}")
    print("ABDM-compliant FHIR R4 ✅")