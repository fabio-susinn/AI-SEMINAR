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

// ── Category colour map ───────────────────────────────────────────────────────

const CAT_COLORS = {
  museum: BLUE, monument: PURPLE, park: GREEN, beach: '#06B6D4',
  market: YELLOW, restaurant: ORANGE, bar: '#F97316', nightlife: '#EC4899',
  shop: '#A855F7', viewpoint: '#14B8A6', religious: '#6366F1',
  architecture: '#D97706', neighbourhood: '#84CC16', transport_hub: '#64748B', other: '#9CA3AF',
};

// ── Boolean pill ──────────────────────────────────────────────────────────────

function BoolPill({ label, value }) {
  return (
    <span style={{
      background: value ? '#D1FAE5' : '#F3F4F6',
      color:      value ? '#065F46' : '#9CA3AF',
      fontSize: 10, fontWeight: 600, borderRadius: 20,
      padding: '2px 9px', display: 'inline-block', margin: '2px 3px 2px 0',
    }}>
      {value ? '✓' : '✗'} {label}
    </span>
  );
}

// ── POI lookup panel ──────────────────────────────────────────────────────────

function POILookup() {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);   // search suggestions
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [poi, setPoi]           = useState(null);
  const [showDrop, setShowDrop] = useState(false);
  const [visitData, setVisitData] = useState([]);

  // Load scatter data whenever a new POI is selected
  useEffect(() => {
    if (poi) {
      fetch(`/api/pois/${encodeURIComponent(poi.id)}/visits-scatter`)
        .then(r => r.ok ? r.json() : [])
        .then(d => setVisitData(d))
        .catch(() => setVisitData([]));
    } else {
      setVisitData([]);
    }
  }, [poi]);

  // Fetch all POIs once for the suggestion list
  const [allPois, setAllPois]   = useState([]);
  useEffect(() => {
    fetch('/api/pois')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setAllPois(d))
      .catch(() => {});
  }, []);

  function handleInput(val) {
    setQuery(val);
    setPoi(null);
    setError(null);
    if (!val.trim()) { setResults([]); setShowDrop(false); return; }
    const q = val.toLowerCase();
    const matches = allPois
      .filter(p => p.name.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q))
      .slice(0, 8);
    setResults(matches);
    setShowDrop(matches.length > 0);
  }

  function selectPoi(p) {
    setQuery(p.name);
    setShowDrop(false);
    setResults([]);
    loadPoi(p.id);
  }

  function loadPoi(id) {
    setLoading(true);
    setError(null);
    setPoi(null);
    fetch(`/api/pois/${encodeURIComponent(id)}`)
      .then(r => {
        if (!r.ok) return r.json().then(b => { throw new Error(b.detail || `Error ${r.status}`); });
        return r.json();
      })
      .then(d => { setPoi(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  function handleKey(e) {
    if (e.key === 'Enter') {
      setShowDrop(false);
      if (results.length === 1) { selectPoi(results[0]); return; }
      const exact = allPois.find(p => p.name.toLowerCase() === query.toLowerCase());
      if (exact) loadPoi(exact.id);
      else if (results.length === 0 && query.trim()) loadPoi(query.trim());
    }
    if (e.key === 'Escape') setShowDrop(false);
  }

  const scoreFields = poi ? [
    { label: 'Cultural',      value: poi.cultural_score,      color: PURPLE },
    { label: 'Food',          value: poi.food_score,          color: ORANGE },
    { label: 'Outdoor',       value: poi.outdoor_score,       color: GREEN  },
    { label: 'Architecture',  value: poi.architecture_score,  color: BLUE   },
    { label: 'Shopping',      value: poi.shopping_score,      color: YELLOW },
    { label: 'Nightlife',     value: poi.nightlife_score,     color: '#EC4899' },
    { label: 'Nature',        value: poi.nature_score,        color: '#14B8A6' },
  ] : [];

  return (
    <div style={{ marginBottom: 28 }}>
      <p style={sectionTitle}>POI lookup</p>

      {/* Search bar with dropdown */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Search by POI name or ID…"
            value={query}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={handleKey}
            onFocus={() => results.length && setShowDrop(true)}
            onBlur={() => setTimeout(() => setShowDrop(false), 150)}
            style={{ flex: 1, padding: '7px 12px', fontSize: 13, border: '0.5px solid #b4b2a9', borderRadius: 7, fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
          />
          <button
            onClick={() => { setShowDrop(false); if (results.length === 1) { selectPoi(results[0]); } else { const exact = allPois.find(p => p.name.toLowerCase() === query.toLowerCase()); if (exact) loadPoi(exact.id); else if (query.trim()) loadPoi(query.trim()); }}}
            disabled={loading}
            style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, background: BLUE, color: '#fff', border: 'none', borderRadius: 7, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Loading…' : 'Search'}
          </button>
        </div>

        {/* Autocomplete dropdown */}
        {showDrop && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 48, background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden', marginTop: 4 }}>
            {results.map(p => (
              <div
                key={p.id}
                onMouseDown={() => selectPoi(p)}
                style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 10, borderBottom: '0.5px solid #f0ede8' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8f7f4'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_COLORS[p.category] || '#9CA3AF', flexShrink: 0 }} />
                <span style={{ fontWeight: 500, color: '#1a1a18', flex: 1 }}>{p.name}</span>
                <span style={{ fontSize: 10, color: '#888780', background: '#f0ede8', borderRadius: 20, padding: '1px 7px' }}>{p.category}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p style={{ fontSize: 13, color: ORANGE, background: '#FFF7F0', border: '0.5px solid #FDDCB5', borderRadius: 7, padding: '10px 14px', margin: '0 0 16px' }}>{error}</p>
      )}

      {poi && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Header KPIs ── */}
          <div style={{ background: '#fff', border: '0.5px solid #e0ddd6', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: CAT_COLORS[poi.category] || '#9CA3AF', flexShrink: 0 }} />
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a18', margin: 0 }}>{poi.name}</p>
              <span style={{ fontSize: 11, fontWeight: 600, background: (CAT_COLORS[poi.category] || '#9CA3AF') + '18', color: CAT_COLORS[poi.category] || '#9CA3AF', borderRadius: 20, padding: '2px 9px' }}>{poi.category}</span>
              {poi.local_favourite && <span style={{ fontSize: 10, fontWeight: 600, background: '#FEF3C7', color: '#92400E', borderRadius: 20, padding: '2px 9px' }}>⭐ Local favourite</span>}
              {poi.is_overtouristed && <span style={{ fontSize: 10, fontWeight: 600, background: '#FEE2E2', color: '#991B1B', borderRadius: 20, padding: '2px 9px' }}>⚠ Overtouristed</span>}
            </div>

            {poi.description && (
              <p style={{ fontSize: 12, color: '#5F5E5A', margin: '0 0 14px', lineHeight: 1.6 }}>{poi.description}</p>
            )}

            <div style={kpiRow}>
              {poi.google_rating != null && (
                <StatCard label="Google rating" value={`${poi.google_rating.toFixed(1)} / 5`} color={YELLOW} sub={poi.review_count ? `${poi.review_count.toLocaleString()} reviews` : undefined} />
              )}
              <StatCard label="Avg visit"      value={`${poi.avg_visit_duration_hours}h`}   color={BLUE}   />
              <StatCard label="Entry price"    value={poi.entry_price_eur === 0 ? 'Free' : `€${poi.entry_price_eur}`} color={poi.entry_price_eur === 0 ? GREEN : ORANGE} />
              <StatCard label="Crowd level"    value={`${(poi.avg_crowd_level * 100).toFixed(0)}%`} color={poi.avg_crowd_level > 0.7 ? ORANGE : GREEN} sub="avg occupancy" />
              <StatCard label="Sustainability" value={`${(poi.sustainability_score * 10).toFixed(1)}/10`} color={GREEN} />
            </div>
          </div>

          <div style={twoCol}>
            {/* ── Location & logistics ── */}
            <div style={{ background: '#fff', border: '0.5px solid #e0ddd6', borderRadius: 10, padding: '14px 18px' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#888780', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Location & logistics</p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginBottom: 14 }}>
                {[
                  ['Neighbourhood', poi.neighborhood || '—'],
                  ['District',      poi.district     || '—'],
                  ['Address',       poi.address      || '—'],
                  ['Coordinates',   `${poi.lat.toFixed(5)}, ${poi.lng.toFixed(5)}`],
                  ['Opening hours', poi.opening_hours || '—'],
                  ['Booking req.',  poi.requires_booking ? 'Yes' : 'No'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span style={{ fontSize: 10, color: '#888780' }}>{k}</span>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#1a1a18', margin: '1px 0 0', maxWidth: 200 }}>{v}</p>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: 10, color: '#888780', fontWeight: 600, margin: '0 0 8px' }}>Accessibility & suitability</p>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                <BoolPill label="Wheelchair"    value={poi.wheelchair_accessible} />
                <BoolPill label="Kid-friendly"  value={poi.kid_friendly} />
                <BoolPill label="Senior-friendly" value={poi.senior_friendly} />
                <BoolPill label="Requires booking" value={poi.requires_booking} />
              </div>

              {poi.tags?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ fontSize: 10, color: '#888780', fontWeight: 600, margin: '0 0 6px' }}>Tags</p>
                  <div>{poi.tags.map(t => (
                    <span key={t} style={{ background: '#F0EDE8', color: '#5F5E5A', fontSize: 10, fontWeight: 500, borderRadius: 20, padding: '2px 8px', display: 'inline-block', margin: '2px 3px 2px 0' }}>{t}</span>
                  ))}</div>
                </div>
              )}
              <div style={{ marginTop: 14 }}>
                <img 
                  src={`/images/poi-${poi.id}.jpg`} 
                  alt={poi.name || "Point of interest"} 
                  style={{ 
                    width: '100%', 
                    height: 'auto', 
                    borderRadius: '8px',
                    display: 'block' 
                  }} 
                  // It is good practice to add an error handler in case the image file is missing
                  onError={(e) => { e.target.src = '/images/placeholder.jpg'; }} 
                />
              </div>
            </div>

            {/* ── Score profile ── */}
            <div style={{ background: '#fff', border: '0.5px solid #e0ddd6', borderRadius: 10, padding: '14px 18px' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#888780', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Experience scores</p>
              {scoreFields.map(({ label, value, color }) => (
                <GaugeBar key={label} label={label} value={value} max={1} color={color} format={v => v.toFixed(2)} />
              ))}

              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 10, color: '#888780', fontWeight: 600, margin: '0 0 8px' }}>Crowd & sustainability</p>
                <GaugeBar label="Crowd level"       value={poi.avg_crowd_level}      max={1} color={poi.avg_crowd_level > 0.7 ? ORANGE : GREEN} format={v => `${(v*100).toFixed(0)}%`} />
                <GaugeBar label="Sustainability"     value={poi.sustainability_score} max={1} color={GREEN} format={v => v.toFixed(2)} />
              </div>

              {/* Radar-style score summary */}
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 10, color: '#888780', fontWeight: 600, margin: '0 0 8px' }}>Score overview</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {scoreFields.filter(s => s.value > 0).map(({ label, value, color }) => (
                    <div key={label} style={{ textAlign: 'center', background: color + '12', border: `0.5px solid ${color}40`, borderRadius: 8, padding: '6px 10px', minWidth: 60 }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color, margin: 0 }}>{(value * 10).toFixed(1)}</p>
                      <p style={{ fontSize: 9, color: '#888780', margin: '2px 0 0' }}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{ background: '#fff', border: '0.5px solid #e0ddd6', borderRadius: 10, padding: '14px 18px' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#888780', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Visit evolution (9h - 21h)
            </p>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0ede8" />
                  <XAxis type="number" dataKey="hour" name="Hour" domain={[9, 21]} tick={{ fontSize: 10 }} tickCount={13} />
                  <YAxis type="number" dataKey="visits" name="Visits" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter name="Visits" data={visitData} fill={BLUE} line shape="circle" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sentiment badge ───────────────────────────────────────────────────────────

function SentimentBadge({ value }) {
  const colors = {
    very_positive: { bg: '#D1FAE5', text: '#065F46' },
    positive:      { bg: '#D1FAE5', text: '#1D9E75' },
    neutral:       { bg: '#FEF3C7', text: '#92400E' },
    negative:      { bg: '#FFEDD5', text: '#C2410C' },
    very_negative: { bg: '#FEE2E2', text: '#991B1B' },
  };
  const c = colors[value] || { bg: '#F3F4F6', text: '#6B7280' };
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '2px 9px', display: 'inline-block' }}>
      {value?.replace(/_/g, ' ')}
    </span>
  );
}

// ── Tag pill ──────────────────────────────────────────────────────────────────

function Tag({ label, color = BLUE }) {
  return (
    <span style={{ background: color + '18', color, fontSize: 10, fontWeight: 600, borderRadius: 20, padding: '2px 8px', display: 'inline-block', margin: '2px 3px 2px 0' }}>
      {label}
    </span>
  );
}

// ── Agent lookup panel ────────────────────────────────────────────────────────

function AgentLookup() {
  const [inputId, setInputId]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [data, setData]         = useState(null);

  function search() {
    const id = parseInt(inputId, 10);
    if (isNaN(id)) { setError('Please enter a valid numeric agent ID.'); return; }
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/agents/${id}`)
      .then(r => {
        if (!r.ok) return r.json().then(b => { throw new Error(b.detail || `Error ${r.status}`); });
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  function handleKey(e) { if (e.key === 'Enter') search(); }

  const { agent, profile, sentiment, events } = data || {};

  return (
    <div style={{ marginBottom: 28 }}>
      <p style={sectionTitle}>Agent lookup</p>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          type="number"
          min={0}
          placeholder="Enter agent ID…"
          value={inputId}
          onChange={e => setInputId(e.target.value)}
          onKeyDown={handleKey}
          style={{ flex: 1, padding: '7px 12px', fontSize: 13, border: '0.5px solid #b4b2a9', borderRadius: 7, fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
        />
        <button
          onClick={search}
          disabled={loading}
          style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, background: GREEN, color: '#fff', border: 'none', borderRadius: 7, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Loading…' : 'Search'}
        </button>
      </div>

      {error && (
        <p style={{ fontSize: 13, color: ORANGE, background: '#FFF7F0', border: '0.5px solid #FDDCB5', borderRadius: 7, padding: '10px 14px', margin: '0 0 16px' }}>{error}</p>
      )}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Summary KPIs ── */}
          <div style={{ background: '#fff', border: '0.5px solid #e0ddd6', borderRadius: 10, padding: '14px 18px' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#888780', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Agent #{agent.agent_id} — {agent.strategy} strategy
            </p>
            <div style={kpiRow}>
              <StatCard label="Nationality"    value={agent.nationality} />
              <StatCard label="POIs visited"   value={agent.pois_visited} color={GREEN} />
              <StatCard label="Money spent"    value={`€${agent.money_spent.toFixed(0)}`} color={ORANGE} />
              <StatCard label="Fatigue"        value={agent.fatigue.toFixed(2)} sub="0–1 scale" />
              <StatCard label="Satisfaction"   value={agent.satisfaction.toFixed(2)} color={BLUE} />
              <StatCard label="Hours used"     value={`${agent.hours_used.toFixed(1)}h`} color={PURPLE} />
            </div>
          </div>

          <div style={twoCol}>
            {/* ── Profile ── */}
            {profile && (
              <div style={{ background: '#fff', border: '0.5px solid #e0ddd6', borderRadius: 10, padding: '14px 18px' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#888780', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Profile</p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', marginBottom: 12 }}>
                  {[
                    ['Age',           profile.age],
                    ['Group size',    profile.group_size],
                    ['Budget',        profile.budget_level],
                    ['Daily budget',  `€${profile.daily_budget_eur}/day`],
                    ['Mobility',      profile.mobility_mode],
                    ['Walking tol.',  profile.walking_tolerance],
                    ['Max walk',      `${profile.max_walking_distance_km} km`],
                    ['Trip length',   `${profile.trip_length_days} day${profile.trip_length_days !== 1 ? 's' : ''}`],
                    ['Kids',          profile.travel_with_kids ? 'Yes' : 'No'],
                    ['Seniors',       profile.travel_with_seniors ? 'Yes' : 'No'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <span style={{ fontSize: 10, color: '#888780' }}>{k}</span>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18', margin: '1px 0 0' }}>{v}</p>
                    </div>
                  ))}
                </div>

                {profile.interests?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 10, color: '#888780', margin: '0 0 5px' }}>Interests</p>
                    <div>{profile.interests.map(i => <Tag key={i} label={i} color={BLUE} />)}</div>
                  </div>
                )}

                <p style={{ fontSize: 10, color: '#888780', margin: '0 0 8px' }}>Preference scores</p>
                {[
                  ['Cultural',      profile.cultural_interest,       PURPLE],
                  ['Food',          profile.food_interest,           ORANGE],
                  ['Outdoor',       profile.outdoor_preference,      GREEN],
                  ['Architecture',  profile.architecture_interest,   BLUE],
                  ['Shopping',      profile.shopping_interest,       YELLOW],
                  ['Nightlife',     profile.nightlife_interest,      '#EC4899'],
                  ['Nature',        profile.nature_interest,         '#14B8A6'],
                  ['Novelty',       profile.novelty_seeking,         '#6366F1'],
                  ['Crowd aversion',profile.crowd_aversion,          ORANGE],
                ].map(([label, value, color]) => (
                  <GaugeBar key={label} label={label} value={value} max={1} color={color} format={v => v.toFixed(2)} />
                ))}
              </div>
            )}

            {/* ── Sentiment ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sentiment ? (
                <div style={{ background: '#fff', border: '0.5px solid #e0ddd6', borderRadius: 10, padding: '14px 18px' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#888780', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Trip sentiment</p>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                    <SentimentBadge value={sentiment.overall_sentiment} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>{sentiment.overall_score.toFixed(1)}/10</span>
                    {sentiment.would_recommend && <Tag label="Would recommend" color={GREEN} />}
                    {sentiment.would_return    && <Tag label="Would return"    color={BLUE} />}
                  </div>

                  <p style={{ fontSize: 12, color: '#5F5E5A', margin: '0 0 12px', lineHeight: 1.5 }}>{sentiment.summary}</p>

                  <div style={twoCol}>
                    <div>
                      <p style={{ fontSize: 10, color: '#888780', fontWeight: 600, margin: '0 0 6px' }}>✦ Highlights</p>
                      {sentiment.highlights.map((h, i) => (
                        <p key={i} style={{ fontSize: 11, color: '#1a1a18', margin: '0 0 4px', paddingLeft: 8, borderLeft: `2px solid ${GREEN}` }}>{h}</p>
                      ))}
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: '#888780', fontWeight: 600, margin: '0 0 6px' }}>⚠ Pain points</p>
                      {sentiment.pain_points.map((p, i) => (
                        <p key={i} style={{ fontSize: 11, color: '#1a1a18', margin: '0 0 4px', paddingLeft: 8, borderLeft: `2px solid ${ORANGE}` }}>{p}</p>
                      ))}
                    </div>
                  </div>

                  {sentiment.emotional_arc && (
                    <p style={{ fontSize: 11, color: '#5F5E5A', marginTop: 10 }}>
                      <span style={{ fontWeight: 600 }}>Emotional arc:</span> {sentiment.emotional_arc.replace(/_/g, ' ')}
                    </p>
                  )}

                  {sentiment.suggested_improvements?.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <p style={{ fontSize: 10, color: '#888780', fontWeight: 600, margin: '0 0 6px' }}>Suggested improvements</p>
                      {sentiment.suggested_improvements.map((s, i) => (
                        <p key={i} style={{ fontSize: 11, color: '#5F5E5A', margin: '0 0 3px' }}>· {s}</p>
                      ))}
                    </div>
                  )}

                  {/* Per-POI sentiment table */}
                  {sentiment.poi_sentiments?.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <p style={{ fontSize: 10, color: '#888780', fontWeight: 600, margin: '0 0 8px' }}>POI sentiments</p>
                      <div style={tableWrap}>
                        <table style={tableStyle}>
                          <thead>
                            <tr>
                              <th style={th}>POI</th>
                              <th style={th}>Sentiment</th>
                              <th style={th}>Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sentiment.poi_sentiments.map((p, i) => (
                              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafaf8' }}>
                                <td style={td}>{p.poi_name}</td>
                                <td style={td}><SentimentBadge value={p.sentiment} /></td>
                                <td style={{ ...td, whiteSpace: 'normal', maxWidth: 220, fontSize: 11, color: '#5F5E5A' }}>{p.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: '#fff', border: '0.5px solid #e0ddd6', borderRadius: 10, padding: '14px 18px' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#888780', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Trip sentiment</p>
                  <p style={{ fontSize: 12, color: '#b4b2a9', margin: 0 }}>No sentiment data available for this agent.</p>
                </div>
              )}

              {/* Itinerary */}
              {agent.itinerary?.length > 0 && (
                <div style={{ background: '#fff', border: '0.5px solid #e0ddd6', borderRadius: 10, padding: '14px 18px' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#888780', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Itinerary ({agent.itinerary.length} stops)</p>
                  <ol style={{ margin: 0, paddingLeft: 18 }}>
                    {agent.itinerary.map((stop, i) => (
                      <li key={i} style={{ fontSize: 12, color: '#1a1a18', marginBottom: 4, paddingLeft: 4 }}>{stop}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>

          {/* ── Event log ── */}
          {events?.length > 0 && (
            <div style={{ background: '#fff', border: '0.5px solid #e0ddd6', borderRadius: 10, padding: '14px 18px' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#888780', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Event log ({events.length} entries)</p>
              <div style={{ maxHeight: 200, overflowY: 'auto', fontFamily: "'DM Mono', monospace", fontSize: 11, lineHeight: 1.7 }}>
                {events.map((e, i) => (
                  <p key={i} style={{ margin: 0, color: i % 2 === 0 ? '#1a1a18' : '#5F5E5A', padding: '1px 0', borderBottom: '0.5px solid #f4f3f0' }}>{e}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
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
  
  // ── Sentiment Scatter data — fetched from /api/sentiment-scatter ─────────
  const [sentimentScatter, setSentimentScatter] = useState(null);
  const [sentimentScatterError, setSentimentScatterError] = useState(null);

  useEffect(() => {
    // Fetch visit metrics
    fetch('/api/visit-metrics')
      .then(r => {
        if (!r.ok) throw new Error(r.status === 503 ? 'Run a simulation first.' : `Server error ${r.status}`);
        return r.json();
      })
      .then(d => setVisitMetrics(d))
      .catch(e => setVisitMetricsError(e.message));

    // Fetch sentiment scatter data
    fetch('/api/sentiment-scatter')
      .then(r => {
        if (!r.ok) throw new Error(r.status === 503 ? 'Run a sentiment simulation first.' : `Server error ${r.status}`);
        return r.json();
      })
      .then(d => setSentimentScatter(d))
      .catch(e => setSentimentScatterError(e.message));
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

      {/* ── Emotional arc & Sentiment Trend layout ── */}
      <div style={twoCol}>
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

        <Section title="Average Sentiment by Visit Order">
          {sentimentScatterError ? (
            <p style={{ fontSize: 12, color: ORANGE }}>{sentimentScatterError}</p>
          ) : !sentimentScatter ? (
            <p style={{ fontSize: 12, color: '#888780' }}>Loading sentiment trend…</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <ScatterChart margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis 
                  type="number" 
                  dataKey="step" 
                  name="Visit Order" 
                  domain={['dataMin', 'dataMax']} 
                  tickCount={sentimentScatter.length}
                  tick={{ fontSize: 11 }} 
                  label={{ value: 'Ordinal Step', position: 'insideBottom', offset: -2, fontSize: 11 }} 
                />
                <YAxis 
                  type="number" 
                  dataKey="average_sentiment" 
                  name="Avg Sentiment" 
                  domain={[1, 5]} 
                  ticks={[1, 2, 3, 4, 5]} 
                  tick={{ fontSize: 11 }} 
                  label={{ value: 'Avg Sentiment', angle: -90, position: 'insideLeft', fontSize: 11 }} 
                />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value, name) => [value, name]} />
                {/* Passing a line object draws the connecting lines between scatter points */}
                <Scatter data={sentimentScatter} fill={PURPLE} line={{ stroke: PURPLE, strokeWidth: 2 }} shape="circle" />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* ── Evaluation & fairness metrics ── */}
      <Section title="Evaluation & fairness metrics">
        <EvaluationMetrics />
      </Section>

      {/* ── Agent lookup ── */}
      <AgentLookup />

      {/* ── POI lookup ── */}
      <POILookup />
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