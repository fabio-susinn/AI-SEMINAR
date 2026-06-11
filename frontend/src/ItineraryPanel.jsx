import React, { useState, useEffect, useCallback } from 'react';

const GREEN  = '#1D9E75';
const ORANGE = '#D85A30';
const GRAY   = '#888780';

const CATEGORY_COLORS = {
  museum:        '#3B82F6',
  monument:      '#8B5CF6',
  park:          '#22C55E',
  beach:         '#06B6D4',
  market:        '#F59E0B',
  restaurant:    '#EF4444',
  bar:           '#F97316',
  nightlife:     '#EC4899',
  shop:          '#A855F7',
  viewpoint:     '#14B8A6',
  religious:     '#6366F1',
  architecture:  '#D97706',
  neighbourhood: '#84CC16',
  transport_hub: '#64748B',
  other:         '#9CA3AF',
};

function fmtH(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export default function ItineraryPanel({ agents, pois, onHighlightSteps }) {
  const [agentId, setAgentId]         = useState('');
  const [itinerary, setItinerary]     = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [activeStep, setActiveStep]   = useState(null);

  const fetchItinerary = useCallback(async (id) => {
    if (id === '' || id === null || id === undefined) return;
    setLoading(true);
    setError(null);
    setItinerary(null);
    setActiveStep(null);
    try {
      const res = await fetch(`/api/agents/${id}/itinerary`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setItinerary(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // When a step is clicked, highlight it on the map
  const handleStepClick = (step) => {
    const isActive = activeStep?.order === step.order;
    const next = isActive ? null : step;
    setActiveStep(next);
    if (onHighlightSteps) onHighlightSteps(next ? [step] : []);
  };

  // When itinerary loads, show all steps on map
  useEffect(() => {
    if (itinerary && onHighlightSteps) {
      onHighlightSteps(itinerary.itinerary);
    }
    return () => { if (onHighlightSteps) onHighlightSteps([]); };
  }, [itinerary]);

  const agent = agents?.find(a => a.agent_id === parseInt(agentId));

  return (
    <div style={container}>

      {/* ── Agent selector ── */}
      <div style={selectorRow}>
        <div style={{ flex: 1 }}>
          <p style={sectionLabel}>Select agent</p>
          <select
            value={agentId}
            onChange={e => setAgentId(e.target.value)}
            style={selectStyle}
          >
            <option value="">— choose an agent —</option>
            {(agents || []).map(a => (
              <option key={a.agent_id} value={a.agent_id}>
                Agent #{a.agent_id} · {a.nationality} · {a.pois_visited} POIs
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => fetchItinerary(agentId)}
          disabled={agentId === '' || loading}
          style={{ ...fetchBtn, opacity: agentId === '' || loading ? 0.5 : 1 }}
        >
          {loading ? '…' : 'Load'}
        </button>
      </div>

      {/* ── Agent quick stats ── */}
      {agent && (
        <div style={agentCard}>
          <div style={agentStat}><span style={statLabel}>Nationality</span>{agent.nationality}</div>
          <div style={agentStat}><span style={statLabel}>POIs</span>{agent.pois_visited}</div>
          <div style={agentStat}><span style={statLabel}>Spent</span>€{agent.money_spent.toFixed(0)}</div>
          <div style={agentStat}><span style={statLabel}>Fatigue</span>{agent.fatigue.toFixed(2)}</div>
        </div>
      )}

      {error && <div style={errorBox}>{error}</div>}

      {/* ── Itinerary steps ── */}
      {itinerary && (
        <>
          <p style={sectionLabel}>
            Itinerary · {itinerary.itinerary.length} stops
          </p>

          <div style={stepsContainer}>
            {itinerary.itinerary.map((step, i) => {
              const isActive  = activeStep?.order === step.order;
              const catColor  = CATEGORY_COLORS[step.category] || '#9CA3AF';
              const isLast    = i === itinerary.itinerary.length - 1;

              return (
                <div key={step.order} style={{ position: 'relative' }}>

                  {/* Connector line */}
                  {!isLast && (
                    <div style={{
                      position: 'absolute', left: 15, top: 32, width: 2,
                      height: 'calc(100% - 8px)', background: '#e8e6e0', zIndex: 0,
                    }} />
                  )}

                  <div
                    onClick={() => handleStepClick(step)}
                    style={{
                      ...stepRow,
                      background: isActive ? '#F4FBF8' : '#fff',
                      border: isActive ? `0.5px solid ${GREEN}` : '0.5px solid #e8e6e0',
                      cursor: 'pointer',
                    }}
                  >
                    {/* Step number bubble */}
                    <div style={{ ...stepBubble, background: catColor, zIndex: 1 }}>
                      {step.order + 1}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <p style={stepName}>{step.poi_name}</p>
                        <span style={stepTime}>{step.timestamp}</span>
                      </div>
                      <div style={stepMeta}>
                        <span style={{ ...catTag, background: catColor + '20', color: catColor }}>
                          {step.category}
                        </span>
                        {step.price > 0 && <span style={metaBadge}>€{step.price.toFixed(0)}</span>}
                        <span style={{ ...metaBadge, background: crowdColor(step.crowd) + '20', color: crowdColor(step.crowd) }}>
                          crowd {(step.crowd * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!itinerary && !loading && !error && (
        <div style={emptyState}>
          Select an agent and click Load to see their itinerary on the map.
        </div>
      )}
    </div>
  );
}

function crowdColor(crowd) {
  if (crowd < 0.4) return '#22C55E';
  if (crowd < 0.7) return '#F59E0B';
  return '#EF4444';
}

// ── Styles ────────────────────────────────────────────────────────────────────

const container      = { padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto', fontFamily: "'DM Sans', sans-serif" };
const selectorRow    = { display: 'flex', gap: 8, alignItems: 'flex-end' };
const sectionLabel   = { fontSize: 11, color: GRAY, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' };
const selectStyle    = { width: '100%', padding: '6px 8px', fontSize: 12, border: '0.5px solid #b4b2a9', borderRadius: 6, fontFamily: "'DM Sans', sans-serif", background: '#fff' };
const fetchBtn       = { padding: '6px 14px', fontSize: 12, fontWeight: 500, background: GREEN, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'flex-end', marginBottom: 0 };
const agentCard      = { display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 12px', background: '#f8f7f4', border: '0.5px solid #e0ddd6', borderRadius: 8 };
const agentStat      = { display: 'flex', flexDirection: 'column', fontSize: 12, color: '#1a1a18', flex: '1 1 60px' };
const statLabel      = { fontSize: 10, color: GRAY, fontWeight: 500, marginBottom: 1 };
const errorBox       = { padding: '8px 12px', background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 6, fontSize: 12, color: '#A32D2D' };
const stepsContainer = { display: 'flex', flexDirection: 'column', gap: 6 };
const stepRow        = { display: 'flex', gap: 10, padding: '10px 10px 10px 8px', borderRadius: 8, transition: 'all 0.1s', alignItems: 'flex-start', position: 'relative' };
const stepBubble     = { width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: 1 };
const stepName       = { fontSize: 12, fontWeight: 500, color: '#1a1a18', margin: 0, lineHeight: 1.3 };
const stepTime       = { fontSize: 11, color: GRAY, whiteSpace: 'nowrap', marginLeft: 8, flexShrink: 0 };
const stepMeta       = { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 };
const catTag         = { fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 500 };
const metaBadge      = { fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#f0ede8', color: GRAY };
const emptyState     = { fontSize: 12, color: GRAY, textAlign: 'center', padding: '24px 16px', background: '#f8f7f4', borderRadius: 8 };
