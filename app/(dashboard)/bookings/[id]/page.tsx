"use client"

import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { BookingWithDetails } from "@/types"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Skeleton } from "@/components/ui/Skeleton"
import { Badge } from "@/components/ui/Badge"
import { LiveSessionCard } from "@/components/session/LiveSessionCard"
import {
  ArrowLeft,
  MapPin,
  Clock,
  CreditCard,
  CheckCircle2,
  Calendar,
  Zap,
  Battery,
  Plug,
  IndianRupee,
  Timer,
  Wifi,
  Star,
} from "lucide-react"
import { format, differenceInSeconds } from "date-fns"

type DriverBookingDetails = BookingWithDetails & {
  chargingSession: {
    current_kw: number
    kwh_delivered: number
    battery_percent: number
    status: string
    updated_at: string
  } | null
}

export default function BookingDetailPage() {
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")

  const {
    data: booking,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["booking", id],
    queryFn: async (): Promise<DriverBookingDetails> => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        throw new Error("Please sign in to view this booking.")
      }

      // Fetch booking, slot and station
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          slot:slots(*),
          station:stations(*)
        `)
        .eq("id", id)
        .eq("driver_id", user.id)
        .single()

      if (error) throw error

      const bookingData = data as BookingWithDetails

      // Fetch charging session details
      const { data: session, error: sessionError } = await supabase
        .from("charging_sessions")
        .select(
          "current_kw, kwh_delivered, battery_percent, status, updated_at"
        )
        .eq("booking_id", id)
        .maybeSingle()

      if (sessionError) throw sessionError

      return {
        ...bookingData,
        chargingSession: session,
      }
    },
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data?.status === "active" ? 5000 : false,
  })

  // Fetch existing review
  const {
    data: existingReview,
    isLoading: isReviewLoading,
  } = useQuery({
    queryKey: ["booking-review", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("booking_id", id)
        .maybeSingle()

      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  // Submit review
  const reviewMutation = useMutation({
    mutationFn: async ({
      rating,
      comment,
    }: {
      rating: number
      comment: string
    }) => {
      if (!booking) throw new Error("Booking not found.")

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        throw new Error("Please sign in to submit a review.")
      }

      if (!booking.station?.id) {
        throw new Error("Station information is unavailable.")
      }

      const { error } = await supabase.from("reviews").insert({
        booking_id: id,
        driver_id: user.id,
        station_id: booking.station.id,
        rating,
        comment: comment.trim() || null,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["booking-review", id],
      })
      queryClient.invalidateQueries({
        queryKey: ["booking", id],
      })
      setRating(0)
      setComment("")
    },
  })

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
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
          Booking not found or could not be loaded.
        </p>

        <Button asChild className="mt-4">
          <Link href="/bookings">Back to Bookings</Link>
        </Button>
      </div>
    )
  }

  const isActive = booking.status === "active"
  const isConfirmed = booking.status === "confirmed"
  const isCompleted = booking.status === "completed"
  const isCancelled = booking.status === "cancelled"
  const isRefunded = booking.status === "refunded"

  const amountRupees = Number(booking.amount_cents ?? 0) / 100

  const station = booking.station
  const slot = booking.slot
  const session = booking.chargingSession

  const paymentStatus = booking.razorpay_payment_id
    ? "Payment successful"
    : isRefunded
      ? "Refunded"
      : isCancelled
        ? "Cancelled"
        : "Payment not confirmed"

  const statusVariant =
    isCompleted
      ? "success"
      : isConfirmed || isActive
        ? "accent"
        : isCancelled || isRefunded
          ? "error"
          : "default"

  const durationSeconds =
    booking.started_at && booking.ended_at
      ? Math.max(
          0,
          differenceInSeconds(
            new Date(booking.ended_at),
            new Date(booking.started_at)
          )
        )
      : null

  const durationText =
    durationSeconds !== null
      ? `${Math.floor(durationSeconds / 3600)}h ${Math.floor(
          (durationSeconds % 3600) / 60
        )}m`
      : "Not available"

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" asChild>
        <Link href="/bookings" className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to My Bookings
        </Link>
      </Button>

      {/* Booking heading */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            {station?.name ?? "Charging Session"}
          </h1>

          <p className="mt-1 text-sm text-text-muted">
            Booking reference: {booking.id.slice(0, 8).toUpperCase()}
          </p>

          <Badge variant={statusVariant} className="mt-3">
            {booking.status.charAt(0).toUpperCase() +
              booking.status.slice(1)}
          </Badge>
        </div>

        <div className="text-right">
          <p className="text-xs text-text-muted">Total Amount</p>
          <span className="font-mono text-2xl font-semibold text-accent">
            ₹{amountRupees.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Confirmation message */}
      {isConfirmed && (
        <Card className="flex items-start gap-3 border border-green-500/30 p-4">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-green-500" />
          <div>
            <p className="font-medium text-text-primary">
              Booking confirmed!
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Your payment was verified successfully.
              Your charging slot is reserved.
            </p>
          </div>
        </Card>
      )}

      {/* Active charging */}
      {isActive && (
        <LiveSessionCard
          bookingId={booking.id}
          startedAt={booking.started_at ?? booking.created_at}
        />
      )}

      {/* Completed message */}
      {isCompleted && (
        <Card className="border border-green-500/30 p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <div>
              <h2 className="font-semibold text-text-primary">
                Charging Completed
              </h2>
              <p className="text-sm text-text-muted">
                Your charging session has been completed successfully.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Reviews and Ratings */}
      {isCompleted && (
        <Card className="space-y-5 p-6">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
              <Star className="h-5 w-5 text-yellow-500" />
              Rate Your Experience
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Share your experience with this charging station.
            </p>
          </div>

          {isReviewLoading ? (
            <p className="text-sm text-text-muted">
              Checking your review...
            </p>
          ) : existingReview ? (
            <div className="rounded-lg bg-surface-2 p-4">
              <p className="font-medium text-text-primary">
                Thank you for your feedback!
              </p>

              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 ${
                      star <= existingReview.rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-text-muted"
                    }`}
                  />
                ))}
              </div>

              {existingReview.comment && (
                <p className="mt-3 text-sm text-text-secondary">
                  {existingReview.comment}
                </p>
              )}
            </div>
          ) : (
            <>
              <div>
                <p className="mb-3 text-sm font-medium text-text-primary">
                  How was your charging experience?
                </p>

                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      aria-label={`Rate ${star} out of 5 stars`}
                      aria-pressed={rating === star}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-8 w-8 ${
                          star <= rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-text-muted"
                        }`}
                      />
                    </button>
                  ))}
                </div>

                {rating === 0 && (
                  <p className="mt-2 text-xs text-text-muted">
                    Select a rating from 1 to 5 stars.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="review-comment"
                  className="mb-2 block text-sm font-medium text-text-primary"
                >
                  Your Feedback (Optional)
                </label>

                <textarea
                  id="review-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Tell us about your experience..."
                  rows={4}
                  maxLength={500}
                  className="w-full rounded-lg border border-border bg-surface-2 p-3 text-sm text-text-primary outline-none focus:border-accent"
                />

                <p className="mt-1 text-right text-xs text-text-muted">
                  {comment.length}/500
                </p>
              </div>

              {reviewMutation.isError && (
                <p className="text-sm text-red-500">
                  {reviewMutation.error.message}
                </p>
              )}

              <Button
                disabled={rating === 0 || reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ rating, comment })}
                className="w-full sm:w-auto"
              >
                {reviewMutation.isPending
                  ? "Submitting..."
                  : "Submit Review"}
              </Button>
            </>
          )}
        </Card>
      )}

      {/* Cancelled / refunded message */}
      {(isCancelled || isRefunded) && (
        <Card className="border border-red-500/30 p-4">
          <p className="font-medium text-text-primary">
            {isRefunded ? "Booking Refunded" : "Booking Cancelled"}
          </p>

          <p className="mt-1 text-sm text-text-muted">
            {isRefunded
              ? "This booking has been marked as refunded."
              : "This booking is no longer active."}
          </p>
        </Card>
      )}

      {/* Charging station details */}
      <Card className="space-y-5 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
          <MapPin className="h-5 w-5 text-accent" />
          Charging Station
        </h2>

        <div>
          <h3 className="text-xl font-semibold text-text-primary">
            {station?.name ?? "Charging Station"}
          </h3>

          <p className="mt-2 flex items-start gap-2 text-sm text-text-muted">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            {[
              station?.address,
              station?.city,
              station?.state,
              station?.zip,
            ]
              .filter(Boolean)
              .join(", ") || "Address unavailable"}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-surface-2 p-4">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Zap className="h-4 w-4" />
              Charging Power
            </div>
            <p className="mt-2 text-xl font-semibold text-text-primary">
              {station?.power_kw ?? "—"} kW
            </p>
          </div>

          <div className="rounded-lg bg-surface-2 p-4">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <IndianRupee className="h-4 w-4" />
              Price per Unit
            </div>
            <p className="mt-2 text-xl font-semibold text-text-primary">
              ₹{Number(station?.price_per_kwh ?? 0).toFixed(2)}/kWh
            </p>
          </div>
        </div>

        {/* Connector types */}
        <div>
          <p className="flex items-center gap-2 text-sm text-text-muted">
            <Plug className="h-4 w-4" />
            Connector Types
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            {station?.connector_types?.length ? (
              station.connector_types.map((connector) => (
                <Badge key={connector} variant="default">
                  {connector}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-text-secondary">
                Not specified
              </span>
            )}
          </div>
        </div>

        {/* Amenities */}
        {station?.amenities && station.amenities.length > 0 && (
          <div>
            <p className="flex items-center gap-2 text-sm text-text-muted">
              <Wifi className="h-4 w-4" />
              Available Amenities
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              {station.amenities.map((amenity) => (
                <Badge key={amenity} variant="default">
                  {amenity.charAt(0).toUpperCase() + amenity.slice(1)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Booking information */}
      <Card className="p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
          <Calendar className="h-5 w-5 text-accent" />
          Booking Details
        </h2>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-text-muted">Booking Date</dt>
            <dd className="mt-1 font-medium text-text-primary">
              {slot?.start_time
                ? format(new Date(slot.start_time), "PPP")
                : "Not available"}
            </dd>
          </div>

          <div>
            <dt className="flex items-center gap-2 text-sm text-text-muted">
              <Clock className="h-4 w-4" />
              Reserved Time
            </dt>
            <dd className="mt-1 font-medium text-text-primary">
              {slot?.start_time && slot?.end_time
                ? `${format(new Date(slot.start_time), "p")} – ${format(
                    new Date(slot.end_time),
                    "p"
                  )}`
                : "Not available"}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-text-muted">Booking Created</dt>
            <dd className="mt-1 font-medium text-text-primary">
              {booking.created_at
                ? format(new Date(booking.created_at), "PPP p")
                : "—"}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-text-muted">Booking ID</dt>
            <dd className="mt-1 break-all text-sm text-text-secondary">
              {booking.id}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-text-muted">Booking Status</dt>
            <dd className="mt-1 font-medium text-text-primary">
              {booking.status.charAt(0).toUpperCase() +
                booking.status.slice(1)}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-text-muted">Slot Status</dt>
            <dd className="mt-1 font-medium text-text-primary">
              {slot?.status ?? "—"}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Charging session summary */}
      <Card className="p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
          <Zap className="h-5 w-5 text-accent" />
          Charging Summary
        </h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-surface-2 p-4">
            <p className="text-sm text-text-muted">Energy Delivered</p>
            <p className="mt-2 font-mono text-xl font-semibold text-text-primary">
              {booking.kwh_delivered != null
                ? `${Number(booking.kwh_delivered).toFixed(2)} kWh`
                : "Not recorded"}
            </p>
          </div>

          <div className="rounded-lg bg-surface-2 p-4">
            <p className="flex items-center gap-2 text-sm text-text-muted">
              <Battery className="h-4 w-4" />
              Final Battery Level
            </p>
            <p className="mt-2 font-mono text-xl font-semibold text-text-primary">
              {session?.battery_percent != null
                ? `${session.battery_percent}%`
                : "Not recorded"}
            </p>
          </div>

          <div className="rounded-lg bg-surface-2 p-4">
            <p className="flex items-center gap-2 text-sm text-text-muted">
              <Timer className="h-4 w-4" />
              Charging Duration
            </p>
            <p className="mt-2 font-mono text-xl font-semibold text-text-primary">
              {durationText}
            </p>
          </div>

          <div className="rounded-lg bg-surface-2 p-4">
            <p className="text-sm text-text-muted">Session Status</p>
            <p className="mt-2 font-medium capitalize text-text-primary">
              {session?.status ?? "Not started"}
            </p>
          </div>
        </div>

        {booking.started_at && (
          <div className="mt-5 space-y-2 text-sm">
            <p className="text-text-muted">
              Started:{" "}
              <span className="text-text-primary">
                {format(new Date(booking.started_at), "PPP p")}
              </span>
            </p>

            {booking.ended_at && (
              <p className="text-text-muted">
                Completed:{" "}
                <span className="text-text-primary">
                  {format(new Date(booking.ended_at), "PPP p")}
                </span>
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Payment information */}
      <Card className="p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
          <CreditCard className="h-5 w-5 text-accent" />
          Payment Details
        </h2>

        <dl className="mt-5 space-y-4">
          <div className="flex justify-between gap-4">
            <dt className="text-sm text-text-muted">Payment Provider</dt>
            <dd className="font-medium text-text-primary">Razorpay</dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-sm text-text-muted">Total Amount</dt>
            <dd className="font-mono font-semibold text-text-primary">
              ₹{amountRupees.toFixed(2)}
            </dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-sm text-text-muted">Price per kWh</dt>
            <dd className="font-medium text-text-primary">
              ₹{Number(station?.price_per_kwh ?? 0).toFixed(2)}
            </dd>
          </div>

          <div className="flex justify-between gap-4">
            <dt className="text-sm text-text-muted">Payment Status</dt>
            <dd className="font-medium text-text-primary">
              {paymentStatus}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-text-muted">
              Razorpay Payment ID
            </dt>
            <dd className="mt-1 break-all text-sm text-text-secondary">
              {booking.razorpay_payment_id ?? "Not available"}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-text-muted">
              Razorpay Order ID
            </dt>
            <dd className="mt-1 break-all text-sm text-text-secondary">
              {booking.razorpay_order_id ?? "Not available"}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}