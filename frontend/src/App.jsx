import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import Statistics from './Statistics';
import ItineraryPanel from './ItineraryPanel';

const DAY_START = 9;
const DAY_END   = 21;

function fmtHour(h) {
  const hh = Math.floor(h);
  const mm  = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
}

const CAT_COLORS = {
  museum:'#3B82F6', monument:'#8B5CF6', park:'#22C55E', beach:'#06B6D4',
  market:'#F59E0B', restaurant:'#EF4444', bar:'#F97316', nightlife:'#EC4899',
  shop:'#A855F7', viewpoint:'#14B8A6', religious:'#6366F1', architecture:'#D97706',
  neighbourhood:'#84CC16', transport_hub:'#64748B', other:'#9CA3AF',
};

export default function App() {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const [mapReady, setMapReady]   = useState(false);
  const [activeTab, setActiveTab] = useState('map');
  const [pois, setPois]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  // Simulation
  const [simOpen, setSimOpen]       = useState(false);
  const [simParams, setSimParams]   = useState({ agents:10, seed:42, workers:3, no_sentiment:false });
  const [simRunning, setSimRunning] = useState(false);
  const [simResults, setSimResults] = useState(null);
  const [simError, setSimError]     = useState(null);

  // Selected agent for single-agent view
  const [focusAgentId, setFocusAgentId]       = useState(null);   // null = population view
  const [focusItinerary, setFocusItinerary]   = useState(null);   // fetched from /api/agents/:id/itinerary
  const [itinLoading, setItinLoading]         = useState(false);
  const [itinError, setItinError]             = useState(null);

  // Time slider
  const [sliderTime, setSliderTime]       = useState(DAY_START);
  const [sliderActive, setSliderActive]   = useState(false);

  // Leaflet layer refs — cleared and redrawn on each relevant state change
  const popLayerRef    = useRef([]);   // population heatmap circles
  const agentLayerRef  = useRef([]);   // single-agent: edges + POI markers + moving dot

  // ── Map init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map(mapContainerRef.current, { center:[41.3974,2.1686], zoom:12, zoomControl:false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains:'abcd', maxZoom:19,
    }).addTo(map);
    L.control.zoom({ position:'bottomright' }).addTo(map);
    mapRef.current = map;
    setMapReady(true);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (activeTab === 'map' && mapRef.current)
      setTimeout(() => mapRef.current.invalidateSize(), 50);
  }, [activeTab]);

  // ── Fetch POIs ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/pois')
      .then(r => r.json())
      .then(d => { setPois(d); setLoading(false); })
      .catch(() => { setError('Could not load POIs.'); setLoading(false); });
  }, []);

  // ── Base POI dots (always visible) ───────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !pois.length || !mapRef.current) return;
    const map = mapRef.current;
    const lats = pois.map(p=>p.lat), lngs = pois.map(p=>p.lng);
    map.fitBounds([[Math.min(...lats),Math.min(...lngs)],[Math.max(...lats),Math.max(...lngs)]], { padding:[40,40] });
    const markers = pois.map(poi =>
      L.circleMarker([poi.lat, poi.lng], { radius:4, fillColor:'#D85A30', color:'#7A2A10', weight:1, fillOpacity:0.6 })
        .bindTooltip(poi.name).addTo(map)
    );
    return () => markers.forEach(m => m.remove());
  }, [mapReady, pois]);

  // ── Clear a layer ref ─────────────────────────────────────────────────────────
  const clearLayer = (ref) => { ref.current.forEach(m => m.remove()); ref.current = []; };

  // ── POPULATION layer (shown when no agent focused) ────────────────────────────
  const drawPopulation = useCallback(() => {
    if (!mapRef.current || !simResults?.poi_states) return;
    clearLayer(popLayerRef);
    if (focusAgentId !== null) return;   // agent view — hide population
    const map = mapRef.current;

    if (sliderActive) {
      // time-slice: how many agents visiting each POI at sliderTime
      const counts = {};
      simResults.poi_states.forEach(state => {
        const n = (state.visit_times || []).filter(t => sliderTime >= t && sliderTime < t + 1.5).length;
        if (n > 0) counts[state.poi_name] = n;
      });
      const maxN = Math.max(...Object.values(counts), 1);
      Object.entries(counts).forEach(([name, n]) => {
        const poi = pois.find(p => p.name === name);
        if (!poi) return;
        const m = L.circleMarker([poi.lat, poi.lng], {
          radius: 5 + (n/maxN)*16, fillColor:'#3B82F6', color:'#1D4ED8', weight:1.5, fillOpacity:0.6,
        }).bindTooltip(`${name}<br/>${n} agent${n>1?'s':''} at ${fmtHour(sliderTime)}`).addTo(map);
        popLayerRef.current.push(m);
      });
    } else {
      // total visit density
      const maxV = Math.max(...simResults.poi_states.map(s=>s.total_visits), 1);
      simResults.poi_states.forEach(state => {
        if (!state.total_visits) return;
        const poi = pois.find(p => p.name === state.poi_name);
        if (!poi) return;
        const m = L.circleMarker([poi.lat, poi.lng], {
          radius: 4+(state.total_visits/maxV)*18, fillColor:'#1D9E75', color:'#085041', weight:1.5, fillOpacity:0.55,
        }).bindTooltip(`${state.poi_name}<br/>visits: ${state.total_visits} · peak: ${state.peak_hour??'n/a'}h`).addTo(map);
        popLayerRef.current.push(m);
      });
    }
  }, [simResults, pois, focusAgentId, sliderActive, sliderTime]);

  useEffect(() => { drawPopulation(); }, [drawPopulation]);

  // ── Fetch single-agent itinerary ──────────────────────────────────────────────
  useEffect(() => {
    if (focusAgentId === null) {
      setFocusItinerary(null);
      clearLayer(agentLayerRef);
      return;
    }
    setItinLoading(true);
    setItinError(null);
    fetch(`/api/agents/${focusAgentId}/itinerary`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => setFocusItinerary(data))
      .catch(e => setItinError(e.message))
      .finally(() => setItinLoading(false));
  }, [focusAgentId]);

  // ── AGENT layer: edges + numbered POI markers ─────────────────────────────────
  useEffect(() => {
    clearLayer(agentLayerRef);
    if (!focusItinerary || !mapRef.current) return;
    const map   = mapRef.current;
    const steps = focusItinerary.itinerary;
    const latLngs = [];

    steps.forEach(step => {
      const poi = pois.find(p => p.name === step.poi_name);
      if (!poi) return;
      latLngs.push([poi.lat, poi.lng]);
    });

    // Edges (polyline between consecutive POIs)
    for (let i = 0; i < latLngs.length - 1; i++) {
      const mid = [
        (latLngs[i][0] + latLngs[i+1][0]) / 2,
        (latLngs[i][1] + latLngs[i+1][1]) / 2,
      ];
      const line = L.polyline([latLngs[i], latLngs[i+1]], {
        color:'#1D9E75', weight:2.5, dashArray:'5 6', opacity:0.75,
      }).addTo(map);
      agentLayerRef.current.push(line);

      // Edge label (order number on the midpoint)
      const edgeIcon = L.divIcon({
        html:`<div style="background:#1D9E75;color:#fff;border-radius:10px;padding:1px 5px;font-size:9px;font-weight:700;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2)">${i+1}→${i+2}</div>`,
        iconSize:[28,16], iconAnchor:[14,8], className:'',
      });
      const el = L.marker(mid, { icon:edgeIcon, zIndexOffset:500, interactive:false }).addTo(map);
      agentLayerRef.current.push(el);
    }

    // POI markers (numbered circles, color by category)
    steps.forEach(step => {
      const poi = pois.find(p => p.name === step.poi_name);
      if (!poi) return;
      const color = CAT_COLORS[step.category] || '#9CA3AF';

      // Outer circle
      const c = L.circleMarker([poi.lat, poi.lng], {
        radius:10, fillColor:color, color:'#fff', weight:2, fillOpacity:0.85, zIndexOffset:600,
      }).bindTooltip(`<b>#${step.order+1} ${step.poi_name}</b><br/>${step.timestamp} · ${step.category}<br/>€${step.price} · crowd ${(step.crowd*100).toFixed(0)}%`)
        .addTo(map);
      agentLayerRef.current.push(c);

      // Number label on top
      const icon = L.divIcon({
        html:`<div style="color:#fff;font-size:9px;font-weight:800;text-align:center;line-height:20px">${step.order+1}</div>`,
        iconSize:[20,20], iconAnchor:[10,10], className:'',
      });
      const lbl = L.marker([poi.lat, poi.lng], { icon, zIndexOffset:700, interactive:false }).addTo(map);
      agentLayerRef.current.push(lbl);
    });

    // Fit map to itinerary
    if (latLngs.length > 1) {
      map.fitBounds(latLngs, { padding:[50,50] });
    } else if (latLngs.length === 1) {
      map.setView(latLngs[0], 15);
    }
  }, [focusItinerary, pois]);

  // ── Moving dot on time slider (agent mode only) ───────────────────────────────
  const movingDotRef = useRef(null);

  useEffect(() => {
    if (movingDotRef.current) { movingDotRef.current.remove(); movingDotRef.current = null; }
    if (!sliderActive || !focusItinerary || !mapRef.current) return;

    const steps = focusItinerary.itinerary;
    const map   = mapRef.current;

    // Find which step the agent is on at sliderTime
    // Steps are sorted by order; agent is "at" step i if sliderTime is between arrival and next arrival
    let pos = null;
    let label = '';

    for (let i = 0; i < steps.length; i++) {
      const arrive  = steps[i].arrival_h;
      const depart  = i < steps.length - 1 ? steps[i+1].arrival_h : arrive + 1.5;

      if (sliderTime >= arrive && sliderTime < depart) {
        if (sliderTime < arrive + steps[i].avg_dwell ?? 1) {
          // Still visiting this POI
          const poi = pois.find(p => p.name === steps[i].poi_name);
          if (poi) { pos = [poi.lat, poi.lng]; label = `At: ${steps[i].poi_name}`; }
        } else {
          // Travelling to next POI — interpolate position
          const next = steps[i+1];
          if (!next) {
            const poi = pois.find(p => p.name === steps[i].poi_name);
            if (poi) { pos = [poi.lat, poi.lng]; label = `Leaving ${steps[i].poi_name}`; }
          } else {
            const fromPoi = pois.find(p => p.name === steps[i].poi_name);
            const toPoi   = pois.find(p => p.name === next.poi_name);
            if (fromPoi && toPoi) {
              const t = (sliderTime - arrive) / (depart - arrive);
              pos = [
                fromPoi.lat + (toPoi.lat - fromPoi.lat) * t,
                fromPoi.lng + (toPoi.lng - fromPoi.lng) * t,
              ];
              label = `→ ${next.poi_name}`;
            }
          }
        }
        break;
      }
    }

    // Before first stop
    if (!pos && steps.length && sliderTime < steps[0].arrival_h) {
      const poi = pois.find(p => p.name === steps[0].poi_name);
      if (poi) { pos = [poi.lat, poi.lng]; label = `Heading to ${steps[0].poi_name}`; }
    }
    // After last stop
    if (!pos && steps.length && sliderTime >= steps[steps.length-1].arrival_h) {
      const poi = pois.find(p => p.name === steps[steps.length-1].poi_name);
      if (poi) { pos = [poi.lat, poi.lng]; label = 'Trip ended'; }
    }

    if (!pos) return;

    const icon = L.divIcon({
      html:`<div style="width:18px;height:18px;background:#F59E0B;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 2px #F59E0B,0 2px 8px rgba(0,0,0,0.3)"></div>`,
      iconSize:[18,18], iconAnchor:[9,9], className:'',
    });
    movingDotRef.current = L.marker(pos, { icon, zIndexOffset:1000 })
      .bindTooltip(`Agent #${focusAgentId} · ${fmtHour(sliderTime)}<br/>${label}`, { permanent:false })
      .addTo(map);
  }, [sliderTime, sliderActive, focusItinerary, pois, focusAgentId]);

  // ── Sim handlers ──────────────────────────────────────────────────────────────
  const handleRunSim = async () => {
    setSimRunning(true); setSimError(null); setSimResults(null);
    setFocusAgentId(null); setFocusItinerary(null);
    setSliderActive(false); setSliderTime(DAY_START);
    try {
      const res = await fetch('/api/simulate', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify(simParams),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail||'Failed'); }
      setSimResults(await res.json());
    } catch(e) { setSimError(e.message); }
    finally { setSimRunning(false); }
  };

  const handleClearSim = () => {
    setSimResults(null); setSimError(null);
    setFocusAgentId(null); setFocusItinerary(null);
    setSliderActive(false); setSliderTime(DAY_START);
    clearLayer(popLayerRef); clearLayer(agentLayerRef);
    if (movingDotRef.current) { movingDotRef.current.remove(); movingDotRef.current = null; }
  };

  const handleFocusAgent = (id) => {
    const val = id === '' ? null : parseInt(id);
    setFocusAgentId(val);
    setSliderTime(DAY_START);
    if (val === null) clearLayer(agentLayerRef);
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  const isAgentMode = focusAgentId !== null;

  return (
    <div style={{ position:'fixed', inset:0, display:'flex', flexDirection:'column', fontFamily:"'DM Sans',sans-serif" }}>

      {/* ── Navbar ── */}
      <div style={navbar}>
        <span style={navBrand}>🗺 Barcelona Simulation</span>
        <div style={tabGroup}>
          {['map','itinerary','stats'].map(tab => {
            const labels = { map:'Map', itinerary:'Itinerary', stats:'Statistics' };
            const disabled = tab !== 'map' && !simResults;
            return (
              <button key={tab}
                style={{ ...tabBtn, ...(activeTab===tab?tabBtnActive:{}), ...(disabled?{opacity:0.4,cursor:'not-allowed'}:{}) }}
                disabled={disabled} onClick={() => !disabled && setActiveTab(tab)}
              >
                {labels[tab]}
                {tab==='stats' && simResults && <span style={tabBadge}>{simResults.agents.length}</span>}
              </button>
            );
          })}
        </div>
        <div style={navRight}>
          {simResults && <span style={navInfo}>{simResults.agents.length} agents · {simResults.poi_states.filter(s=>s.total_visits>0).length} POIs visited</span>}
          <button onClick={() => setSimOpen(o=>!o)} style={greenBtn}>{simOpen?'✕ Close':'▶ Run Simulation'}</button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex:1, position:'relative', overflow:'hidden', display:'flex', flexDirection:'column' }}>

        {/* MAP TAB */}
        <div style={{ flex:1, position:'relative', display: activeTab==='stats' ? 'none' : 'flex', flexDirection:'column' }}>

          <div style={{ flex:1, position:'relative' }}>
            <div ref={mapContainerRef} style={fill} />

            {/* Info badge */}
            <div style={infoBadge}>
              <span style={{ fontWeight:500 }}>Barcelona POIs</span>
              <span style={{ color:'#888780' }}>{loading?' · Loading…':` · ${pois.length} POIs`}</span>
              {simResults && !isAgentMode && <span style={{ color:'#0F6E56' }}> · {simResults.agents.length} agents</span>}
              {isAgentMode && <span style={{ color:'#D97706' }}> · Agent #{focusAgentId}</span>}
              {error && <span style={{ color:'#A32D2D' }}> · {error}</span>}
            </div>

            {/* Legend */}
            {simResults && (
              <div style={legend}>
                <LegendDot color="#D85A30" label="POI" />
                {!isAgentMode && !sliderActive && <LegendDot color="#1D9E75" label="Visit density" />}
                {!isAgentMode && sliderActive  && <LegendDot color="#3B82F6" label={`Active at ${fmtHour(sliderTime)}`} />}
                {isAgentMode && <LegendDot color="#1D9E75" label="Itinerary path" />}
                {isAgentMode && sliderActive && <LegendDot color="#F59E0B" label="Agent position" />}
              </div>
            )}

            {/* Sim config panel */}
            {simOpen && (
              <div style={simPanel}>
                <p style={panelTitle}>Simulation parameters</p>
                <label style={labelSt}>Agents</label>
                <input type="number" min={1} max={200} value={simParams.agents} style={inputSt}
                  onChange={e=>setSimParams(p=>({...p,agents:parseInt(e.target.value)||1}))} />
                <label style={labelSt}>Seed <span style={{fontWeight:400,color:'#888780'}}>(blank = random)</span></label>
                <input type="number" value={simParams.seed??''} style={inputSt}
                  onChange={e=>setSimParams(p=>({...p,seed:e.target.value?parseInt(e.target.value):null}))} />
                <label style={labelSt}>Parallel workers</label>
                <input type="number" min={1} max={10} value={simParams.workers} style={inputSt}
                  onChange={e=>setSimParams(p=>({...p,workers:parseInt(e.target.value)||1}))} />
                <label style={{fontSize:12,display:'flex',alignItems:'center',cursor:'pointer',gap:8}}>
                  <input type="checkbox" checked={simParams.no_sentiment}
                    onChange={e=>setSimParams(p=>({...p,no_sentiment:e.target.checked}))} />
                  Skip LLM sentiment
                </label>
                <div style={{display:'flex',gap:8,marginTop:8}}>
                  <button onClick={handleRunSim} disabled={simRunning}
                    style={{flex:1,padding:'7px 0',fontSize:12,fontWeight:500,background:'#1D9E75',color:'#fff',border:'none',borderRadius:7,cursor:simRunning?'not-allowed':'pointer',opacity:simRunning?0.6:1}}>
                    {simRunning?'Running…':'▶ Run'}
                  </button>
                  {simResults && (
                    <button onClick={handleClearSim}
                      style={{padding:'7px 12px',fontSize:12,background:'#fff',color:'#1a1a18',border:'0.5px solid #b4b2a9',borderRadius:7,cursor:'pointer'}}>
                      Clear
                    </button>
                  )}
                </div>
                {simError && <p style={{fontSize:11,color:'#A32D2D',margin:0}}>{simError}</p>}
                {simResults && (
                  <div style={quickResults}>
                    <p style={{fontSize:12,fontWeight:600,margin:'0 0 6px'}}>Quick summary</p>
                    <p style={qStat}>Agents: {simResults.agents.length}</p>
                    <p style={qStat}>Avg POIs: {(simResults.agents.reduce((s,a)=>s+a.pois_visited,0)/simResults.agents.length).toFixed(1)}</p>
                    <p style={qStat}>Avg spend: €{(simResults.agents.reduce((s,a)=>s+a.money_spent,0)/simResults.agents.length).toFixed(0)}</p>
                    {simResults.sentiment && <p style={qStat}>Avg sentiment: {(simResults.sentiment.reduce((s,r)=>s+r.sentiment.overall_score,0)/simResults.sentiment.length).toFixed(1)}/10</p>}
                    <button onClick={()=>{setActiveTab('stats');setSimOpen(false);}}
                      style={{marginTop:8,width:'100%',padding:'6px',fontSize:12,fontWeight:500,background:'#f0ede8',border:'0.5px solid #d3d1c7',borderRadius:6,cursor:'pointer',color:'#1a1a18'}}>
                      View full statistics →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Bottom bar: agent selector + time slider ── */}
          {simResults && (
            <div style={bottomBar}>

              {/* Agent selector */}
              <div style={agentSelectorRow}>
                <span style={bottomLabel}>View</span>
                <select value={focusAgentId??''} onChange={e=>handleFocusAgent(e.target.value)} style={agentSelect}>
                  <option value="">All agents (population)</option>
                  {simResults.agents.map(a => (
                    <option key={a.agent_id} value={a.agent_id}>
                      Agent #{a.agent_id} · {a.nationality} · {a.pois_visited} stops
                    </option>
                  ))}
                </select>
                {itinLoading && <span style={{fontSize:11,color:'#888780'}}>Loading…</span>}
                {itinError  && <span style={{fontSize:11,color:'#A32D2D'}}>{itinError}</span>}
                {isAgentMode && focusItinerary && (
                  <span style={{fontSize:11,color:'#D97706',fontWeight:500}}>
                    {focusItinerary.itinerary.length} stops
                  </span>
                )}
              </div>

              {/* Time slider */}
              <div style={sliderRow}>
                <label style={sliderToggle}>
                  <input type="checkbox" checked={sliderActive}
                    onChange={e=>setSliderActive(e.target.checked)} style={{marginRight:6}} />
                  {isAgentMode ? 'Track agent' : 'Time scrubber'}
                </label>
                <input type="range" min={DAY_START} max={DAY_END} step={0.1667}
                  value={sliderTime} disabled={!sliderActive}
                  onChange={e=>setSliderTime(parseFloat(e.target.value))}
                  style={{flex:1, opacity:sliderActive?1:0.4}} />
                <span style={sliderTimeLabel}>{fmtHour(sliderTime)}</span>
              </div>

              {/* Hour ticks */}
              <div style={ticksRow}>
                {Array.from({length:DAY_END-DAY_START+1},(_,i)=>(
                  <span key={i} style={tickLabel}>{DAY_START+i}h</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ITINERARY TAB */}
        {activeTab==='itinerary' && simResults && (
          <div style={{...fill,display:'flex'}}>
            <div style={{flex:1,position:'relative'}}>
              <div ref={mapContainerRef} style={fill} />
            </div>
            <div style={itinSidebar}>
              <p style={sidebarTitle}>Agent itinerary</p>
              <ItineraryPanel agents={simResults.agents} pois={pois}
                onHighlightSteps={(steps) => {
                  clearLayer(agentLayerRef);
                  if (!steps?.length || !mapRef.current) return;
                  const map = mapRef.current;
                  const latLngs = [];
                  steps.forEach(step => {
                    const poi = pois.find(p=>p.name===step.poi_name);
                    if (!poi) return;
                    latLngs.push([poi.lat,poi.lng]);
                    const color = CAT_COLORS[step.category]||'#9CA3AF';
                    const c = L.circleMarker([poi.lat,poi.lng],{radius:10,fillColor:color,color:'#fff',weight:2,fillOpacity:0.9,zIndexOffset:600})
                      .bindTooltip(`#${step.order+1} ${step.poi_name}<br/>${step.timestamp}`,{permanent:steps.length===1}).addTo(map);
                    agentLayerRef.current.push(c);
                    const lbl = L.marker([poi.lat,poi.lng],{icon:L.divIcon({html:`<div style="color:#fff;font-size:9px;font-weight:800;text-align:center;line-height:20px">${step.order+1}</div>`,iconSize:[20,20],iconAnchor:[10,10],className:''}),zIndexOffset:700,interactive:false}).addTo(map);
                    agentLayerRef.current.push(lbl);
                  });
                  if (latLngs.length > 1) {
                    for (let i=0;i<latLngs.length-1;i++) {
                      const line = L.polyline([latLngs[i],latLngs[i+1]],{color:'#1D9E75',weight:2,dashArray:'5 6',opacity:0.7}).addTo(map);
                      agentLayerRef.current.push(line);
                      const mid = [(latLngs[i][0]+latLngs[i+1][0])/2,(latLngs[i][1]+latLngs[i+1][1])/2];
                      const el = L.marker(mid,{icon:L.divIcon({html:`<div style="background:#1D9E75;color:#fff;border-radius:10px;padding:1px 5px;font-size:9px;font-weight:700">${i+1}→${i+2}</div>`,iconSize:[28,16],iconAnchor:[14,8],className:''}),interactive:false}).addTo(map);
                      agentLayerRef.current.push(el);
                    }
                    map.fitBounds(latLngs,{padding:[50,50]});
                  } else if (latLngs.length===1) map.setView(latLngs[0],15);
                }}
              />
            </div>
          </div>
        )}

        {/* STATS TAB */}
        {activeTab==='stats' && simResults && (
          <div style={{...fill,overflowY:'auto'}}>
            <Statistics simResults={simResults} />
          </div>
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#5F5E5A'}}>
      <div style={{width:10,height:10,borderRadius:'50%',background:color,flexShrink:0}} />
      {label}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const fill         = { position:'absolute', inset:0 };
const navbar       = { height:48, background:'#fff', borderBottom:'0.5px solid #e0ddd6', display:'flex', alignItems:'center', padding:'0 16px', gap:16, flexShrink:0, zIndex:1000 };
const navBrand     = { fontSize:14, fontWeight:600, color:'#1a1a18', whiteSpace:'nowrap' };
const tabGroup     = { display:'flex', gap:2, background:'#f0ede8', borderRadius:8, padding:3 };
const tabBtn       = { padding:'4px 16px', fontSize:12, fontWeight:500, background:'transparent', border:'none', borderRadius:6, cursor:'pointer', color:'#5F5E5A', display:'flex', alignItems:'center', gap:6 };
const tabBtnActive = { background:'#fff', color:'#1a1a18', boxShadow:'0 1px 3px rgba(0,0,0,0.08)' };
const tabBadge     = { background:'#1D9E75', color:'#fff', borderRadius:20, padding:'0 6px', fontSize:10, fontWeight:600 };
const navRight     = { marginLeft:'auto', display:'flex', alignItems:'center', gap:12 };
const navInfo      = { fontSize:11, color:'#888780', whiteSpace:'nowrap' };
const greenBtn     = { padding:'6px 14px', fontSize:12, fontWeight:500, background:'#1D9E75', color:'#fff', border:'none', borderRadius:7, cursor:'pointer' };
const infoBadge    = { position:'absolute', top:12, left:12, zIndex:500, background:'rgba(255,255,255,0.95)', border:'0.5px solid #d3d1c7', borderRadius:8, padding:'6px 12px', fontSize:12, backdropFilter:'blur(8px)', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' };
const legend       = { position:'absolute', bottom:12, left:12, zIndex:500, background:'rgba(255,255,255,0.95)', border:'0.5px solid #d3d1c7', borderRadius:8, padding:'8px 12px', display:'flex', flexDirection:'column', gap:6, backdropFilter:'blur(8px)' };
const simPanel     = { position:'absolute', top:12, right:12, zIndex:500, background:'rgba(255,255,255,0.97)', border:'0.5px solid #d3d1c7', borderRadius:10, padding:16, width:250, boxShadow:'0 4px 16px rgba(0,0,0,0.08)', display:'flex', flexDirection:'column', gap:6, maxHeight:'calc(100% - 24px)', overflowY:'auto', backdropFilter:'blur(10px)' };
const panelTitle   = { fontSize:13, fontWeight:600, color:'#1a1a18', margin:0 };
const labelSt      = { fontSize:11, color:'#5F5E5A', fontWeight:500 };
const inputSt      = { padding:'5px 8px', fontSize:12, border:'0.5px solid #b4b2a9', borderRadius:6, width:'100%', boxSizing:'border-box', fontFamily:"'DM Sans',sans-serif" };
const quickResults = { marginTop:4, padding:'10px 12px', background:'#F4FBF8', border:'0.5px solid #B6E4D6', borderRadius:8 };
const qStat        = { fontSize:11, color:'#5F5E5A', margin:'2px 0' };
const itinSidebar  = { width:320, flexShrink:0, borderLeft:'0.5px solid #e0ddd6', background:'#fff', display:'flex', flexDirection:'column', overflow:'hidden' };
const sidebarTitle = { fontSize:13, fontWeight:600, color:'#1a1a18', margin:0, padding:'12px 16px', borderBottom:'0.5px solid #e8e6e0', flexShrink:0 };

const bottomBar = {
  flexShrink:0, background:'#fff', borderTop:'0.5px solid #e0ddd6',
  padding:'10px 16px 8px', display:'flex', flexDirection:'column', gap:6, zIndex:500,
};
const agentSelectorRow = { display:'flex', alignItems:'center', gap:10 };
const bottomLabel      = { fontSize:11, color:'#5F5E5A', fontWeight:500, whiteSpace:'nowrap' };
const agentSelect      = { flex:1, padding:'5px 8px', fontSize:12, border:'0.5px solid #b4b2a9', borderRadius:6, fontFamily:"'DM Sans',sans-serif", background:'#fff' };
const sliderRow        = { display:'flex', alignItems:'center', gap:10 };
const sliderToggle     = { display:'flex', alignItems:'center', fontSize:12, fontWeight:500, color:'#1a1a18', cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' };
const sliderTimeLabel  = { fontSize:13, fontWeight:600, color:'#1D9E75', minWidth:40, textAlign:'right' };
const ticksRow         = { display:'flex', justifyContent:'space-between', padding:'0 2px' };
const tickLabel        = { fontSize:9, color:'#b4b2a9' };
