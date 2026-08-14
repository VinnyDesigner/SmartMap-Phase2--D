const { useEffect, useRef } = React;

const FILTERS = {
  streets: 'none',
  gray: 'none',
  dark: 'none',
  blueprint: 'grayscale(1) invert(1) sepia(1) hue-rotate(170deg) saturate(2.2) brightness(0.72) contrast(1.1)',
};

const TILES = {
  streets: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  gray: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  blueprint: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
};

const CAP = 'M12 5.2 3.6 9 12 12.8 20.4 9 12 5.2Zm-5 6.4v3.1c0 1.2 2.2 2.2 5 2.2s5-1 5-2.2v-3.1';

function waitForL(cb) {
  if (window.L) return cb(window.L);
  const t = setInterval(() => { if (window.L) { clearInterval(t); cb(window.L); } }, 60);
}

function pinHtml(color, selected, label) {
  const w = selected ? 40 : 30, h = selected ? 52 : 40;
  return (
    '<div style="position:relative;width:' + w + 'px;height:' + h + 'px">' +
    (selected
      ? '<div style="position:absolute;left:50%;top:' + (h - 14) + 'px;transform:translate(-50%,-50%);width:120px;height:120px;border-radius:999px;background:radial-gradient(circle,rgba(37,99,235,.34) 0%,rgba(37,99,235,.16) 45%,rgba(37,99,235,0) 70%)"></div>'
      : '') +
    '<svg width="' + w + '" height="' + h + '" viewBox="0 0 30 40" style="position:absolute;inset:0;filter:drop-shadow(0 4px 7px rgba(12,20,40,.35))">' +
    '<path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0Z" fill="' + color + '"/>' +
    '<g transform="translate(3 2) scale(1)" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="' + CAP + '"/></g></svg>' +
    (selected && label
      ? '<div style="position:absolute;left:' + (w + 8) + 'px;top:' + (h / 2 - 24) + 'px;max-width:190px;' +
        'padding:6px 10px;border-radius:10px;background:rgba(255,255,255,.92);box-shadow:0 4px 14px rgba(12,20,40,.22);' +
        'font:600 13.5px/1.3 \'Plus Jakarta Sans\',sans-serif;color:#0f1730;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
        label.en + '<div style="font-weight:500;font-size:12.5px;direction:rtl;overflow:hidden;text-overflow:ellipsis">' + (label.ar || '') + '</div></div>'
      : '') +
    '</div>'
  );
}

