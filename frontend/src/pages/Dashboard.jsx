import { useEffect, useState } from 'react';
import { api } from '../api/client';

function StatCard({ label, value, helper }) {
  return (
    <div className="card metric">
      <p className="label">{label}</p>
      <h2>{value ?? '—'}</h2>
      {helper && <p className="helper">{helper}</p>}
    </div>
  );
}

function Section({ title, description, children }) {
  return (
    <section className="card section">
      <div className="section-header">
        <div>
          <p className="eyebrow">{title}</p>
          {description && <p className="helper">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [calls, setCalls] = useState([]);
  const [dueCalls, setDueCalls] = useState([]);
  const [costs, setCosts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [statsData, callsData, dueData, costData] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/dashboard/calls'),
          api.get('/dashboard/due-calls'),
          api.get('/dashboard/cost-analysis'),
        ]);
        setStats(statsData);
        setCalls(callsData || []);
        setDueCalls(dueData || []);
        setCosts(costData || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const risk = stats?.risk_breakdown || {};

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p className="helper">Live metrics powered by the FastAPI backend</p>
        </div>
        <p className="updated-at">
          Last updated: {new Date().toLocaleString()}
        </p>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid metrics">
        <StatCard label="Total Patients" value={stats?.total_patients} helper="Active in Supabase" />
        <StatCard label="Calls Today" value={stats?.calls_today} helper="Recent call volume" />
        <StatCard label="Pending Alerts" value={stats?.pending_alerts} helper="Awaiting doctor action" />
        <StatCard label="High Risk" value={(risk.CRITICAL || 0) + (risk.HIGH || 0)} helper="Critical + High tiers" />
      </div>

      <div className="grid two-col">
        <Section title="Risk Breakdown" description="By latest scoring tier">
          <div className="risk-grid">
            {['CRITICAL', 'HIGH', 'MODERATE', 'LOW'].map((tier) => (
              <div key={tier} className={`risk-chip ${tier.toLowerCase()}`}>
                <span>{tier}</span>
                <strong>{risk[tier] ?? 0}</strong>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Cost Savings" description="AI vs manual calls">
          <div className="cost-summary">
            <p>AI cost (₹): <strong>{costs?.total_ai_cost_inr ?? '—'}</strong></p>
            <p>Manual cost (₹): <strong>{costs?.total_manual_cost_inr ?? '—'}</strong></p>
            <p>Savings: <strong>{costs?.savings_percent ? `${costs.savings_percent}%` : '—'}</strong></p>
            <p>Avg AI / call: <strong>{costs?.avg_ai_cost_inr ?? '—'}</strong></p>
          </div>
        </Section>
      </div>

      <div className="grid two-col">
        <Section title="Recent Calls" description="Latest conversations">
          {calls.length === 0 ? (
            <p className="helper">No calls recorded yet.</p>
          ) : (
            <ul className="list">
              {calls.slice(0, 8).map((call) => (
                <li key={call.id} className="list-item">
                  <div>
                    <p className="label">{call.patient_name || call.patient_id || call.patients?.name}</p>
                    <p className="helper">
                      {call.status || 'completed'} • {call.language || 'hi-IN'}
                    </p>
                  </div>
                  <span className="pill">{call.risk_tier || '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Due Calls" description="Patients scheduled for follow-up">
          {dueCalls.length === 0 ? (
            <p className="helper">No pending scheduled calls.</p>
          ) : (
            <ul className="list">
              {dueCalls.slice(0, 8).map((item) => (
                <li key={item.patient_id} className="list-item">
                  <div>
                    <p className="label">{item.name}</p>
                    <p className="helper">Next call: {item.next_call_time || item.scheduled_for || '—'}</p>
                  </div>
                  <span className="pill">{item.risk_tier || '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

export default Dashboard;
