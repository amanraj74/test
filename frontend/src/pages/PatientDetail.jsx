import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="helper">{value ?? '—'}</p>
    </div>
  );
}

function PatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [memory, setMemory] = useState(null);
  const [calls, setCalls] = useState([]);
  const [observations, setObservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [error, setError] = useState('');
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [patientData, memoryData, callData, obsData] = await Promise.all([
          api.get(`/patients/${id}`),
          api.get(`/patients/${id}/memory`),
          api.get(`/patients/${id}/calls`),
          api.get(`/patients/${id}/observations`),
        ]);
        setPatient(patientData);
        setMemory(memoryData);
        setCalls(callData || []);
        setObservations(obsData || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const triggerDemoCall = async () => {
    setTriggering(true);
    setActionMessage('');
    setError('');
    try {
      const res = await api.post('/calls/trigger', { patient_id: id, demo_mode: true });
      setActionMessage(res?.message || 'Demo call triggered via backend pipeline.');
    } catch (err) {
      setError(err.message);
    } finally {
      setTriggering(false);
    }
  };

  if (loading) return <p className="helper">Loading patient details…</p>;
  if (error) return <div className="error">{error}</div>;
  if (!patient) return <p className="helper">Patient not found.</p>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            <Link to="/patients" className="back-link">← Patients</Link>
          </p>
          <h2>{patient.name}</h2>
          <p className="helper">{patient.condition?.join(', ') || 'No condition set'}</p>
        </div>
        <div className="pill large">{patient.risk_tier || '—'}</div>
      </div>

      {actionMessage && <div className="success">{actionMessage}</div>}
      {error && <div className="error">{error}</div>}

      <div className="grid two-col">
        <div className="card section">
          <div className="section-header">
            <p className="eyebrow">Profile</p>
            <button className="primary" onClick={triggerDemoCall} disabled={triggering}>
              {triggering ? 'Triggering…' : 'Trigger Demo Call'}
            </button>
          </div>
          <div className="grid info">
            <InfoItem label="Phone" value={patient.phone} />
            <InfoItem label="Age" value={patient.age} />
            <InfoItem label="District" value={patient.district} />
            <InfoItem label="Language" value={patient.language || 'hi-IN'} />
            <InfoItem label="HbA1c" value={patient.hba1c} />
            <InfoItem label="Blood Pressure" value={patient.systolic_bp && patient.diastolic_bp ? `${patient.systolic_bp}/${patient.diastolic_bp}` : '—'} />
            <InfoItem label="Risk Score" value={patient.risk_score?.toFixed?.(2)} />
          </div>
        </div>

        <div className="card section">
          <p className="eyebrow">Memory Snapshot</p>
          {memory?.message ? (
            <p className="helper">{memory.message}</p>
          ) : (
            <div className="memory-grid">
              <InfoItem label="Total Calls" value={memory?.total_calls} />
              <InfoItem label="Medication Adherence" value={memory?.adherence ?? '—'} />
              <InfoItem label="Trend" value={memory?.trend ?? '—'} />
            </div>
          )}
        </div>
      </div>

      <div className="grid two-col">
        <div className="card section">
          <div className="section-header">
            <p className="eyebrow">Recent Calls</p>
          </div>
          {calls.length === 0 ? (
            <p className="helper">No calls recorded.</p>
          ) : (
            <ul className="list">
              {calls.slice(0, 8).map((call) => (
                <li key={call.id || call.call_id} className="list-item">
                  <div>
                    <p className="label">{call.id || call.call_id}</p>
                    <p className="helper">{call.status || 'completed'} • {call.language || 'hi-IN'}</p>
                  </div>
                  <span className="pill">{call.risk_tier || '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card section">
          <div className="section-header">
            <p className="eyebrow">Observations</p>
          </div>
          {observations.length === 0 ? (
            <p className="helper">No observations yet.</p>
          ) : (
            <ul className="list">
              {observations.slice(0, 8).map((obs) => (
                <li key={obs.id || obs.call_id} className="list-item">
                  <div>
                    <p className="label">Call {obs.call_id || obs.id}</p>
                    <p className="helper">{obs.summary || obs.notes || '—'}</p>
                  </div>
                  <span className="pill">{obs.risk_tier || obs.status || '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default PatientDetail;