function GeoMap(props) {
  const {
    basemap = 'gray', markers = [], selectedId = null, onSelect,
    aoi = false, buffer = false, shape = 'poly', center = [24.4539, 54.3773], zoom = 12,
    accent = '#2563eb', pin = '#e0313f', interactive = true, onView, registerCmd,
  } = props;

  const host = useRef(null);
  const map = useRef(null);
  const tile = useRef(null);
  const layer = useRef(null);
  const aoiRef = useRef(null);
  const bufRef = useRef(null);
  const cbs = useRef({});
  cbs.current = { onSelect, onView };

  useEffect(() => {
    let dead = false;
    waitForL((L) => {
      if (dead || !host.current || map.current) return;
      const m = L.map(host.current, {
        center, zoom, zoomControl: false, attributionControl: true,
        fadeAnimation: false, zoomAnimation: false,
        dragging: interactive, scrollWheelZoom: interactive,
        doubleClickZoom: interactive, boxZoom: interactive, keyboard: interactive,
      });
      tile.current = L.tileLayer(TILES[basemap] || TILES.gray, {
        subdomains: 'abcd', attribution: '© OpenStreetMap contributors © CARTO', maxZoom: 20,
      }).addTo(m);
      layer.current = L.layerGroup().addTo(m);
      map.current = m;
      const report = () => {
        const c = m.getCenter();
        cbs.current.onView && cbs.current.onView({
          lat: c.lat, lng: c.lng, zoom: m.getZoom(),
          scale: Math.round(591657550.5 / Math.pow(2, m.getZoom() - 1)),
        });
      };
      m.on('moveend zoomend', report);
      m.whenReady(() => { setTimeout(() => { m.invalidateSize(); report(); }, 80); });
      m.__gvCmd = (cmd) => {
        if (cmd === 'in') m.setZoom(m.getZoom() + 1, { animate: false });
        else if (cmd === 'out') m.setZoom(m.getZoom() - 1, { animate: false });
        else if (cmd === 'home') m.setView(center, zoom, { animate: false });
      };
      if (interactive) window.__gvMaps = (window.__gvMaps || []).concat(m);
      if (registerCmd) registerCmd(m.__gvCmd);
    });
    return () => {
      dead = true;
      const m = map.current;
      if (m) {
        window.__gvMaps = (window.__gvMaps || []).filter((x) => x !== m);
        m.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !tile.current) return;
    tile.current.setUrl(TILES[basemap] || TILES.gray);
    const pane = host.current && host.current.querySelector('.leaflet-tile-pane');
    if (pane) pane.style.filter = FILTERS[basemap] || 'none';
  }, [basemap]);

  useEffect(() => {
    const L = window.L;
    if (!L || !layer.current) return;
    layer.current.clearLayers();
    markers.forEach((mk) => {
      const on = mk.id === selectedId;
      const w = on ? 40 : 30, h = on ? 52 : 40;
      const icon = L.divIcon({
        className: '', iconSize: [w, h], iconAnchor: [w / 2, h],
        html: pinHtml(on ? accent : pin, on, { en: mk.name, ar: mk.ar }),
      });
      L.marker([mk.lat, mk.lng], { icon, title: mk.name, zIndexOffset: on ? 1000 : 0 })
        .addTo(layer.current)
        .on('click', () => cbs.current.onSelect && cbs.current.onSelect(mk));
    });
  }, [markers, selectedId, accent, pin]);

  useEffect(() => {
    const L = window.L, m = map.current;
    if (!L || !m) return;
    if (aoiRef.current) { m.removeLayer(aoiRef.current); aoiRef.current = null; }
    if (bufRef.current) { m.removeLayer(bufRef.current); bufRef.current = null; }

    if (aoi) {
      const g = L.layerGroup();
      const c = [24.4585, 54.3760];

      if (shape === 'circ') {
        [1, 0.66, 0.34].forEach((k, i) => {
          L.circle(c, {
            radius: 5200 * k, color: accent, weight: i === 0 ? 1.6 : 1, opacity: i === 0 ? 0.85 : 0.35,
            fillColor: accent, fillOpacity: i === 0 ? 0.07 : 0.05, className: 'gv-aoi gv-ring-' + i,
          }).addTo(g);
        });
        L.circle(c, { radius: 5200, color: accent, weight: 2, fill: false, className: 'gv-aoi gv-pulse' }).addTo(g);
        L.circleMarker(c, { radius: 6, color: '#fff', weight: 3, fillColor: accent, fillOpacity: 1, className: 'gv-aoi' }).addTo(g);
      } else {
        const rings = {
          poly: [[24.500, 54.330], [24.508, 54.400], [24.455, 54.428], [24.424, 54.372], [24.452, 54.325]],
          rect: [[24.508, 54.325], [24.508, 54.428], [24.424, 54.428], [24.424, 54.325]],
          bnd: [[24.512, 54.318], [24.520, 54.362], [24.498, 54.412], [24.462, 54.436], [24.428, 54.418],
                [24.414, 54.376], [24.428, 54.336], [24.470, 54.312]],
        };
        const pts = rings[shape] || rings.poly;
        L.polygon(pts, { color: accent, weight: 2.5, opacity: 0.9, fillColor: accent, fillOpacity: 0.1, className: 'gv-aoi gv-march' }).addTo(g);
        L.polygon(pts, { color: accent, weight: 10, opacity: 0.16, fill: false, className: 'gv-aoi gv-glow' }).addTo(g);
        pts.forEach((p) => L.circleMarker(p, {
          radius: 5, color: '#fff', weight: 2, fillColor: accent, fillOpacity: 1, className: 'gv-aoi gv-vertex',
        }).addTo(g));
      }
      g.addTo(m);
      aoiRef.current = g;
    }

    if (buffer) {
      const b = L.layerGroup();
      L.circle([24.4539, 54.3773], {
        radius: 3000, color: accent, weight: 1.5, fillColor: accent, fillOpacity: 0.07, className: 'gv-aoi gv-march',
      }).addTo(b);
      L.circle([24.4539, 54.3773], {
        radius: 3000, color: accent, weight: 2, fill: false, className: 'gv-aoi gv-pulse',
      }).addTo(b);
      b.addTo(m);
      bufRef.current = b;
    }
  }, [aoi, buffer, accent, shape]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const t = setTimeout(() => m.invalidateSize(), 220);
    return () => clearTimeout(t);
  });

  return React.createElement('div', { ref: host, style: { position: 'absolute', inset: 0 } });
}

window.GeoMap = GeoMap;
if (typeof module !== 'undefined') module.exports = { GeoMap };
