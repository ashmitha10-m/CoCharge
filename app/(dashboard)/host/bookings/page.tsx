
"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { BookingWithDetails } from "@/types"
import { Card } from "@/components/ui/Card"
import { Skeleton } from "@/components/ui/Skeleton"
import { Badge } from "@/components/ui/Badge"
import { BookingTrendsChart } from "@/components/host/BookingTrendsChart"
import {
  Calendar,
  Clock,
  MapPin,
  ClipboardList,
  User,
} from "lucide-react"
import { format, subDays } from "date-fns"

type BookingFilter =
  | "all"
  | "confirmed"
  | "active"
  | "completed"
  | "cancelled"
  | "pending"

type HostBooking = BookingWithDetails & {
  driverName: string
}

const FILTERS: {
  label: string
  value: BookingFilter
}[] = [
  { label: "All", value: "all" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Pending", value: "pending" },
]

export default function HostBookingsPage() {
  const supabase = createClient()
  const [filter, setFilter] = useState<BookingFilter>("all")

  const {
    data: bookings,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["host-bookings"],

    queryFn: async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError

      if (!user) {
        throw new Error("Please log in to view bookings.")
      }

      // Get stations owned by the logged-in host
      const { data: stations, error: stationError } =
        await supabase
          .from("stations")
          .select("id")
          .eq("host_id", user.id)

      if (stationError) throw stationError

      const stationIds = (stations ?? []).map(
        (station) => station.id
      )

      if (stationIds.length === 0) return []

      // Fetch bookings belonging to those stations
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          slot:slots(*),
          station:stations(*)
        `)
        .in("station_id", stationIds)
        .order("created_at", { ascending: false })

      if (error) throw error

      const bookingRows = (data ?? []) as BookingWithDetails[]

      if (bookingRows.length === 0) return []

      // Get unique driver IDs
      const driverIds = [
        ...new Set(
          bookingRows.map((booking) => booking.driver_id)
        ),
      ]

      // Fetch driver names
      const { data: profiles, error: profileError } =
        await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", driverIds)

      if (profileError) throw profileError

      const profileMap = new Map(
        (profiles ?? []).map((profile) => [
          profile.id,
          profile.full_name,
        ])
      )

      return bookingRows.map((booking) => ({
        ...booking,
        driverName:
          profileMap.get(booking.driver_id) || "Driver",
      })) as HostBooking[]
    },
  })

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <Card className="p-8 text-center">
        <p className="font-medium text-text-primary">
          Could not load host bookings
        </p>

        <p className="mt-2 text-sm text-text-muted">
          Please refresh the page and try again.
        </p>
      </Card>
    )
  }

  const allBookings = bookings ?? []

  // Prepare daily booking counts for the last 30 days
  const today = new Date()

  const bookingTrends = Array.from({ length: 30 }, (_, i) => {
    const date = subDays(today, 29 - i)
    const dateKey = format(date, "yyyy-MM-dd")

    const count = allBookings.filter((booking) => {
      return (
        format(new Date(booking.created_at), "yyyy-MM-dd") === dateKey
      )
    }).length

    return {
      date: dateKey,
      bookings: count,
    }
  })

  // Booking counts
  const countFor = (status: BookingFilter) => {
    if (status === "all") return allBookings.length

    return allBookings.filter(
      (booking) => booking.status === status
    ).length
  }

  // Apply selected filter
  const filteredBookings =
    filter === "all"
      ? allBookings
      : allBookings.filter(
          (booking) => booking.status === filter
        )

  // Badge colors
  const getStatusVariant = (status: string) => {
    if (
      status === "confirmed" ||
      status === "completed"
    ) {
      return "success" as const
    }

    if (
      status === "active" ||
      status === "pending"
    ) {
      return "warning" as const
    }

    if (
      status === "cancelled" ||
      status === "refunded"
    ) {
      return "error" as const
    }

    return "default" as const
  }

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Host Bookings
        </h1>

        <p className="mt-1 text-sm text-text-muted">
          View and manage reservations at your charging stations.
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">

        {/* Total Bookings */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted">
              Total Bookings
            </p>
            <ClipboardList className="size-5 text-accent" />
          </div>

          <p className="mt-3 text-2xl font-semibold text-text-primary">
            {countFor("all")}
          </p>
        </Card>

        {/* Confirmed */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted">
              Confirmed
            </p>
            <Calendar className="size-5 text-green-400" />
          </div>

          <p className="mt-3 text-2xl font-semibold text-text-primary">
            {countFor("confirmed")}
          </p>
        </Card>

        {/* Active Sessions */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted">
              Active Sessions
            </p>
            <Clock className="size-5 text-cyan-400" />
          </div>

          <p className="mt-3 text-2xl font-semibold text-text-primary">
            {countFor("active")}
          </p>
        </Card>

        {/* Completed */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted">
              Completed
            </p>
            <ClipboardList className="size-5 text-accent" />
          </div>

          <p className="mt-3 text-2xl font-semibold text-text-primary">
            {countFor("completed")}
          </p>
        </Card>

        {/* Cancelled */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted">
              Cancelled
            </p>
            <ClipboardList className="size-5 text-red-400" />
          </div>

          <p className="mt-3 text-2xl font-semibold text-text-primary">
            {countFor("cancelled")}
          </p>
        </Card>

      </div>

      {/* Booking Trends */}
      <Card className="p-6">
        <h2 className="text-lg font-medium text-text-primary">
          Booking Trends (Last 30 Days)
        </h2>

        <p className="mt-1 text-sm text-text-muted">
          Daily reservations across your charging stations.
        </p>

        <div className="mt-4">
          <BookingTrendsChart data={bookingTrends} />
        </div>
      </Card>

      {/* Booking Filters */}
      <div className="space-y-3">
        <h2 className="font-semibold text-text-primary">
          Filter Bookings
        </h2>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                filter === item.value
                  ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                  : "border-border text-text-secondary hover:border-accent/50"
              }`}
            >
              {item.label} ({countFor(item.value)})
            </button>
          ))}
        </div>
      </div>

      {/* Booking List */}
      <div className="space-y-4">

        <h2 className="text-lg font-semibold text-text-primary">
          {filter === "all"
            ? "All Bookings"
            : `${filter.charAt(0).toUpperCase()}${filter.slice(1)} Bookings`}
        </h2>

        {filteredBookings.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="size-12 text-text-muted" />

            <p className="mt-4 font-medium text-text-secondary">
              No bookings found
            </p>

            <p className="mt-1 text-sm text-text-muted">
              There are no bookings in this category.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">

            {filteredBookings.map((booking) => {
              const amountRupees =
                Number(booking.amount_cents ?? 0) / 100

              return (
                <Link
                  key={booking.id}
                  href={`/host/bookings/${booking.id}`}
                  className="block"
                >
                  <Card className="flex flex-col justify-between gap-4 p-4 transition-colors hover:border-accent/50 sm:flex-row sm:items-center">

                    {/* Booking Information */}
                    <div className="min-w-0 flex-1 space-y-2">

                      <h3 className="font-medium text-text-primary">
                        {booking.station?.name ??
                          "Charging Station"}
                      </h3>

                      {/* Driver */}
                      <p className="flex items-center gap-2 text-sm text-text-secondary">
                        <User className="size-4 text-text-muted" />
                        {booking.driverName}
                      </p>

                      {/* Location */}
                      {booking.station?.address && (
                        <p className="flex items-center gap-2 text-sm text-text-muted">
                          <MapPin className="size-3.5 shrink-0" />
                          {booking.station.address}
                        </p>
                      )}

                      {/* Booking Time */}
                      <p className="flex items-center gap-2 text-sm text-text-muted">
                        <Clock className="size-3.5 shrink-0" />

                        {booking.slot?.start_time
                          ? format(
                              new Date(booking.slot.start_time),
                              "PPP 'at' p"
                            )
                          : "Time unavailable"}
                      </p>

                      {/* Booking ID */}
                      <p className="text-xs text-text-muted">
                        Booking ID: {booking.id}
                      </p>

                    </div>

                    {/* Amount and Status */}
                    <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end">

                      <span className="font-mono font-semibold text-accent">
                        ₹{amountRupees.toFixed(2)}
                      </span>

                      <Badge
                        variant={getStatusVariant(booking.status)}
                      >
                        {booking.status.charAt(0).toUpperCase() +
                          booking.status.slice(1)}
                      </Badge>

                      <span className="text-xs text-text-muted">
                        View details →
                      </span>

                    </div>

                  </Card>
                </Link>
              )
            })}

          </div>
        )}
      </div>
    </div>
  )
}
