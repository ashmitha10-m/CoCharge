
"use client"

import { useParams } from "next/navigation"
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { useState } from "react"
import Link from "next/link"

import { createClient } from "@/lib/supabase/client"
import type { BookingWithDetails } from "@/types"

import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Skeleton } from "@/components/ui/Skeleton"
import { Badge } from "@/components/ui/Badge"

import {
  ArrowLeft,
  MapPin,
  Clock,
  CreditCard,
  User,
  CheckCircle2,
  Calendar,
  Zap,
  Battery,
} from "lucide-react"

import { format } from "date-fns"

type HostBookingDetails = BookingWithDetails & {
  driverName: string
}

export default function HostBookingDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const supabase = createClient()
  const queryClient = useQueryClient()

  const [energyDelivered, setEnergyDelivered] = useState("")
  const [batteryPercent, setBatteryPercent] = useState("")

  // Fetch booking details
  const {
    data: booking,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["host-booking", id],

    queryFn: async (): Promise<HostBookingDetails> => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        throw new Error("Please sign in to view this booking.")
      }

      // Get stations belonging to the logged-in host
      const { data: stations, error: stationError } =
        await supabase
          .from("stations")
          .select("id")
          .eq("host_id", user.id)

      if (stationError) throw stationError

      const stationIds = (stations ?? []).map(
        (station) => station.id
      )

      if (stationIds.length === 0) {
        throw new Error("You do not own any stations.")
      }

      // Fetch booking only from the host's own stations
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          slot:slots(*),
          station:stations(*)
        `)
        .eq("id", id)
        .in("station_id", stationIds)
        .single()

      if (error) throw error

      const bookingData = data as BookingWithDetails

      // Fetch driver's profile
      const { data: profiles, error: profileError } =
        await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", [bookingData.driver_id])

      if (profileError) throw profileError

      const driverName =
        profiles?.[0]?.full_name?.trim() || "Driver"

      return {
        ...bookingData,
        driverName,
      }
    },

    enabled: !!id,
  })

  // Start charging
  const startChargingMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc(
        "start_charging_session",
        {
          p_booking_id: id,
        }
      )

      if (error) throw error

      return data
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["host-booking", id],
      })

      await queryClient.invalidateQueries({
        queryKey: ["host-bookings"],
      })
    },
  })

  // Stop charging
  const stopChargingMutation = useMutation({
    mutationFn: async () => {
      const energy = Number(energyDelivered)
      const battery = Number(batteryPercent)

      if (
        energyDelivered.trim() === "" ||
        !Number.isFinite(energy) ||
        energy < 0
      ) {
        throw new Error("Enter a valid energy value.")
      }

      if (
        batteryPercent.trim() === "" ||
        !Number.isInteger(battery) ||
        battery < 0 ||
        battery > 100
      ) {
        throw new Error(
          "Battery percentage must be between 0 and 100."
        )
      }

      const { data, error } = await supabase.rpc(
        "stop_charging_session",
        {
          p_booking_id: id,
          p_kwh_delivered: energy,
          p_battery_percent: battery,
        }
      )

      if (error) throw error

      return data
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["host-booking", id],
      })

      await queryClient.invalidateQueries({
        queryKey: ["host-bookings"],
      })

      setEnergyDelivered("")
      setBatteryPercent("")
    },
  })

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  // Error state
  if (isError || !booking) {
    return (
      <div className="py-12 text-center">
        <p className="text-text-secondary">
          Booking not found or you don't have access to it.
        </p>

        <Button asChild className="mt-4">
          <Link href="/host/bookings">
            Back to Host Bookings
          </Link>
        </Button>
      </div>
    )
  }

  const amountRupees =
    Number(booking.amount_cents ?? 0) / 100

  const isConfirmed = booking.status === "confirmed"
  const isActive = booking.status === "active"
  const isCompleted = booking.status === "completed"

  const statusVariant =
    isCompleted
      ? "success"
      : isConfirmed || isActive
        ? "accent"
        : booking.status === "cancelled" ||
            booking.status === "refunded"
          ? "error"
          : "default"

  return (
    <div className="space-y-6">

      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link
          href="/host/bookings"
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Host Bookings
        </Link>
      </Button>

      {/* Booking Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            {booking.station?.name ?? "Charging Session"}
          </h1>

          <p className="mt-1 text-sm text-text-muted">
            Booking reference:{" "}
            {booking.id.slice(0, 8).toUpperCase()}
          </p>

          <Badge variant={statusVariant} className="mt-3">
            {booking.status.charAt(0).toUpperCase() +
              booking.status.slice(1)}
          </Badge>
        </div>

        <span className="font-mono text-xl tabular-nums text-accent">
          ₹{amountRupees.toFixed(2)}
        </span>
      </div>

      {/* Confirmation Message */}
      {isConfirmed && (
        <Card className="flex items-start gap-3 border border-green-500/30 p-4">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-green-500" />

          <div>
            <p className="font-medium text-text-primary">
              Booking confirmed
            </p>

            <p className="mt-1 text-sm text-text-muted">
              Payment was verified and the charging slot is reserved.
            </p>
          </div>
        </Card>
      )}

      {/* Start Charging */}
      {isConfirmed && (
        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <Zap className="h-6 w-6 text-accent" />

            <div>
              <h2 className="text-lg font-medium text-text-primary">
                Charging Session
              </h2>

              <p className="text-sm text-text-muted">
                Start charging for this confirmed booking.
              </p>
            </div>
          </div>

          <Button
            className="w-full"
            disabled={startChargingMutation.isPending}
            onClick={() => startChargingMutation.mutate()}
          >
            {startChargingMutation.isPending
              ? "Starting Charging..."
              : "Start Charging"}
          </Button>

          {startChargingMutation.isError && (
            <p className="text-sm text-red-500">
              {startChargingMutation.error.message}
            </p>
          )}
        </Card>
      )}

      {/* Active Charging / Stop Charging */}
      {isActive && (
        <Card className="space-y-5 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/20">
              <Zap className="h-5 w-5 text-accent" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Charging in Progress
              </h2>

              <p className="text-sm text-text-muted">
                Enter the final charging measurements to complete this session.
              </p>
            </div>
          </div>

          {/* Energy Delivered */}
          <div className="space-y-2">
            <label
              htmlFor="energy-delivered"
              className="flex items-center gap-2 text-sm font-medium text-text-primary"
            >
              <Zap className="h-4 w-4" />
              Energy Delivered (kWh)
            </label>

            <input
              id="energy-delivered"
              type="number"
              min="0"
              step="0.01"
              value={energyDelivered}
              onChange={(e) =>
                setEnergyDelivered(e.target.value)
              }
              placeholder="Example: 12.5"
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-text-primary outline-none focus:border-accent"
            />
          </div>

          {/* Battery Percentage */}
          <div className="space-y-2">
            <label
              htmlFor="battery-percent"
              className="flex items-center gap-2 text-sm font-medium text-text-primary"
            >
              <Battery className="h-4 w-4" />
              Final Battery Percentage (%)
            </label>

            <input
              id="battery-percent"
              type="number"
              min="0"
              max="100"
              step="1"
              value={batteryPercent}
              onChange={(e) =>
                setBatteryPercent(e.target.value)
              }
              placeholder="Example: 85"
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-text-primary outline-none focus:border-accent"
            />
          </div>

          {/* Stop Charging Button */}
          <Button
            className="w-full"
            disabled={stopChargingMutation.isPending}
            onClick={() => stopChargingMutation.mutate()}
          >
            {stopChargingMutation.isPending
              ? "Stopping Charging..."
              : "Stop Charging & Complete Booking"}
          </Button>

          {stopChargingMutation.isError && (
            <p className="text-sm text-red-500">
              {stopChargingMutation.error instanceof Error
                ? stopChargingMutation.error.message
                : "Unable to stop charging. Please try again."}
            </p>
          )}
        </Card>
      )}

      {/* Completed Session */}
      {isCompleted && (
        <Card className="flex items-start gap-3 border border-green-500/30 p-5">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-green-500" />

          <div>
            <h2 className="font-semibold text-text-primary">
              Charging Completed
            </h2>

            <p className="mt-1 text-sm text-text-muted">
              This charging session has been successfully completed.
            </p>

            <p className="mt-2 font-mono text-text-primary">
              Energy Delivered: {booking.kwh_delivered ?? 0} kWh
            </p>
          </div>
        </Card>
      )}

      {/* Driver Information */}
      <Card className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-lg font-medium text-text-primary">
          <User className="h-5 w-5" />
          Driver Information
        </h2>

        <div>
          <p className="text-sm text-text-muted">Driver Name</p>
          <p className="mt-1 font-medium text-text-primary">
            {booking.driverName}
          </p>
        </div>

        <div>
          <p className="text-sm text-text-muted">Driver ID</p>
          <p className="mt-1 break-all text-sm text-text-secondary">
            {booking.driver_id}
          </p>
        </div>
      </Card>

      {/* Charging Details */}
      <Card className="p-6">
        <h2 className="text-lg font-medium text-text-primary">
          Charging Details
        </h2>

        <dl className="mt-4 grid gap-5 sm:grid-cols-2">

          <div>
            <dt className="flex items-center gap-2 text-sm text-text-muted">
              <MapPin className="h-4 w-4" />
              Station
            </dt>

            <dd className="mt-1 font-medium">
              {booking.station?.name ?? "—"}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-text-muted">Address</dt>
            <dd className="mt-1 font-medium">
              {booking.station?.address ?? "—"}
            </dd>
          </div>

          <div>
            <dt className="flex items-center gap-2 text-sm text-text-muted">
              <Calendar className="h-4 w-4" />
              Date
            </dt>

            <dd className="mt-1 font-medium">
              {booking.slot?.start_time
                ? format(
                    new Date(booking.slot.start_time),
                    "PPP"
                  )
                : "—"}
            </dd>
          </div>

          <div>
            <dt className="flex items-center gap-2 text-sm text-text-muted">
              <Clock className="h-4 w-4" />
              Time Slot
            </dt>

            <dd className="mt-1 font-medium">
              {booking.slot?.start_time &&
              booking.slot?.end_time
                ? `${format(
                    new Date(booking.slot.start_time),
                    "p"
                  )} – ${format(
                    new Date(booking.slot.end_time),
                    "p"
                  )}`
                : "—"}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-text-muted">
              Charging Power
            </dt>

            <dd className="mt-1 font-medium">
              {booking.station?.power_kw
                ? `${booking.station.power_kw} kW`
                : "—"}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-text-muted">
              Energy Delivered
            </dt>

            <dd className="mt-1 font-mono">
              {booking.kwh_delivered ?? "Not recorded"}
              {booking.kwh_delivered != null ? " kWh" : ""}
            </dd>
          </div>

        </dl>
      </Card>

      {/* Payment Details */}
      <Card className="p-6">
        <h2 className="flex items-center gap-2 text-lg font-medium text-text-primary">
          <CreditCard className="h-5 w-5" />
          Payment Details
        </h2>

        <dl className="mt-4 space-y-4">

          <div className="flex justify-between gap-4">
            <dt className="text-sm text-text-muted">
              Payment Provider
            </dt>

            <dd className="font-medium">Razorpay</dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-sm text-text-muted">
              Amount
            </dt>

            <dd className="font-mono font-medium">
              ₹{amountRupees.toFixed(2)}
            </dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-sm text-text-muted">
              Payment Status
            </dt>

            <dd className="font-medium">
              {booking.razorpay_payment_id
                ? "Payment recorded"
                : booking.status === "cancelled"
                  ? "Cancelled / not confirmed"
                  : "Not confirmed"}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-text-muted">
              Razorpay Payment ID
            </dt>

            <dd className="mt-1 break-all text-sm">
              {booking.razorpay_payment_id ?? "Not available"}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-text-muted">
              Razorpay Order ID
            </dt>

            <dd className="mt-1 break-all text-sm">
              {booking.razorpay_order_id ?? "Not available"}
            </dd>
          </div>

        </dl>
      </Card>

    </div>
  )
}
