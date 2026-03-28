import { useEffect, useState } from 'react';
import { api } from '../api/client';

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acknowledging, setAcknowledging] = useState('');

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await api.get('/alerts');
      setAlerts(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const acknowledge = async (id) => {
    setAcknowledging(id);
    setError('');
    try {
      await api.post(`/alerts/${id}/acknowledge`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAcknowledging('');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Alerts</h2>
          <p className="helper">Doctor action alerts awaiting acknowledgement</p>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card section">
        {loading ? (
          <p className="helper">Loading alerts…</p>
        ) : alerts.length === 0 ? (
          <p className="helper">No pending alerts.</p>
        ) : (
          <ul className="list">
            {alerts.map((alert) => (
              <li key={alert.id} className="list-item">
                <div>
                  <p className="label">{alert.patient_name || alert.patient_id || alert.patients?.name}</p>
                  <p className="helper">{alert.message || alert.alert_message || 'Alert pending'}</p>
                </div>
                <button
                  className="secondary"
                  onClick={() => acknowledge(alert.id)}
                  disabled={acknowledging === alert.id}
                >
                  {acknowledging === alert.id ? 'Acknowledging…' : 'Acknowledge'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Alerts;
