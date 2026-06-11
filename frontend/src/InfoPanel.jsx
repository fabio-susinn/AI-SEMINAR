import React from 'react';
import { getNeighbors } from './graphData';

export default function InfoPanel({ district, edges, nodes }) {
  if (!district) return null;

  const neighbors = getNeighbors(district.id, edges, nodes);
  const extraKeys = Object.entries(district).filter(
    ([k]) => !['id', 'name', 'lat', 'lng', 'pop'].includes(k)
  );

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
        <div>
          <p style={labelStyle}>name</p>
          <p style={valueStyle}>{district.name}</p>
        </div>
        <div>
          <p style={labelStyle}>id</p>
          <p style={{ ...valueStyle, fontFamily: "'DM Mono', monospace", fontSize: '12px' }}>{district.id}</p>
        </div>
        <div>
          <p style={labelStyle}>coordinates</p>
          <p style={{ ...valueStyle, fontFamily: "'DM Mono', monospace", fontSize: '12px' }}>
            {district.lat.toFixed(5)}, {district.lng.toFixed(5)}
          </p>
        </div>
        {district.pop > 1 && (
          <div>
            <p style={labelStyle}>population</p>
            <p style={valueStyle}>{district.pop.toLocaleString()}</p>
          </div>
        )}
        {extraKeys.map(([k, v]) => (
          <div key={k}>
            <p style={labelStyle}>{k}</p>
            <p style={valueStyle}>{String(v)}</p>
          </div>
        ))}
        <div style={{ flexBasis: '100%' }}>
          <p style={labelStyle}>adjacent nodes ({neighbors.length})</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
            {neighbors.length > 0
              ? neighbors.map(n => <span key={n.id} style={chipStyle}>{n.name}</span>)
              : <span style={{ fontSize: '12px', color: '#888780' }}>none</span>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

const panelStyle = {
  padding: '14px 18px',
  background: 'rgba(255,255,255,0.97)',
  border: '0.5px solid #d3d1c7',
  borderRadius: '10px',
  backdropFilter: 'blur(8px)',
};

const labelStyle = {
  fontSize: '10px',
  color: '#888780',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '2px',
  fontWeight: '500',
};

const valueStyle = {
  fontSize: '13px',
  color: '#1a1a18',
  fontWeight: '500',
};

const chipStyle = {
  fontSize: '11px',
  padding: '3px 9px',
  background: '#E1F5EE',
  color: '#0F6E56',
  borderRadius: '20px',
  fontWeight: '500',
};
