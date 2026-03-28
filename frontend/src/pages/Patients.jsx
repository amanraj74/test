import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

const RISK_OPTIONS = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'];

function Patients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(['CRITICAL', 'HIGH']);

  useEffect(() => {
    const load = async () => {
      setError('');
      setLoading(true);
      try {
        const data = await api.get('/patients');
        setPatients(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredPatients = useMemo(() => {
    if (!filters.length) return patients;
    return patients.filter((p) => filters.includes(p.risk_tier));
  }, [patients, filters]);

  const toggleFilter = (tier) => {
    setFilters((prev) =>
      prev.includes(tier) ? prev.filter((item) => item !== tier) : [...prev, tier]
    );
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Patients</h2>
          <p className="helper">Search and filter patients from Supabase</p>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card filters">
        <p className="label">Risk filters</p>
        <div className="chip-row">
          {RISK_OPTIONS.map((tier) => (
            <button
              key={tier}
              className={filters.includes(tier) ? 'chip active' : 'chip'}
              onClick={() => toggleFilter(tier)}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      <div className="card section">
        {loading ? (
          <p className="helper">Loading patients…</p>
        ) : filteredPatients.length === 0 ? (
          <p className="helper">No patients match the current filters.</p>
        ) : (
          <div className="table">
            <div className="table-head">
              <span>Name</span>
              <span>Risk</span>
              <span>Condition</span>
              <span>District</span>
              <span>Score</span>
            </div>
            {filteredPatients.map((patient) => (
              <Link
                key={patient.id}
                to={`/patients/${patient.id}`}
                className="table-row"
              >
                <span className="label">{patient.name}</span>
                <span className="pill">{patient.risk_tier || '—'}</span>
                <span className="helper">{(patient.condition || []).join(', ') || '—'}</span>
                <span className="helper">{patient.district || '—'}</span>
                <span className="helper">{patient.risk_score?.toFixed?.(2) ?? '—'}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Patients;
