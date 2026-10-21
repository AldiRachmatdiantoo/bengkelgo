import { useEffect } from 'react';
import { Circle, CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { cx } from '@/components/ui';

export interface LatLng {
  lat: number;
  lng: number;
}

export const DEFAULT_CENTER: LatLng = { lat: -6.2, lng: 106.816666 }; // Jakarta

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; OpenStreetMap contributors';
const frame = 'relative isolate overflow-hidden rounded-xl border border-line bg-sky';

function Recenter({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng]);
  }, [center.lat, center.lng, map]);
  return null;
}

function ClickToPick({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Map picker: click the map to set a coordinate (workshop location, breakdown spot). */
export function MapPicker({ value, onChange, height = 280, className }: { value: LatLng | null; onChange: (p: LatLng) => void; height?: number; className?: string }) {
  const center = value ?? DEFAULT_CENTER;
  return (
    <div className={cx(frame, className)} style={{ height }}>
      <MapContainer center={[center.lat, center.lng]} zoom={15} className="h-full w-full">
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
        <ClickToPick onPick={onChange} />
        {value && (
          <>
            <Recenter center={value} />
            <Circle center={[value.lat, value.lng]} radius={60} pathOptions={{ color: '#4361EE', weight: 0, fillOpacity: 0.18 }} />
            <CircleMarker center={[value.lat, value.lng]} radius={10} pathOptions={{ color: '#FFFFFF', weight: 3, fillColor: '#4361EE', fillOpacity: 1 }} />
          </>
        )}
      </MapContainer>
      {!value && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[500] rounded-xl bg-card/90 px-3 py-2 text-center text-xs font-semibold text-ink-2 shadow-soft backdrop-blur">
          Klik pada peta untuk menandai lokasi
        </div>
      )}
    </div>
  );
}

export interface MapPoint extends LatLng {
  id: string;
  label: string;
  highlight?: boolean;
}

/** Read-only map with an origin point, optional radius ring and a set of markers. */
export function PointsMap({
  origin,
  radiusMeters,
  points,
  height = 300,
  originLabel = 'Lokasi Anda',
  originTone = 'emergency',
  className,
  hideOrigin,
  zoom,
  route,
  labels,
}: {
  origin: LatLng;
  radiusMeters?: number;
  points: MapPoint[];
  height?: number;
  originLabel?: string;
  originTone?: 'emergency' | 'primary';
  className?: string;
  /** Only show `points` (origin is just the map centre). */
  hideOrigin?: boolean;
  zoom?: number;
  /** Dashed line from the origin to the highlighted point. */
  route?: boolean;
  /** Always-visible labels on the markers instead of click popups. */
  labels?: boolean;
}) {
  const target = points.find((p) => p.highlight);
  const originColor = originTone === 'emergency' ? '#CC4410' : '#4361EE';
  return (
    <div className={cx(frame, className)} style={{ height }}>
      <MapContainer center={[origin.lat, origin.lng]} zoom={zoom ?? (radiusMeters ? 12 : 14)} className="h-full w-full">
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
        <Recenter center={origin} />
        {radiusMeters && (
          <Circle center={[origin.lat, origin.lng]} radius={radiusMeters} pathOptions={{ color: '#4361EE', weight: 1.5, dashArray: '6 6', fillColor: '#4361EE', fillOpacity: 0.06 }} />
        )}
        {route && target && (
          <Polyline positions={[[target.lat, target.lng], [origin.lat, origin.lng]]} pathOptions={{ color: '#4361EE', weight: 3, dashArray: '8 8' }} />
        )}
        {!hideOrigin && (
          <CircleMarker center={[origin.lat, origin.lng]} radius={11} pathOptions={{ color: '#FFFFFF', weight: 3, fillColor: originColor, fillOpacity: 1 }}>
            {labels ? (
              <Tooltip permanent direction="top" offset={[0, -10]} className="!rounded-md !border-0 !bg-emergency !px-2 !py-1 !font-label !text-[11px] !font-bold !text-white !shadow-md">
                {originLabel}
              </Tooltip>
            ) : (
              <Popup>{originLabel}</Popup>
            )}
          </CircleMarker>
        )}
        {points.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={p.highlight ? 10 : 7}
            pathOptions={{ color: '#FFFFFF', weight: 2.5, fillColor: p.highlight ? '#4361EE' : '#728AF3', fillOpacity: 1 }}
          >
            {labels && p.highlight ? (
              <Tooltip permanent direction="top" offset={[0, -10]} className="!rounded-md !border-0 !bg-card !px-2 !py-1 !font-label !text-[11px] !font-bold !text-navy !shadow-md">
                {p.label}
              </Tooltip>
            ) : (
              <Popup>{p.label}</Popup>
            )}
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

/** External navigation link (Google Maps directions) for a coordinate. */
export const directionsUrl = (p: LatLng) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
