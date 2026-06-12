import React, { useMemo, useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  ScatterChart, Scatter, CartesianGrid,
} from 'recharts';

const GREEN  = '#1D9E75';
const ORANGE = '#D85A30';
const BLUE   = '#3B82F6';
const PURPLE = '#8B5CF6';
const YELLOW = '#F59E0B';

const SENTIMENT_COLORS = {
  very_positive: '#059669',
  positive:      '#1D9E75',
  neutral:       '#F59E0B',
  negative:      '#F97316',
  very_negative: '#DC2626',
};

const PALETTE = [GREEN, ORANGE, BLUE, PURPLE, YELLOW, '#EC4899', '#14B8A6', '#6366F1'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function avg(arr, key) {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + (key ? x[key] : x), 0) / arr.length;
}

function StatCard({ label, value, sub, color = '#1a1a18' }) {
  return (
    <div style={cardStyle}>
      <p style={{ fontSize: 11, color: '#888780', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, color, margin: '4px 0 0' }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: '#aaa', margin: 0 }}>{sub}</p>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <p style={sectionTitle}>{title}</p>
      {children}
    </div>
  );
}

// ── Gauge bar ─────────────────────────────────────────────────────────────────

function GaugeBar({ value, max = 1, color = GREEN, label, format }) {
  const pct = Math.min(value / max, 1) * 100;
  const display = format ? format(value) : value.toFixed(3);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#888780' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color }}>{display}</span>
      </div>
      <div style={{ height: 6, background: '#e8e6e0', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

// ── Comparison row ────────────────────────────────────────────────────────────

function CompareRow({ labelA, valueA, labelB, valueB, color = GREEN }) {
  const maxV = Math.max(valueA, valueB, 0.01);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#888780', width: 160, flexShrink: 0 }}>{labelA}</span>
        <div style={{ flex: 1, height: 8, background: '#e8e6e0', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(valueA / maxV) * 100}%`, background: color, borderRadius: 4 }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color, width: 36, textAlign: 'right' }}>{valueA.toFixed(1)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: '#888780', width: 160, flexShrink: 0 }}>{labelB}</span>
        <div style={{ flex: 1, height: 8, background: '#e8e6e0', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(valueB / maxV) * 100}%`, background: ORANGE, borderRadius: 4 }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: ORANGE, width: 36, textAlign: 'right' }}>{valueB.toFixed(1)}</span>
      </div>
    </div>
  );
}

// ── Evaluation metrics section ────────────────────────────────────────────────

// ── Evaluation metrics section ────────────────────────────────────────────────

