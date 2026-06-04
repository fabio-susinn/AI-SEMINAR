# Barcelona Graph Viewer

Full-screen interactive GraphML viewer — overlay graph nodes on a real map.

## Setup

```bash
npm install
npm start
```

Opens at **http://localhost:3000**

---

## Loading your own GraphML

Click **Load .graphml** in the top-left panel. Your file must have `lat`/`lng` data keys on every node:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/graphml">
  <key id="lat"  for="node" attr.name="lat"  attr.type="double"/>
  <key id="lng"  for="node" attr.name="lng"  attr.type="double"/>
  <key id="name" for="node" attr.name="name" attr.type="string"/>
  <key id="pop"  for="node" attr.name="population" attr.type="int"/>

  <graph id="G" edgedefault="undirected">
    <node id="n1">
      <data key="lat">41.38</data>
      <data key="lng">2.17</data>
      <data key="name">My Place</data>
      <data key="pop">50000</data>
    </node>
    <edge id="e0" source="n1" target="n2"/>
  </graph>
</graphml>
```

### Supported key names (case-insensitive)
| Field | Accepted names |
|---|---|
| Latitude  | `lat`, `latitude`, `y` |
| Longitude | `lng`, `lon`, `longitude`, `long`, `x` |
| Label     | `name`, `label`, `title` (falls back to node id) |
| Size      | `population`, `pop`, `weight`, `size` |

---

## File structure
```
src/
  App.jsx          – full-screen layout, file upload, map init
  GraphOverlay.jsx – SVG layer redrawn on map move/zoom
  InfoPanel.jsx    – floating attribute panel on node click
  graphData.js     – parser, default data, helpers
```
