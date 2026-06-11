import React, { useEffect, useRef } from 'react';

export default function GraphOverlay({ map, nodes, edges, selectedId, onSelectNode }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!map || !nodes.length) return;

    const maxPop = Math.max(...nodes.map(n => n.pop));

    function draw() {
      const svg = svgRef.current;
      if (!svg) return;
      while (svg.firstChild) svg.removeChild(svg.firstChild);

      const NS = 'http://www.w3.org/2000/svg';

      function toPoint(lat, lng) {
        const p = map.latLngToContainerPoint([lat, lng]);
        return { x: p.x, y: p.y };
      }

      // Edges
      const edgeG = document.createElementNS(NS, 'g');
      edges.forEach(([sid, tid]) => {
        const s = nodes.find(n => n.id === sid);
        const t = nodes.find(n => n.id === tid);
        if (!s || !t) return;
        const ps = toPoint(s.lat, s.lng);
        const pt = toPoint(t.lat, t.lng);
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', ps.x); line.setAttribute('y1', ps.y);
        line.setAttribute('x2', pt.x); line.setAttribute('y2', pt.y);
        line.setAttribute('stroke', '#1D9E75');
        line.setAttribute('stroke-width', '1.8');
        line.setAttribute('stroke-opacity', '0.45');
        edgeG.appendChild(line);
      });
      svg.appendChild(edgeG);

      // Nodes
      const nodeG = document.createElementNS(NS, 'g');
      nodeG.style.pointerEvents = 'all';

      nodes.forEach(d => {
        const p = toPoint(d.lat, d.lng);
        const isSelected = d.id === selectedId;
        const r = Math.round(4 + (d.pop / maxPop) * 7);

        const g = document.createElementNS(NS, 'g');
        g.style.cursor = 'pointer';

        if (isSelected) {
          const ring = document.createElementNS(NS, 'circle');
          ring.setAttribute('cx', p.x); ring.setAttribute('cy', p.y);
          ring.setAttribute('r', r + 5);
          ring.setAttribute('fill', 'none');
          ring.setAttribute('stroke', '#D85A30');
          ring.setAttribute('stroke-width', '1.5');
          ring.setAttribute('stroke-opacity', '0.4');
          g.appendChild(ring);
        }

        const circle = document.createElementNS(NS, 'circle');
        circle.setAttribute('cx', p.x); circle.setAttribute('cy', p.y);
        circle.setAttribute('r', r);
        circle.setAttribute('fill', isSelected ? '#D85A30' : '#1D9E75');
        circle.setAttribute('stroke', isSelected ? '#993C1D' : '#085041');
        circle.setAttribute('stroke-width', isSelected ? '2' : '1');
        circle.setAttribute('fill-opacity', '0.88');

        const label = document.createElementNS(NS, 'text');
        label.setAttribute('x', p.x);
        label.setAttribute('y', p.y - r - 5);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '10.5');
        label.setAttribute('font-family', "'DM Sans', sans-serif");
        label.setAttribute('fill', isSelected ? '#7A2A10' : '#054032');
        label.setAttribute('font-weight', '500');
        label.setAttribute('paint-order', 'stroke');
        label.setAttribute('stroke', 'rgba(255,255,255,0.85)');
        label.setAttribute('stroke-width', '3');
        label.setAttribute('stroke-linejoin', 'round');
        label.textContent = d.name;

        g.appendChild(circle);
        g.appendChild(label);
        g.addEventListener('click', () => onSelectNode(d));
        nodeG.appendChild(g);
      });

      svg.appendChild(nodeG);
    }

    draw();
    map.on('move zoom viewreset', draw);
    return () => map.off('move zoom viewreset', draw);
  }, [map, nodes, edges, selectedId, onSelectNode]);

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 400,
      }}
    />
  );
}
