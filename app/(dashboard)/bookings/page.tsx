
"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { BookingWithDetails } from "@/types"
import { Card } from "@/components/ui/Card"
import { Skeleton } from "@/components/ui/Skeleton"
import { Badge } from "@/components/ui/Badge"
import {
  Calendar,
  Clock,
  MapPin,
  ClipboardList,
  Zap,
} from "lucide-react"
import { format } from "date-fns"

export default function DriverBookingsPage() {
  const supabase = createClient()

  const {
    data: bookings,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["driver-bookings"],

    queryFn: async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError
      if (!user) throw new Error("Please log in to view bookings.")

      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          slot:slots(*),
          station:stations(*)
        `)
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false })

      if (error) throw error

      return (data ?? []) as BookingWithDetails[]
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <Card className="p-8 text-center">
        <p className="font-medium text-text-primary">
          Could not load your bookings
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Please refresh the page and try again.
        </p>
      </Card>
    )
  }

  const totalBookings = bookings?.length ?? 0

  const confirmedBookings =
    bookings?.filter((booking) => booking.status === "confirmed").length ?? 0

  const activeBookings =
    bookings?.filter((booking) => booking.status === "active").length ?? 0

  const completedBookings =
    bookings?.filter((booking) => booking.status === "completed").length ?? 0

  const getStatusVariant = (status: string) => {
    if (status === "confirmed" || status === "completed") {
      return "success" as const
    }

    if (status === "active" || status === "pending") {
      return "warning" as const
    }

    if (status === "cancelled" || status === "refunded") {
      return "error" as const
    }

    return "default" as const
  }

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          My Bookings
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          View and track your charging reservations.
        </p>
      </div>

      {/* Booking Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted">Total Bookings</p>
            <ClipboardList className="size-5 text-accent" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-text-primary">
            {totalBookings}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted">Confirmed</p>
            <Calendar className="size-5 text-green-400" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-text-primary">
            {confirmedBookings}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted">Active Sessions</p>
            <Zap className="size-5 text-cyan-400" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-text-primary">
            {activeBookings}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted">Completed</p>
            <Calendar className="size-5 text-accent" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-text-primary">
            {completedBookings}
          </p>
        </Card>

      </div>

      {/* Bookings List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">
          All Bookings
        </h2>

        {!bookings?.length ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="size-12 text-text-muted" />
            <p className="mt-4 font-medium text-text-secondary">
              No bookings yet
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Your charging reservations will appear here.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => {
              const amountRupees =
                Number(booking.amount_cents ?? 0) / 100

              return (
                <Link
                  key={booking.id}
                  href={`/bookings/${booking.id}`}
                  className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Card className="flex cursor-pointer flex-col justify-between gap-4 p-4 transition-colors hover:border-accent/50 hover:bg-surface-2 sm:flex-row sm:items-center">

                    <div className="min-w-0 flex-1 space-y-2">

                      <h3 className="font-medium text-text-primary">
                        {booking.station?.name ?? "Charging Station"}
                      </h3>

                      {booking.station?.address && (
                        <p className="flex items-center gap-1 text-sm text-text-muted">
                          <MapPin className="size-3.5 shrink-0" />
                          {booking.station.address}
                        </p>
                      )}

                      <p className="flex items-center gap-1 text-sm text-text-muted">
                        <Clock className="size-3.5 shrink-0" />
                        {booking.slot?.start_time
                          ? format(
                              new Date(booking.slot.start_time),
                              "PPP 'at' p"
                            )
                          : "Time unavailable"}
                      </p>

                      <p className="text-xs text-text-muted">
                        Booking ID: {booking.id.slice(0, 8).toUpperCase()}
                      </p>

                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end">

                      <span className="font-mono font-semibold text-accent">
                        ₹{amountRupees.toFixed(2)}
                      </span>

                      <Badge variant={getStatusVariant(booking.status)}>
                        {booking.status.charAt(0).toUpperCase() +
                          booking.status.slice(1)}
                      </Badge>

                      <span className="text-xs text-accent">
                        View Details →
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
