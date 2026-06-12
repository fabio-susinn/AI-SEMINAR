import React, { useMemo } from 'react';
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

  // Top 10 POIs by visits
  const topPois = useMemo(() =>
    [...poi_states]
      .filter(s => s.total_visits > 0)
      .sort((a, b) => b.total_visits - a.total_visits)
      .slice(0, 10)
      .map(s => ({ name: s.poi_name.length > 22 ? s.poi_name.slice(0, 20) + '…' : s.poi_name, visits: s.total_visits, dwell: s.avg_dwell_hours }))
  , [poi_states]);

  // Visits by neighbourhood (uses poi_states.neighbourhood injected by the backend)
  const byNeighbourhood = useMemo(() => {
    const map = {};
    poi_states.forEach(s => {
      const nb = s.neighborhood || 'Unknown';
      map[nb] = (map[nb] || 0) + s.total_visits;
    });
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([name, visits]) => ({
        name: name.length > 24 ? name.slice(0, 22) + '…' : name,
        fullName: name,
        visits,
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 12);
  }, [poi_states]);

  // Visits by category
  const byCategory = useMemo(() => {
    const map = {};
    poi_states.forEach(s => {
      const cat = s.category || 'other';
      map[cat] = (map[cat] || 0) + s.total_visits;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [poi_states]);

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

  // Visit hour distribution
  const hourDist = useMemo(() => {
    const buckets = {};
    for (let h = 9; h <= 21; h++) buckets[h] = 0;
    poi_states.forEach(s => {
      (s.visit_times || []).forEach(t => {
        const h = Math.floor(t);
        if (h >= 9 && h <= 21) buckets[h]++;
      });
    });
    return Object.entries(buckets).map(([h, count]) => ({ hour: `${h}h`, count }));
  }, [poi_states]);

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

      {/* ── Top POIs + Neighbourhood side by side ── */}
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
      <Section title="Agent details">
        <div style={tableWrap}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {['ID','Nationality','POIs','Spent','Fatigue','Satisfaction', sentiment ? 'Score' : null]
                  .filter(Boolean)
                  .map(h => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {agents.map((a, i) => {
                const s = sentiment?.find(r => r.agent.agent_id === a.agent_id);
                return (
                  <tr key={a.agent_id} style={{ background: i % 2 === 0 ? '#fafaf9' : '#fff' }}>
                    <td style={td}>{a.agent_id}</td>
                    <td style={td}>{a.nationality}</td>
                    <td style={td}>{a.pois_visited}</td>
                    <td style={td}>€{a.money_spent.toFixed(0)}</td>
                    <td style={td}>{a.fatigue.toFixed(2)}</td>
                    <td style={td}>{a.satisfaction.toFixed(2)}</td>
                    {sentiment && <td style={{ ...td, color: GREEN, fontWeight: 500 }}>{s ? s.sentiment.overall_score.toFixed(1) : '—'}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
