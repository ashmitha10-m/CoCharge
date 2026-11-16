"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { MapControls } from "./MapControls"
import type { Station } from "@/types"
import { cn } from "@/lib/utils"

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""

interface MapViewProps {
  stations: Station[]
  selectedStationId?: string | null
  onStationSelect?: (station: Station) => void
  userLocation?: { lat: number; lng: number } | null
  className?: string
}

export function MapView({
  stations,
  selectedStationId,
  onStationSelect,
  userLocation,
  className,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  const handleLocate = () => {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.")
    return
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords

      const map = mapInstanceRef.current
      if (!map) return

      map.flyTo({
        center: [longitude, latitude],
        zoom: 15,
        duration: 1200,
      })

      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat([longitude, latitude])
      } else {
        userMarkerRef.current = new mapboxgl.Marker({
          color: "#22d3ee",
        })
          .setLngLat([longitude, latitude])
          .addTo(map)
      }
    },
    (error) => {
      console.error("Location error:", error)
      alert("Unable to get your location. Please allow location access in your browser.")
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    }
  )
}

  useEffect(() => {
    if (!mapRef.current || !process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return

    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [77.5946, 12.9716],
      zoom: 12,
    })

    map.addControl(new mapboxgl.NavigationControl(), "top-right")

map.on("load", () => {
  console.log("Mapbox map loaded successfully")
  map.resize()
  setMapLoaded(true)
})

map.on("error", (event) => {
  console.error("Mapbox error:", event.error)
})

    mapInstanceRef.current = map
    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    stations.forEach((station) => {
      const el = document.createElement("div")
      el.className =
        "station-marker-wrapper cursor-pointer rounded-full bg-accent/80 p-2 shadow-glow-cyan hover:bg-accent"
      el.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([station.longitude, station.latitude])
        .addTo(mapInstanceRef.current!)

      el.addEventListener("click", () => {
        onStationSelect?.(station)
        mapInstanceRef.current?.flyTo({
          center: [station.longitude, station.latitude],
          zoom: 15,
          duration: 800,
        })
      })

      markersRef.current.push(marker)
    })
  }, [stations, mapLoaded, onStationSelect])

  useEffect(() => {
    if (!mapInstanceRef.current || !selectedStationId) return
    const station = stations.find((s) => s.id === selectedStationId)
    if (station) {
      mapInstanceRef.current.flyTo({
        center: [station.longitude, station.latitude],
        zoom: 15,
        duration: 800,
      })
    }
  }, [selectedStationId, stations])

  useEffect(() => {
    if (!mapInstanceRef.current || !userLocation) return
    mapInstanceRef.current.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: 14,
      duration: 1000,
    })
  }, [userLocation])

return (
  <div className={cn("relative h-full w-full min-h-[500px]", className)}>
    <div
      ref={mapRef}
      className="absolute inset-0 h-full w-full"
    />
    <MapControls onLocate={handleLocate} />
  </div>
)
}
