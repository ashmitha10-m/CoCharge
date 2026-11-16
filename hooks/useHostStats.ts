
"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export interface HostStats {
  totalEarnings: number
  todayEarnings: number
  weeklyEarnings: number
  monthlyEarnings: number
  completedBookings: number
  activeSessions: number
  totalKwh: number
  avgRating: number
  earningsByDay: {
    date: string
    amount: number
  }[]
  earningsByStation: {
    stationId: string
    stationName: string
    amount: number
    bookings: number
  }[]
}

export function useHostStats(hostId: string | null) {
  return useQuery({
    queryKey: ["host-stats", hostId],

    queryFn: async (): Promise<HostStats> => {
      if (!hostId) {
        throw new Error("No host ID")
      }

      const supabase = createClient()

      const now = new Date()

      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)

      const weekStart = new Date(todayStart)
      const dayOfWeek = (weekStart.getDay() + 6) % 7
      weekStart.setDate(weekStart.getDate() - dayOfWeek)

      const monthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      )

      const thirtyDaysAgo = new Date(todayStart)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)

      const dateKey = (date: Date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, "0")
        const day = String(date.getDate()).padStart(2, "0")
        return `${year}-${month}-${day}`
      }

      // Fetch host stations
      const { data: hostStations, error: stationError } =
        await supabase
          .from("stations")
          .select("id, name, avg_rating, total_reviews")
          .eq("host_id", hostId)

      if (stationError) throw stationError

      const stations = hostStations ?? []
      const stationIds = stations.map((station) => station.id)

      const emptyStats: HostStats = {
        totalEarnings: 0,
        todayEarnings: 0,
        weeklyEarnings: 0,
        monthlyEarnings: 0,
        completedBookings: 0,
        activeSessions: 0,
        totalKwh: 0,
        avgRating: 0,
        earningsByDay: [],
        earningsByStation: [],
      }

      if (stationIds.length === 0) {
        return emptyStats
      }

      // Fetch relevant bookings
      const { data: bookings, error: bookingError } =
        await supabase
          .from("bookings")
          .select(
            "station_id, amount_cents, kwh_delivered, status, ended_at"
          )
          .in("station_id", stationIds)
          .in("status", ["confirmed", "active", "completed"])

      if (bookingError) throw bookingError

      const allBookings = bookings ?? []

      // Active sessions are counted separately
      const activeSessions = allBookings.filter(
        (booking) => booking.status === "active"
      ).length

      // Only completed bookings count as earned revenue
      const completed = allBookings.filter(
        (booking) => booking.status === "completed"
      )

      const totalEarnings = completed.reduce(
        (sum, booking) =>
          sum + (booking.amount_cents ?? 0) / 100,
        0
      )

      const completedBookings = completed.length

      const totalKwh = completed.reduce(
        (sum, booking) =>
          sum + (booking.kwh_delivered ?? 0),
        0
      )

      // Calculate earnings by completion date
      let todayEarnings = 0
      let weeklyEarnings = 0
      let monthlyEarnings = 0

      const earningsByDayMap = new Map<string, number>()

      for (const booking of completed) {
        if (!booking.ended_at) continue

        const completedAt = new Date(booking.ended_at)
        const amount = (booking.amount_cents ?? 0) / 100

        if (completedAt >= todayStart && completedAt <= now) {
          todayEarnings += amount
        }

        if (completedAt >= weekStart && completedAt <= now) {
          weeklyEarnings += amount
        }

        if (completedAt >= monthStart && completedAt <= now) {
          monthlyEarnings += amount
        }

        if (completedAt >= thirtyDaysAgo && completedAt <= now) {
          const day = dateKey(completedAt)

          earningsByDayMap.set(
            day,
            (earningsByDayMap.get(day) ?? 0) + amount
          )
        }
      }

      const earningsByDay = Array.from(
        earningsByDayMap.entries()
      )
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date))

      // Calculate earnings per station
      const stationEarningsMap = new Map<
        string,
        { amount: number; bookings: number }
      >()

      for (const booking of completed) {
        const current = stationEarningsMap.get(booking.station_id) ?? {
          amount: 0,
          bookings: 0,
        }

        current.amount += (booking.amount_cents ?? 0) / 100
        current.bookings += 1

        stationEarningsMap.set(booking.station_id, current)
      }

      const earningsByStation = stations
        .map((station) => {
          const earnings = stationEarningsMap.get(station.id)

          return {
            stationId: station.id,
            stationName: station.name,
            amount: earnings?.amount ?? 0,
            bookings: earnings?.bookings ?? 0,
          }
        })
        .sort((a, b) => b.amount - a.amount)

      // Calculate weighted average rating
      const totalReviews = stations.reduce(
        (sum, station) => sum + (station.total_reviews ?? 0),
        0
      )

      const avgRating =
        totalReviews > 0
          ? stations.reduce(
              (sum, station) =>
                sum +
                (station.avg_rating ?? 0) *
                  (station.total_reviews ?? 0),
              0
            ) / totalReviews
          : 0

      return {
        totalEarnings,
        todayEarnings,
        weeklyEarnings,
        monthlyEarnings,
        completedBookings,
        activeSessions,
        totalKwh,
        avgRating,
        earningsByDay,
        earningsByStation,
      }
    },

    enabled: !!hostId,
  })
}
