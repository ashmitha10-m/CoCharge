
"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Station } from "@/types"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Skeleton } from "@/components/ui/Skeleton"
import { SlotManager } from "@/components/host/SlotManager"
import {
  ArrowLeft,
  Pencil,
  Save,
  X,
  Star,
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

export default function HostStationDetailPage() {
  const params = useParams<{ id: string }>()
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    power_kw: "7.4",
    price_per_kwh: "12",
  })

  // Fetch station details
  const {
    data: station,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["station", params.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stations")
        .select("*")
        .eq("id", params.id)
        .single()

      if (error) throw error

      return data as Station
    },
  })

  // Fetch station reviews
  const {
    data: reviews,
    isLoading: reviewsLoading,
    error: reviewsError,
  } = useQuery({
    queryKey: ["station-reviews", params.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at")
        .eq("station_id", params.id)
        .order("created_at", { ascending: false })

      if (error) throw error

      return data ?? []
    },
    enabled: !!params.id,
  })

  // Start editing station
  const startEditing = () => {
    if (!station) return

    setFormData({
      name: station.name ?? "",
      description: station.description ?? "",
      address: station.address ?? "",
      city: station.city ?? "",
      state: station.state ?? "",
      zip: station.zip ?? "",
      power_kw: String(station.power_kw ?? 7.4),
      price_per_kwh: String(station.price_per_kwh ?? 12),
    })

    setErrorMessage("")
    setSuccessMessage("")
    setIsEditing(true)
  }

  // Save station details
  const handleSave = async () => {
    if (!station) return

    setErrorMessage("")
    setSuccessMessage("")

    if (formData.name.trim().length < 2) {
      setErrorMessage(
        "Station name must contain at least 2 characters."
      )
      return
    }

    const power = Number(formData.power_kw)
    const price = Number(formData.price_per_kwh)

    if (!Number.isFinite(power) || power < 1 || power > 350) {
      setErrorMessage(
        "Charging power must be between 1 and 350 kW."
      )
      return
    }

    if (!Number.isFinite(price) || price < 0 || price > 100) {
      setErrorMessage(
        "Price must be between ₹0 and ₹100 per kWh."
      )
      return
    }

    setIsSaving(true)

    try {
      const { error } = await supabase
        .from("stations")
        .update({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          address: formData.address.trim() || null,
          city: formData.city.trim() || null,
          state: formData.state.trim() || null,
          zip: formData.zip.trim() || null,
          power_kw: power,
          price_per_kwh: price,
        })
        .eq("id", station.id)

      if (error) throw error

      await queryClient.invalidateQueries({
        queryKey: ["station", params.id],
      })

      await queryClient.invalidateQueries({
        queryKey: ["host-stations"],
      })

      await queryClient.invalidateQueries({
        queryKey: ["stations"],
      })

      setIsEditing(false)
      setSuccessMessage(
        "Station details updated successfully!"
      )
    } catch (error) {
      console.error("Station update failed:", error)

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update station."
      )
    } finally {
      setIsSaving(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // Error state
  if (error || !station) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-red-400">
          Unable to load this station. Check that you have access to it.
        </p>

        <Link
          href="/host/stations"
          className="text-cyan-400 hover:underline"
        >
          Back to My Stations
        </Link>
      </div>
    )
  }

  const updateField = (
    field: keyof typeof formData,
    value: string
  ) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"

  const labelClass =
    "mb-2 block text-sm font-medium text-gray-300"

  return (
    <div className="space-y-6 p-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/host/stations">
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>

          <h1 className="text-2xl font-semibold">
            {station.name}
          </h1>
        </div>

        {!isEditing && (
          <Button onClick={startEditing}>
            <Pencil className="mr-2 size-4" />
            Edit Station
          </Button>
        )}
      </div>

      {/* Messages */}
      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400"
        >
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400"
        >
          {successMessage}
        </div>
      )}

      {/* Edit form */}
      {isEditing && (
        <Card className="space-y-5 p-6">
          <h2 className="text-lg font-semibold">
            Edit Station Details
          </h2>

          <div>
            <label className={labelClass}>
              Station Name
            </label>
            <input
              className={inputClass}
              value={formData.name}
              onChange={(e) =>
                updateField("name", e.target.value)
              }
            />
          </div>

          <div>
            <label className={labelClass}>
              Description
            </label>
            <textarea
              className={inputClass}
              rows={3}
              value={formData.description}
              onChange={(e) =>
                updateField("description", e.target.value)
              }
            />
          </div>

          <div>
            <label className={labelClass}>
              Address
            </label>
            <input
              className={inputClass}
              value={formData.address}
              onChange={(e) =>
                updateField("address", e.target.value)
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>City</label>
              <input
                className={inputClass}
                value={formData.city}
                onChange={(e) =>
                  updateField("city", e.target.value)
                }
              />
            </div>

            <div>
              <label className={labelClass}>State</label>
              <input
                className={inputClass}
                value={formData.state}
                onChange={(e) =>
                  updateField("state", e.target.value)
                }
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>ZIP Code</label>
            <input
              className={inputClass}
              value={formData.zip}
              onChange={(e) =>
                updateField("zip", e.target.value)
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                Charging Power (kW)
              </label>
              <input
                type="number"
                step="any"
                className={inputClass}
                value={formData.power_kw}
                onChange={(e) =>
                  updateField("power_kw", e.target.value)
                }
              />
            </div>

            <div>
              <label className={labelClass}>
                Price per kWh (₹)
              </label>
              <input
                type="number"
                step="any"
                className={inputClass}
                value={formData.price_per_kwh}
                onChange={(e) =>
                  updateField("price_per_kwh", e.target.value)
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="mr-2 size-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setIsEditing(false)
                setErrorMessage("")
              }}
              disabled={isSaving}
            >
              <X className="mr-2 size-4" />
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Station information */}
      {!isEditing && (
        <Card className="space-y-3 p-6">
          <h2 className="font-medium">
            Station Information
          </h2>

          <p className="text-sm text-gray-400">
            {station.description || "No description added."}
          </p>

          <p className="text-sm text-gray-400">
            {station.address}, {station.city}, {station.state}
          </p>

          <p className="text-sm">
            Charging Power: {station.power_kw} kW
          </p>

          <p className="text-sm">
            Price: ₹{station.price_per_kwh}/kWh
          </p>

          <p className="text-sm">
            Status: {station.status}
          </p>
        </Card>
      )}

      {/* Reviews and Ratings */}
      <Card className="space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              Reviews & Ratings
            </h2>

            <p className="mt-1 text-sm text-text-muted">
              Feedback shared by drivers who used this station.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />

            <span className="text-2xl font-semibold text-text-primary">
              {Number(station.avg_rating ?? 0).toFixed(1)}
            </span>

            <span className="text-sm text-text-muted">
              / 5
            </span>
          </div>
        </div>

        <p className="text-sm text-text-muted">
          {station.total_reviews ?? 0} total reviews
        </p>

        <div className="border-t border-white/10 pt-4">
          {reviewsLoading ? (
            <p className="text-sm text-text-muted">
              Loading reviews...
            </p>
          ) : reviewsError ? (
            <p className="text-sm text-red-400">
              Unable to load reviews. Please refresh.
            </p>
          ) : !reviews?.length ? (
            <div className="py-8 text-center">
              <Star className="mx-auto h-10 w-10 text-gray-500" />

              <p className="mt-3 font-medium text-text-primary">
                No reviews yet
              </p>

              <p className="mt-1 text-sm text-text-muted">
                Driver reviews will appear here after completed charging sessions.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="border-b border-white/10 pb-5 last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= review.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-500"
                          }`}
                        />
                      ))}
                    </div>

                    <span className="text-xs text-text-muted">
                      {format(
                        new Date(review.created_at),
                        "PPP"
                      )}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-text-primary">
                    {review.comment ||
                      "No written feedback provided."}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Slot management */}
      <Card className="p-6">
        <h2 className="mb-4 font-medium">
          Manage Slots
        </h2>

        <SlotManager stationId={station.id} />
      </Card>

    </div>
  )
}

