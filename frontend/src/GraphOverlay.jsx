import React, { useEffect, useRef } from 'react';

export default function GraphOverlay({ map, nodes, edges, selectedId, onSelectNode }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!map || !nodes.length) return;
    const maxPop = Math.max(...nodes.map(n => n.pop));

    function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      // Edges
      ctx.strokeStyle = 'rgba(29,158,117,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      edges.forEach(([sid, tid]) => {
        const s = nodes.find(n => n.id === sid);
        const t = nodes.find(n => n.id === tid);
        if (!s || !t) return;
        const ps = map.latLngToContainerPoint([s.lat, s.lng]);
        const pt = map.latLngToContainerPoint([t.lat, t.lng]);
        ctx.moveTo(ps.x, ps.y);
        ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();

      // Nodes
      nodes.forEach(d => {
        const p = map.latLngToContainerPoint([d.lat, d.lng]);
        const isSelected = d.id === selectedId;
        const r = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'rgba(216,90,48,0.88)' : 'rgba(29,158,117,0.88)';
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#993C1D' : '#085041';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();
      });
    }

    // Resize canvas to match container
    function resize() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width  = map.getContainer().offsetWidth;
      canvas.height = map.getContainer().offsetHeight;
      draw();
    }

    resize();
    map.on('move zoom viewreset resize', draw);    
    window.addEventListener('resize', resize);
    return () => {
      map.off('move zoom viewreset resize', draw);
      window.removeEventListener('resize', resize);
    };
  }, [map, nodes, edges, selectedId, onSelectNode]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 400 }}
    />
  );
}