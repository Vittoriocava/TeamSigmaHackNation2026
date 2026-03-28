"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapPOI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: "fog" | "conquered" | "decaying" | "enemy" | "current";
  type?: string;
}

interface GameMapProps {
  pois: MapPOI[];
  center: [number, number];
  zoom?: number;
  onPoiClick?: (poi: MapPOI) => void;
  showFog?: boolean;
  userPosition?: [number, number] | null;
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  fog: "#6B7280",
  conquered: "#10B981",
  decaying: "#F59E0B",
  enemy: "#EF4444",
  current: "#6C3CE1",
};

export function GameMap({
  pois,
  center,
  zoom = 14,
  onPoiClick,
  showFog = true,
  userPosition,
  className = "",
}: GameMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update markers when POIs change
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    pois.forEach((poi) => {
      const color = STATUS_COLORS[poi.status] || STATUS_COLORS.fog;
      const isFog = poi.status === "fog";

      const marker = L.circleMarker([poi.lat, poi.lng], {
        radius: poi.status === "current" ? 12 : 8,
        fillColor: color,
        fillOpacity: isFog && showFog ? 0.3 : 0.8,
        color: color,
        weight: poi.status === "current" ? 3 : 1,
        opacity: isFog && showFog ? 0.4 : 1,
      }).addTo(map);

      // Tooltip
      marker.bindTooltip(poi.name, {
        permanent: false,
        direction: "top",
        className: "bg-gray-900 text-white border-none rounded-lg px-2 py-1 text-xs",
      });

      // Fog effect overlay
      if (isFog && showFog) {
        L.circle([poi.lat, poi.lng], {
          radius: 80,
          fillColor: "#1F2937",
          fillOpacity: 0.6,
          stroke: false,
        }).addTo(map);
      }

      if (onPoiClick) {
        marker.on("click", () => onPoiClick(poi));
      }

      markersRef.current.push(marker);
    });
  }, [pois, showFog, onPoiClick]);

  // User position marker
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !userPosition) return;

    const userMarker = L.circleMarker(userPosition, {
      radius: 8,
      fillColor: "#3B82F6",
      fillOpacity: 1,
      color: "#ffffff",
      weight: 3,
    }).addTo(map);

    // Pulse effect
    const pulse = L.circleMarker(userPosition, {
      radius: 20,
      fillColor: "#3B82F6",
      fillOpacity: 0.2,
      stroke: false,
    }).addTo(map);

    return () => {
      userMarker.remove();
      pulse.remove();
    };
  }, [userPosition]);

  return (
    <div ref={mapRef} className={`w-full h-full rounded-2xl ${className}`} />
  );
}
