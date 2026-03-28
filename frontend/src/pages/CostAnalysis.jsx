import { useEffect, useState } from 'react';
import { api } from '../api/client';

function CostAnalysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setError('');
      setLoading(true);
      try {
        const res = await api.get('/dashboard/cost-analysis');
        setData(res);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Cost Analysis</h2>
          <p className="helper">AI call cost vs manual operations</p>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid metrics">
        <div className="card metric">
          <p className="label">AI Cost (₹)</p>
          <h2>{data?.total_ai_cost_inr ?? data?.ai_cost ?? '—'}</h2>
        </div>
        <div className="card metric">
          <p className="label">Manual Cost (₹)</p>
          <h2>{data?.total_manual_cost_inr ?? data?.manual_cost ?? '—'}</h2>
        </div>
        <div className="card metric">
          <p className="label">Savings (%)</p>
          <h2>
            {data?.savings_percent
              ? `${data.savings_percent}%`
              : data?.savings_pct
              ? `${data.savings_pct}%`
              : '—'}
          </h2>
        </div>
        <div className="card metric">
          <p className="label">Savings (₹)</p>
          <h2>{data?.total_savings_inr ?? data?.savings_inr ?? '—'}</h2>
        </div>
      </div>

      <div className="card section">
        {loading ? (
          <p className="helper">Calculating...</p>
        ) : (
          <p className="helper">
            Cost figures are returned by the FastAPI backend (/dashboard/cost-analysis) and mirror the
            Streamlit logic built on Supabase call data.
          </p>
        )}
      </div>
    </div>
  );
}

export default CostAnalysis;
