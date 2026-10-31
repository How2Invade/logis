'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MLMap, GeoJSONSource, MapLayerMouseEvent, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from 'next-themes';
import type { ActionLocation, SiteCallState } from './types';

const BASE_STYLE = 'https://demotiles.maplibre.org/style.json';
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e9e6df' } }],
};
const CALL_COLOR: Record<SiteCallState, string> = {
  none: '#ffffff',
  calling: '#2f5be0',
  acknowledged: '#4f8a68',
  escalated: '#c85a52',
  unanswered: '#c58a32',
};

const BASE = {
  light: { water: '#d9e6ef', land: '#f1eee8', coast: '#9fb6c8', label: '#56606e' },
  dark: { water: '#16191d', land: '#24231f', coast: '#3d4a55', label: '#a29e97' },
};

// The demo basemap draws de facto borders; hide every boundary so no contested line is shown, and theme the land.
function styleBase(m: MLMap, dark: boolean) {
  const c = dark ? BASE.dark : BASE.light;
  const has = (id: string) => !!m.getLayer(id);
  if (has('background')) m.setPaintProperty('background', 'background-color', c.water);
  if (has('countries-fill')) m.setPaintProperty('countries-fill', 'fill-color', c.land);
  if (has('coastline')) m.setPaintProperty('coastline', 'line-color', c.coast);
  if (has('countries-label')) m.setPaintProperty('countries-label', 'text-color', c.label);
  for (const id of ['countries-boundary', 'geolines', 'geolines-label', 'crimea-fill']) if (has(id)) m.setLayoutProperty(id, 'visibility', 'none');
}

interface Props {
  locations: ActionLocation[];
  callState: Record<string, SiteCallState>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function spread(locations: ActionLocation[]): Array<ActionLocation & { lng: number; lat: number }> {
  const seen = new Map<string, number>();
  const out: Array<ActionLocation & { lng: number; lat: number }> = [];
  for (const l of locations) {
    if (!l.lngLat) continue;
    const key = l.lngLat.join(',');
    const k = seen.get(key) ?? 0;
    seen.set(key, k + 1);
    // fan out sites that share a state centroid so each stays clickable
    const r = k === 0 ? 0 : 0.35 * Math.sqrt(k);
    const a = k * 2.4;
    out.push({ ...l, lng: l.lngLat[0] + r * Math.cos(a), lat: l.lngLat[1] + r * Math.sin(a) });
  }
  return out;
}

export function RecallMap({ locations, callState, selectedId, onSelect }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [basemapFailed, setBasemapFailed] = useState(false);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme !== 'light';
  const darkRef = useRef(dark);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const points = useMemo(() => spread(locations), [locations]);
  const maxUnits = useMemo(() => Math.max(1, ...points.map((p) => p.affected + p.uncertain)), [points]);

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: points.map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          kind: p.kind,
          weight: (p.affected + p.uncertain) / maxUnits,
          radius: 5 + 11 * Math.sqrt((p.affected + p.uncertain) / maxUnits),
          ring: CALL_COLOR[callState[p.id] ?? 'none'],
          selected: p.id === selectedId ? 1 : 0,
        },
      })),
    }),
    [points, maxUnits, callState, selectedId]
  );

  useEffect(() => {
    let disposed = false;
    let map: MLMap | null = null;
    void import('maplibre-gl').then((maplibregl) => {
      if (disposed || !box.current) return;
      maplibregl.setWorkerUrl('/api/action/maplibre/maplibre-gl-worker.mjs');
      const created = new maplibregl.Map({
        container: box.current,
        style: BASE_STYLE,
        center: [79, 22.5],
        zoom: 3.6,
        minZoom: 2.5,
        maxZoom: 11,
        attributionControl: { compact: true },
      });
      map = created;
      mapRef.current = created;
      created.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      let styleReady = false;
      const fallbackTimer = setTimeout(() => {
        if (!styleReady) {
          setBasemapFailed(true);
          created.setStyle(FALLBACK_STYLE);
        }
      }, 8000);
      created.on('error', () => {
        if (!styleReady) {
          styleReady = true;
          clearTimeout(fallbackTimer);
          setBasemapFailed(true);
          created.setStyle(FALLBACK_STYLE);
        }
      });
      created.on('style.load', () => {
        styleReady = true;
        clearTimeout(fallbackTimer);
        const m = created;
        styleBase(m, darkRef.current);
        if (m.getSource('sites')) return;
        m.addSource('sites', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        m.addLayer({
          id: 'heat',
          type: 'heatmap',
          source: 'sites',
          paint: {
            'heatmap-weight': ['get', 'weight'],
            'heatmap-intensity': 1.1,
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 3, 28, 8, 60],
            'heatmap-opacity': 0.55,
            'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.3, '#f2c230', 0.6, '#f08a24', 1, '#c85a52'],
          },
        });
        m.addLayer({
          id: 'site-ring',
          type: 'circle',
          source: 'sites',
          paint: {
            'circle-radius': ['+', ['get', 'radius'], ['case', ['==', ['get', 'selected'], 1], 6, 3]],
            'circle-color': ['get', 'ring'],
            'circle-stroke-width': ['case', ['==', ['get', 'selected'], 1], 3, 0],
            'circle-stroke-color': '#1d2433',
          },
        });
        m.addLayer({
          id: 'site',
          type: 'circle',
          source: 'sites',
          paint: {
            'circle-radius': ['get', 'radius'],
            'circle-color': ['match', ['get', 'kind'], 'warehouse', '#2f5be0', '#f08a24'],
            'circle-opacity': 0.92,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
          },
        });
        m.on('click', 'site', (e: MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties?.id;
          if (typeof id === 'string') onSelectRef.current(id);
        });
        m.on('mouseenter', 'site', () => {
          m.getCanvas().style.cursor = 'pointer';
        });
        m.on('mouseleave', 'site', () => {
          m.getCanvas().style.cursor = '';
        });
        setLoaded(true);
      });
    });
    return () => {
      disposed = true;
      mapRef.current = null;
      setLoaded(false);
      map?.remove();
    };
  }, []);

  useEffect(() => {
    darkRef.current = dark;
    const m = mapRef.current;
    if (m && loaded) styleBase(m, dark);
  }, [dark, loaded]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !loaded) return;
    const src = m.getSource('sites') as GeoJSONSource | undefined;
    src?.setData(geojson);
  }, [geojson, loaded]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !loaded || points.length === 0) return;
    const lngs = points.map((p) => p.lng);
    const lats = points.map((p) => p.lat);
    m.fitBounds([[Math.min(...lngs) - 2, Math.min(...lats) - 2], [Math.max(...lngs) + 2, Math.max(...lats) + 2]], { padding: 30, duration: 600, maxZoom: 6 });
  }, [points, loaded]);

  useEffect(() => {
    const m = mapRef.current;
    const p = points.find((q) => q.id === selectedId);
    if (m && loaded && p) m.easeTo({ center: [p.lng, p.lat], duration: 500 });
  }, [selectedId, points, loaded]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl">
      <div ref={box} className="h-full w-full" />
      <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-x-3 gap-y-1 rounded-lg border border-border bg-surface/90 px-2.5 py-1.5 text-[10px] text-muted-foreground backdrop-blur">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#2f5be0]" />Warehouse</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#f08a24]" />Store / distributor</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border-2 border-[#4f8a68]" />Acknowledged</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border-2 border-[#c85a52]" />Escalation</span>
        {basemapFailed && <span>· basemap offline</span>}
      </div>
    </div>
  );
}
