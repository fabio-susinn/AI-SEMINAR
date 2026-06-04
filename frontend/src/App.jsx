import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import GraphOverlay from './GraphOverlay';
import {
  DEFAULT_DISTRICTS,
  DEFAULT_EDGES,
  parseGraphML,
  generateGraphML,
} from './graphData';

export default function App() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [nodes, setNodes] = useState(DEFAULT_DISTRICTS);
  const [edges, setEdges] = useState(DEFAULT_EDGES);
  const [fileName, setFileName] = useState('barcelona (default)');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  fetch('/barcelona_network_simplified_20.graphml')
    .then(res => {
      if (!res.ok) throw new Error('File not found');
      return res.text();
    })
    .then(xml => {
      const { nodes: n, edges: e } = parseGraphML(xml);
      setNodes(n);
      setEdges(e);
      setFileName('barcelona_network_simplified_20.graphml');
    })
    .catch(err => console.warn('Default GraphML not loaded:', err.message))
    .finally(() => setLoading(false));  // ← add this
    }, []);

  // Init map once
  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [41.3974, 2.1686],
      zoom: 12,
      zoomControl: false,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    fetch('/barcelona_pois.geojson')
    .then(res => res.json())
    .then(json => {
      L.geoJSON(json, {
        pointToLayer: (feature, latlng) =>
          L.circleMarker(latlng, {
            radius: 5,
            fillColor: '#D85A30',
            color: '#7A2A10',
            weight: 1,
            fillOpacity: 0.85,
          }),
        onEachFeature: (feature, layer) => {
          const props = feature.properties ?? {};
          const label = props.name ?? props.id ?? props.label;
          if (label) layer.bindTooltip(String(label));
        },
      }).addTo(map);
    })
    .catch(err => console.warn('POI layer not loaded:', err.message));

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapRef.current = map;
    setMapReady(true);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Auto-load default GraphML from public folder
useEffect(() => {
  fetch('/barcelona_network_simplified_20.graphml')
    .then(res => {
      if (!res.ok) throw new Error('File not found');
      return res.text();
    })
    .then(xml => {
      const { nodes: n, edges: e } = parseGraphML(xml);
      setNodes(n);
      setEdges(e);
      setFileName('barcelona_network_simplified_20.graphml');
    })
    .catch(err => console.warn('Default GraphML not loaded:', err.message));
}, []);

  // When nodes change, re-center map
  useEffect(() => {
    if (!mapRef.current || !nodes.length) return;
    const lats = nodes.map(n => n.lat);
    const lngs = nodes.map(n => n.lng);
    const bounds = L.latLngBounds(
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    );
    mapRef.current.fitBounds(bounds, { padding: [60, 60] });
  }, [nodes]);


  // Load GraphML file
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { nodes: parsedNodes, edges: parsedEdges } = parseGraphML(ev.target.result);
        setNodes(parsedNodes);
        setEdges(parsedEdges);
        setFileName(file.name);
      } catch (err) {
        setError(err.message);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-loaded
    e.target.value = '';
  };

  const handleDownload = () => {
    const xml = generateGraphML(nodes, edges);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.graphml') ? fileName : 'graph.graphml';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>

      {/* Full-screen map */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* SVG graph overlay */}
      {mapReady && !loading &&(
        <GraphOverlay
          map={mapRef.current}
          nodes={nodes}
          edges={edges}
        />
      )}

      {/* ── Top-left: title + file loader ── */}
      <div style={topLeftPanel}>
        <p style={titleStyle}>Graph viewer</p>
        <p style={fileNameStyle}>{fileName}</p>
        <p style={statsStyle}>{nodes.length} nodes · {edges.length} edges</p>

        <label style={uploadBtnStyle}>
          <input
            type="file"
            accept=".graphml,.xml"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          Load .graphml
        </label>

        <button onClick={handleDownload} style={downloadBtnStyle}>
          ↓ Export .graphml
        </button>

        {error && (
          <div style={errorStyle}>
            <strong>Parse error</strong><br />{error}
          </div>
        )}
      </div>

      {/* ── Top-right: legend ── */}
      <div style={legendPanel}>
        <LegendItem color="#1D9E75" label="Node (size = weight)" circle />
        <LegendItem color="#1D9E75" label="Edge" line />
      </div>

      {/* ── Bottom: info panel (only when node selected) ── */}
      {/* Hint when nothing selected */}
      
    </div>
  );
}

function LegendItem({ color, label, circle, line, border }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', color: '#5F5E5A' }}>
      {circle && (
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: color,
          border: border ? `2px solid ${border}` : 'none',
          flexShrink: 0,
        }} />
      )}
      {line && (
        <div style={{ width: 20, height: 2, background: color, opacity: 0.5, flexShrink: 0 }} />
      )}
      {label}
    </div>
  );
}

// ── Floating panel base ───────────────────────────────────────────────────────

const floatingBase = {
  position: 'absolute',
  background: 'rgba(255,255,255,0.95)',
  border: '0.5px solid #d3d1c7',
  borderRadius: '10px',
  backdropFilter: 'blur(10px)',
  zIndex: 500,
  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
};

const topLeftPanel = {
  ...floatingBase,
  top: '16px',
  left: '16px',
  padding: '14px 16px',
  minWidth: '200px',
  maxWidth: '260px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const legendPanel = {
  ...floatingBase,
  top: '16px',
  right: '16px',
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: '7px',
};

const bottomPanel = {
  ...floatingBase,
  bottom: '16px',
  left: '50%',
  transform: 'translateX(-50%)',
  padding: '0',
  minWidth: '360px',
  maxWidth: '680px',
  width: 'calc(100vw - 48px)',
  position: 'absolute',
};

const titleStyle = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '15px',
  fontWeight: '500',
  color: '#1a1a18',
  margin: 0,
};

const fileNameStyle = {
  fontFamily: "'DM Mono', monospace",
  fontSize: '11px',
  color: '#0F6E56',
  margin: 0,
  wordBreak: 'break-all',
};

const statsStyle = {
  fontSize: '11px',
  color: '#888780',
  margin: 0,
};

const uploadBtnStyle = {
  display: 'inline-block',
  marginTop: '4px',
  padding: '7px 12px',
  fontSize: '12px',
  fontWeight: '500',
  background: '#1D9E75',
  color: '#fff',
  border: 'none',
  borderRadius: '7px',
  cursor: 'pointer',
  textAlign: 'center',
  fontFamily: "'DM Sans', sans-serif",
};

const downloadBtnStyle = {
  padding: '7px 12px',
  fontSize: '12px',
  fontWeight: '500',
  background: '#fff',
  color: '#1a1a18',
  border: '0.5px solid #b4b2a9',
  borderRadius: '7px',
  cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
};

const errorStyle = {
  marginTop: '4px',
  padding: '8px 10px',
  background: '#FCEBEB',
  border: '0.5px solid #F09595',
  borderRadius: '6px',
  fontSize: '11px',
  color: '#A32D2D',
  lineHeight: '1.5',
};

const closeBtn = {
  position: 'absolute',
  top: '10px',
  right: '10px',
  background: 'none',
  border: 'none',
  fontSize: '14px',
  color: '#888780',
  cursor: 'pointer',
  padding: '2px 6px',
  borderRadius: '4px',
};

const hintStyle = {
  position: 'absolute',
  bottom: '16px',
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(255,255,255,0.88)',
  border: '0.5px solid #d3d1c7',
  borderRadius: '20px',
  padding: '6px 16px',
  fontSize: '12px',
  color: '#888780',
  zIndex: 500,
  backdropFilter: 'blur(8px)',
  whiteSpace: 'nowrap',
};
