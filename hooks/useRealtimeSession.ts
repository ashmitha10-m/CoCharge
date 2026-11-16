
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { ChargingSession } from "@/types"

export interface RealtimeSessionState {
  currentKw: number
  kwhDelivered: number
  batteryPercent: number
  status: ChargingSession["status"]
  elapsedSeconds: number
  updatedAt: string | null
}

export function useRealtimeSession(
  bookingId: string | null,
  startedAt?: string | null,
) {
  const [state, setState] = useState<RealtimeSessionState>({
    currentKw: 0,
    kwhDelivered: 0,
    batteryPercent: 0,
    status: "initializing",
    elapsedSeconds: 0,
    updatedAt: null,
  })

  // Fetch existing charging session and subscribe to updates
  useEffect(() => {
    if (!bookingId) return

    const supabase = createClient()
    let isMounted = true

    const fetchSession = async () => {
      const { data, error } = await supabase
        .from("charging_sessions")
        .select("*")
        .eq("booking_id", bookingId)
        .maybeSingle()

      if (error) {
        console.error("Error fetching charging session:", error)
        return
      }

      if (data && isMounted) {
        setState((previous) => ({
          ...previous,
          currentKw: Number(data.current_kw ?? 0),
          kwhDelivered: Number(data.kwh_delivered ?? 0),
          batteryPercent: Number(data.battery_percent ?? 0),
          status: data.status,
          updatedAt: data.updated_at,
        }))
      }
    }

    const channel = supabase
      .channel(`charging-session-${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "charging_sessions",
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          if (!isMounted || !payload.new) return

          const record = payload.new as ChargingSession

          setState((previous) => ({
            ...previous,
            currentKw: Number(record.current_kw ?? 0),
            kwhDelivered: Number(record.kwh_delivered ?? 0),
            batteryPercent: Number(record.battery_percent ?? 0),
            status: record.status,
            updatedAt: record.updated_at,
          }))
        },
      )
      .subscribe()

    fetchSession()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [bookingId])

  // Calculate elapsed charging time
  useEffect(() => {
    if (!startedAt) return

    const updateElapsed = () => {
      const startTime = new Date(startedAt).getTime()

      if (Number.isNaN(startTime)) return

      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - startTime) / 1000),
      )

      setState((previous) => ({
        ...previous,
        elapsedSeconds: elapsed,
      }))
    }

    updateElapsed()

    const interval = window.setInterval(updateElapsed, 1000)

    return () => window.clearInterval(interval)
  }, [startedAt])

  return state
}