function EvaluationMetrics() {
  const [data, setData]     = useState(null);
  const [error, setError]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/metrics')
      .then(r => {
        if (!r.ok) throw new Error(
          r.status === 503
            ? 'Run a simulation first to see evaluation metrics.'
            : `Server error ${r.status}`
        );
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <p style={{ fontSize: 12, color: '#888780' }}>Loading evaluation metrics…</p>;
  if (error)   return <p style={{ fontSize: 12, color: ORANGE }}>{error}</p>;
  if (!data)   return null;

  const {
    total_visits,
    spatial_gini_index,
    overtourism_concentration_ratio,
    local_revenue_distribution_ratio,
    catalog_coverage_ratio,
    intra_list_diversity_avg_tags,
    average_tourist_satisfaction,
    average_transit_walk_fatigue,
    avg_pois_visited,
    precision_interest_match_ratio,
    fairness_metrics,
  } = data;
  
  const {
    low_budget_avg_pois,
    high_budget_avg_pois,
    vulnerable_group_avg_satisfaction,
    standard_group_avg_satisfaction,
  } = fairness_metrics;

  const giniLabel = spatial_gini_index < 0.3 ? 'Good spread' : spatial_gini_index < 0.6 ? 'Moderate concentration' : 'High concentration';
  const giniColor = spatial_gini_index < 0.3 ? GREEN : spatial_gini_index < 0.6 ? YELLOW : ORANGE;

  return (
    <div style={twoCol}>
      {/* Quality & Management metrics */}
      <Section title="Spatial, Revenue & Diversity Quality">
        <GaugeBar
          value={spatial_gini_index}
          label={`Spatial Gini index — ${giniLabel}`}
          color={giniColor}
          format={v => v.toFixed(3)}
        />
        <GaugeBar
          value={overtourism_concentration_ratio}
          label="Overtourism concentration ratio"
          color={ORANGE}
          format={v => `${(v * 100).toFixed(1)}%`}
        />
        <GaugeBar
          value={local_revenue_distribution_ratio}
          label="Local revenue distribution ratio"
          color={GREEN}
          format={v => `${(v * 100).toFixed(1)}%`}
        />
        <GaugeBar
          value={catalog_coverage_ratio}
          label="Catalog coverage ratio"
          color={BLUE}
          format={v => `${(v * 100).toFixed(1)}%`}
        />
        <GaugeBar
          value={precision_interest_match_ratio}
          label="Interest-match precision"
          color={PURPLE}
          format={v => `${(v * 100).toFixed(1)}%`}
        />
        
        {/* Expanded Grid Summary of Base System Evaluation */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Visits',      value: total_visits.toLocaleString(),               color: '#1a1a18' },
            { label: 'Avg POIs Visited',  value: avg_pois_visited.toFixed(1),                 color: BLUE },
            { label: 'Intra-list Div.',   value: intra_list_diversity_avg_tags.toFixed(2),    color: YELLOW },
            { label: 'Avg Satisfaction',  value: `${(average_tourist_satisfaction * 10).toFixed(1)}/10`, color: GREEN },
            { label: 'Transit Fatigue',   value: average_transit_walk_fatigue.toFixed(2),     color: ORANGE },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...cardStyle, flex: '1 1 110px', textAlign: 'center' }}>
              <p style={{ fontSize: 10, color: '#888780', margin: 0 }}>{label}</p>
              <p style={{ fontSize: 16, fontWeight: 600, color, margin: '4px 0 0' }}>{value}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Fairness metrics */}
      <Section title="Fairness metrics">
        <p style={{ fontSize: 11, color: '#888780', margin: '0 0 10px' }}>Avg POIs visited — budget groups</p>
        <CompareRow
          labelA="Low budget"
          valueA={low_budget_avg_pois}
          labelB="High budget"
          valueB={high_budget_avg_pois}
          color={GREEN}
        />
        <p style={{ fontSize: 11, color: '#888780', margin: '14px 0 10px' }}>Avg satisfaction — vulnerability groups</p>
        <CompareRow
          labelA="Vulnerable (kids/seniors)"
          valueA={vulnerable_group_avg_satisfaction}
          labelB="Standard / solo"
          valueB={standard_group_avg_satisfaction}
          color={PURPLE}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Low budget POIs',  value: low_budget_avg_pois.toFixed(1),               color: GREEN  },
            { label: 'High budget POIs', value: high_budget_avg_pois.toFixed(1),              color: ORANGE },
            { label: 'Vulnerable sat.',  value: vulnerable_group_avg_satisfaction.toFixed(2), color: PURPLE },
            { label: 'Standard sat.',    value: standard_group_avg_satisfaction.toFixed(2),   color: BLUE   },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...cardStyle, flex: '1 1 80px', textAlign: 'center' }}>
              <p style={{ fontSize: 10, color: '#888780', margin: 0 }}>{label}</p>
              <p style={{ fontSize: 18, fontWeight: 600, color, margin: '4px 0 0' }}>{value}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Statistics({ simResults }) {
  const { agents = [], poi_states = [], sentiment = null } = simResults;

  // ── Derived data ───────────────────────────────────────────────────────────

  const avgPois    = avg(agents, 'pois_visited').toFixed(1);
  const avgSpent   = '€' + avg(agents, 'money_spent').toFixed(0);
  const avgFatigue = avg(agents, 'fatigue').toFixed(2);
  const avgScore   = sentiment
    ? (avg(sentiment.map(r => r.sentiment.overall_score))).toFixed(1) + '/10'
    : 'n/a';

  // ── Visit metrics — fetched from /api/visit-metrics ──────────────────────
  const [visitMetrics, setVisitMetrics] = useState(null);
  const [visitMetricsError, setVisitMetricsError] = useState(null);

  useEffect(() => {
    fetch('/api/visit-metrics')
      .then(r => {
        if (!r.ok) throw new Error(r.status === 503 ? 'Run a simulation first.' : `Server error ${r.status}`);
        return r.json();
      })
      .then(d => setVisitMetrics(d))
      .catch(e => setVisitMetricsError(e.message));
  }, []);

  const topPois = useMemo(() => {
    if (!visitMetrics) return [];
    return visitMetrics.top_pois.map(s => ({
      name: s.poi_name.length > 22 ? s.poi_name.slice(0, 20) + '…' : s.poi_name,
      visits: s.visits,
      dwell: s.avg_dwell,
    }));
  }, [visitMetrics]);

  const byNeighbourhood = useMemo(() => {
    if (!visitMetrics) return [];
    return visitMetrics.by_neighbourhood
      .filter(r => r.visits > 0)
      .slice(0, 12)
      .map(r => ({
        name:     r.neighbourhood.length > 24 ? r.neighbourhood.slice(0, 22) + '…' : r.neighbourhood,
        fullName: r.neighbourhood,
        visits:   r.visits,
      }));
  }, [visitMetrics]);

  const byCategory = useMemo(() => {
    if (!visitMetrics) return [];
    return visitMetrics.by_category.map(r => ({ name: r.category, value: r.visits }));
  }, [visitMetrics]);

  const hourDist = useMemo(() => {
    if (!visitMetrics) return [];
    return visitMetrics.by_hour.map(r => ({ hour: r.label, count: r.count }));
  }, [visitMetrics]);

  // Sentiment distribution
  const sentimentDist = useMemo(() => {
    if (!sentiment) return [];
    const map = {};
    sentiment.forEach(r => {
      const s = r.sentiment.overall_sentiment;
      map[s] = (map[s] || 0) + 1;
    });
    return ['very_positive','positive','neutral','negative','very_negative']
      .filter(k => map[k])
      .map(k => ({ name: k.replace('_', ' '), value: map[k], key: k }));
  }, [sentiment]);

  // Fatigue vs satisfaction scatter
  const scatterData = useMemo(() =>
    agents.map(a => ({ fatigue: +a.fatigue.toFixed(2), satisfaction: +a.satisfaction.toFixed(2), pois: a.pois_visited }))
  , [agents]);

  // Emotional arcs
  const arcDist = useMemo(() => {
    if (!sentiment) return [];
    const map = {};
    sentiment.forEach(r => {
      const a = r.sentiment.emotional_arc;
      map[a] = (map[a] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));
  }, [sentiment]);

  // Would recommend / return
  const wouldRec    = sentiment ? (sentiment.filter(r => r.sentiment.would_recommend).length / sentiment.length * 100).toFixed(0) : null;
  const wouldReturn = sentiment ? (sentiment.filter(r => r.sentiment.would_return).length / sentiment.length * 100).toFixed(0) : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={container}>

      {/* ── KPI row ── */}
      <Section title="Overview">
        <div style={kpiRow}>
          <StatCard label="Agents"         value={agents.length}  />
          <StatCard label="Avg POIs"        value={avgPois}        sub="per agent" />
          <StatCard label="Avg spend"       value={avgSpent}       sub="per agent" color={ORANGE} />
          <StatCard label="Avg fatigue"     value={avgFatigue}     sub="0–1 scale" />
          <StatCard label="Avg sentiment"   value={avgScore}       color={GREEN} />
          {wouldRec    && <StatCard label="Would recommend" value={wouldRec + '%'}    color={BLUE} />}
          {wouldReturn && <StatCard label="Would return"    value={wouldReturn + '%'} color={PURPLE} />}
        </div>
      </Section>

      {/* ── Top POIs, Neighbourhood, Category, Hour ── */}
      {visitMetricsError ? (
        <p style={{ fontSize: 12, color: ORANGE, marginBottom: 20 }}>{visitMetricsError}</p>
      ) : !visitMetrics ? (
        <p style={{ fontSize: 12, color: '#888780', marginBottom: 20 }}>Loading visit metrics…</p>
      ) : (
        <>
          <div style={twoCol}>
            <Section title="Top 10 most visited POIs">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topPois} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => [v, 'visits']} />
                  <Bar dataKey="visits" fill={GREEN} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>

            <Section title="Visits by neighbourhood">
              {byNeighbourhood.length === 0 ? (
                <p style={{ fontSize: 12, color: '#888780', margin: 0 }}>
                  No neighbourhood data — make sure your POI JSON has a <code>neighbourhood</code> field.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byNeighbourhood} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={155} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v, _, props) => [v, props.payload?.fullName || 'visits']} />
                    <Bar dataKey="visits" radius={[0, 4, 4, 0]}>
                      {byNeighbourhood.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Section>
          </div>

          {/* ── Category + Sentiment pies ── */}
          <div style={twoCol}>
            <Section title="Visits by category">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent*100).toFixed(0)}%` : ''} labelLine={false}>
                    {byCategory.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Section>

            {sentimentDist.length > 0 && (
              <Section title="Sentiment distribution">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={sentimentDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => percent > 0.05 ? `${(percent*100).toFixed(0)}%` : ''} labelLine={false}>
                      {sentimentDist.map((d, i) => <Cell key={i} fill={SENTIMENT_COLORS[d.key] || PALETTE[i]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </Section>
            )}
          </div>

          {/* ── Visit hour heatmap ── */}
          <Section title="Visit arrivals by hour">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={hourDist} margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => [v, 'arrivals']} />
                <Bar dataKey="count" fill={ORANGE} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        </>
      )}

      {/* ── Fatigue vs Satisfaction scatter ── */}
      <Section title="Fatigue vs satisfaction (per agent)">
        <ResponsiveContainer width="100%" height={200}>
          <ScatterChart margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis type="number" dataKey="fatigue"      name="Fatigue"      domain={[0,1]}   tick={{ fontSize: 11 }} label={{ value: 'Fatigue', position: 'insideBottom', offset: -2, fontSize: 11 }} />
            <YAxis type="number" dataKey="satisfaction" name="Satisfaction"                  tick={{ fontSize: 11 }} label={{ value: 'Satisfaction', angle: -90, position: 'insideLeft', fontSize: 11 }} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v, n) => [v.toFixed(2), n]} />
            <Scatter data={scatterData} fill={BLUE} fillOpacity={0.6} />
          </ScatterChart>
        </ResponsiveContainer>
      </Section>

      {/* ── Emotional arc distribution ── */}
      {arcDist.length > 0 && (
        <Section title="Emotional arcs">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={arcDist} margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {arcDist.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* ── Agent table ── */}

      {/* ── Evaluation & fairness metrics ── */}
      <Section title="Evaluation & fairness metrics">
        <EvaluationMetrics />
      </Section>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const container   = { padding: '24px 28px', fontFamily: "'DM Sans', sans-serif", color: '#1a1a18', background: '#f8f7f4', minHeight: '100%' };
const kpiRow      = { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 4 };
const cardStyle   = { background: '#fff', border: '0.5px solid #e0ddd6', borderRadius: 10, padding: '12px 16px', minWidth: 100, flex: '1 1 100px' };
const sectionTitle = { fontSize: 13, fontWeight: 600, color: '#1a1a18', margin: '0 0 12px', borderBottom: '0.5px solid #e8e6e0', paddingBottom: 6 };
const twoCol      = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };
const tableWrap   = { overflowX: 'auto', border: '0.5px solid #e0ddd6', borderRadius: 8 };
const tableStyle  = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
const th          = { padding: '8px 12px', background: '#f0ede8', fontWeight: 600, textAlign: 'left', borderBottom: '0.5px solid #e0ddd6', whiteSpace: 'nowrap' };
const td          = { padding: '6px 12px', borderBottom: '0.5px solid #f0ede8', whiteSpace: 'nowrap' };
