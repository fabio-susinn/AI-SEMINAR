// ── Default Barcelona data (used before any file is loaded) ──────────────────

export const DEFAULT_DISTRICTS = [
  { id: 'd1',  name: 'Ciutat Vella',        lat: 41.3818, lng: 2.1767, pop: 102494 },
  { id: 'd2',  name: 'Eixample',            lat: 41.3927, lng: 2.1569, pop: 265617 },
  { id: 'd3',  name: 'Sants-Montjuïc',      lat: 41.3651, lng: 2.1467, pop: 182219 },
  { id: 'd4',  name: 'Les Corts',           lat: 41.3854, lng: 2.1288, pop: 82551  },
  { id: 'd5',  name: 'Sarrià-Sant Gervasi', lat: 41.4076, lng: 2.1317, pop: 148161 },
  { id: 'd6',  name: 'Gràcia',              lat: 41.4020, lng: 2.1567, pop: 121515 },
  { id: 'd7',  name: 'Horta-Guinardó',      lat: 41.4205, lng: 2.1700, pop: 169462 },
  { id: 'd8',  name: 'Nou Barris',          lat: 41.4357, lng: 2.1730, pop: 164004 },
  { id: 'd9',  name: 'Sant Andreu',         lat: 41.4293, lng: 2.1895, pop: 148429 },
  { id: 'd10', name: 'Sant Martí',          lat: 41.4090, lng: 2.2000, pop: 237091 },
];

export const DEFAULT_EDGES = [
  ['d1', 'd2'],  ['d1', 'd3'],  ['d1', 'd10'],
  ['d2', 'd3'],  ['d2', 'd4'],  ['d2', 'd5'],
  ['d2', 'd6'],  ['d2', 'd10'],
  ['d3', 'd4'],
  ['d4', 'd5'],
  ['d5', 'd6'],
  ['d6', 'd7'],
  ['d7', 'd8'],  ['d7', 'd9'],  ['d7', 'd10'],
  ['d8', 'd9'],
  ['d9', 'd10'],
];

// ── GraphML parser ────────────────────────────────────────────────────────────
//
// Your GraphML nodes MUST have lat/lng data keys for the map overlay to work.
// Supported key names (case-insensitive): lat, lng / lon / longitude, latitude
// Optional:  name / label / id  (falls back to node id attribute)
//            population / pop   (controls node size; defaults to 1 if absent)
//
// Example node:
//   <node id="n1">
//     <data key="lat">41.38</data>
//     <data key="lng">2.17</data>
//     <data key="name">My Place</data>
//   </node>

export function parseGraphML(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('Invalid XML: ' + parseError.textContent.slice(0, 120));

  // Build key-id → attr-name map
  const keyMap = {};
  doc.querySelectorAll('key').forEach(k => {
    const id = k.getAttribute('id');
    const name = (k.getAttribute('attr.name') || '').toLowerCase();
    if (id) keyMap[id] = name;
  });

  // Helper: get a data value from a node/edge element
  function getData(el, ...attrNames) {
    for (const data of el.querySelectorAll(':scope > data')) {
      const keyId = data.getAttribute('key') || '';
      const resolved = keyMap[keyId] || keyId.toLowerCase();
      if (attrNames.includes(resolved)) return data.textContent.trim();
    }
    return null;
  }

  // Parse nodes
  const nodes = [];
  doc.querySelectorAll('node').forEach(n => {
    const id = n.getAttribute('id');
    if (!id) return;

    const latStr = getData(n, 'lat', 'latitude', 'y');
    const lngStr = getData(n, 'lng', 'lon', 'longitude', 'long', 'x');
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      console.warn(`Node "${id}" skipped — missing or invalid lat/lng`);
      return;
    }

    const name =
      getData(n, 'name', 'label', 'title') ||
      getData(n, 'id') ||
      id;

    const popStr = getData(n, 'population', 'pop', 'weight', 'size');
    const pop = popStr ? parseInt(popStr, 10) : 1;

    nodes.push({ id, name, lat, lng, pop: isNaN(pop) ? 1 : pop });
  });

  if (nodes.length === 0) {
    throw new Error(
      'No nodes with valid lat/lng found.\n' +
      'Make sure your nodes have <data key="lat"> and <data key="lng"> (or longitude/latitude).'
    );
  }

  // Parse edges
  const nodeIds = new Set(nodes.map(n => n.id));
  const edges = [];
  doc.querySelectorAll('edge').forEach(e => {
    const src = e.getAttribute('source');
    const tgt = e.getAttribute('target');
    if (src && tgt && nodeIds.has(src) && nodeIds.has(tgt)) {
      edges.push([src, tgt]);
    }
  });

  // Compute map center from node bounding box
  const lats = nodes.map(n => n.lat);
  const lngs = nodes.map(n => n.lng);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

  return { nodes, edges, center: [centerLat, centerLng] };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getNeighbors(id, edges, nodes) {
  return edges
    .filter(([s, t]) => s === id || t === id)
    .map(([s, t]) => (s === id ? t : s))
    .map(nid => nodes.find(n => n.id === nid))
    .filter(Boolean);
}

export function generateGraphML(nodes, edges) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<graphml xmlns="http://graphml.graphdrawing.org/graphml">',
    '  <key id="name" for="node" attr.name="name"       attr.type="string"/>',
    '  <key id="pop"  for="node" attr.name="population" attr.type="int"/>',
    '  <key id="lat"  for="node" attr.name="lat"        attr.type="double"/>',
    '  <key id="lng"  for="node" attr.name="lng"        attr.type="double"/>',
    '  <graph id="G" edgedefault="undirected">',
  ];
  nodes.forEach(d => {
    lines.push(`    <node id="${d.id}">`);
    lines.push(`      <data key="name">${d.name}</data>`);
    lines.push(`      <data key="pop">${d.pop}</data>`);
    lines.push(`      <data key="lat">${d.lat}</data>`);
    lines.push(`      <data key="lng">${d.lng}</data>`);
    lines.push('    </node>');
  });
  edges.forEach(([s, t], i) => {
    lines.push(`    <edge id="e${i}" source="${s}" target="${t}"/>`);
  });
  lines.push('  </graph>', '</graphml>');
  return lines.join('\n');
}
