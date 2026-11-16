
"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import type { Slot } from "@/types"
import { Badge } from "@/components/ui/Badge"
import { Skeleton } from "@/components/ui/Skeleton"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"
import { Plus, RefreshCw } from "lucide-react"

interface SlotManagerProps {
  stationId: string
  slots?: Slot[]
  onSlotClick?: (slot: Slot) => void
}

const statusVariant: Record<
  string,
  "success" | "secondary" | "warning" | "default"
> = {
  available: "success",
  pending: "warning",
  booked: "secondary",
  charging: "warning",
  completed: "default",
}

function getToday() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

export function SlotManager({
  stationId,
  slots: slotsProp,
  onSlotClick,
}: SlotManagerProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState(getToday())
  const [startTime, setStartTime] = useState("08:00")
  const [endTime, setEndTime] = useState("09:00")
  const [isAdding, setIsAdding] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const {
    data: fetchedSlots,
    isLoading,
    error: fetchError,
  } = useQuery({
    queryKey: ["slots", stationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("slots")
        .select("*")
        .eq("station_id", stationId)
        .order("start_time", { ascending: true })

      if (error) throw error

      return (data ?? []) as Slot[]
    },
    enabled: !!stationId && !slotsProp,
  })

  const slots = slotsProp ?? fetchedSlots ?? []

  const handleAddSlot = async () => {
    setErrorMessage("")
    setSuccessMessage("")

    if (!date || !startTime || !endTime) {
      setErrorMessage("Please select a date, start time and end time.")
      return
    }

    // Interpret the selected times in the browser's local timezone.
    const start = new Date(`${date}T${startTime}:00`)
    const end = new Date(`${date}T${endTime}:00`)

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      setErrorMessage("Please enter valid date and time values.")
      return
    }

    if (start <= new Date()) {
      setErrorMessage("The slot must start in the future.")
      return
    }

    if (end <= start) {
      setErrorMessage("End time must be later than start time.")
      return
    }

    setIsAdding(true)

    try {
      const startISO = start.toISOString()
      const endISO = end.toISOString()

      // Prevent overlapping slots for this station.
      const { data: conflicts, error: conflictError } = await supabase
        .from("slots")
        .select("id")
        .eq("station_id", stationId)
        .lt("start_time", endISO)
        .gt("end_time", startISO)
        .limit(1)

      if (conflictError) throw conflictError

      if (conflicts && conflicts.length > 0) {
        throw new Error(
          "This time overlaps with an existing slot. Please choose another time."
        )
      }

      const { error } = await supabase
        .from("slots")
        .insert({
          station_id: stationId,
          start_time: startISO,
          end_time: endISO,
          status: "available",
        })

      if (error) throw error

      await queryClient.invalidateQueries({
        queryKey: ["slots", stationId],
      })

      setSuccessMessage("Charging slot added successfully!")
      setShowForm(false)
      setStartTime("08:00")
      setEndTime("09:00")
    } catch (error) {
      console.error("Adding slot failed:", error)

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to add the charging slot."
      )
    } finally {
      setIsAdding(false)
    }
  }

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"

  if (isLoading && !slotsProp) {
    return <Skeleton className="h-24 w-full" />
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-text-secondary">
            Charging Time Slots
          </h3>
          <p className="mt-1 text-xs text-text-muted">
            Manage when drivers can charge at this station.
          </p>
        </div>

        <Button
          onClick={() => {
            setErrorMessage("")
            setSuccessMessage("")
            setShowForm((previous) => !previous)
          }}
        >
          <Plus className="mr-2 size-4" />
          {showForm ? "Close" : "Add Slot"}
        </Button>
      </div>

      {/* Add Slot Form */}
      {showForm && (
        <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <h4 className="font-medium text-white">
            Create Available Slot
          </h4>

          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Date
            </label>
            <input
              type="date"
              min={getToday()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-gray-300">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(event) =>
                  setStartTime(event.target.value)
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-300">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(event) =>
                  setEndTime(event.target.value)
                }
                className={inputClass}
              />
            </div>
          </div>

          {errorMessage && (
            <p role="alert" className="text-sm text-red-400">
              {errorMessage}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleAddSlot}
              disabled={isAdding}
            >
              {isAdding ? "Adding..." : "Create Slot"}
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false)
                setErrorMessage("")
              }}
              disabled={isAdding}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {successMessage && (
        <p
          role="status"
          className="text-sm text-green-400"
        >
          {successMessage}
        </p>
      )}

      {!slotsProp && fetchError && (
        <p className="text-sm text-red-400">
          Unable to load slots. Please refresh the page.
        </p>
      )}

      {/* Slot List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-text-secondary">
            Existing Slots ({slots.length})
          </p>

          {!slotsProp && (
            <button
              type="button"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: ["slots", stationId],
                })
              }
              className="text-text-muted transition hover:text-white"
              aria-label="Refresh slots"
            >
              <RefreshCw className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {slots.map((slot) => (
            <button
              key={slot.id}
              type="button"
              onClick={() => onSlotClick?.(slot)}
              disabled={
                slot.status !== "available" || !onSlotClick
              }
              className={cn(
                "rounded-lg border px-3 py-2 text-sm transition-colors",
                slot.status === "available"
                  ? "border-accent/50 bg-accent/5"
                  : "cursor-not-allowed border-border bg-surface opacity-75"
              )}
            >
              <span className="font-mono tabular-nums">
                {format(new Date(slot.start_time), "dd MMM, HH:mm")}
                {" – "}
                {format(new Date(slot.end_time), "HH:mm")}
              </span>

              <Badge
                variant={statusVariant[slot.status] ?? "default"}
                className="ml-2 text-xs"
              >
                {slot.status}
              </Badge>
            </button>
          ))}
        </div>

        {slots.length === 0 && (
          <p className="text-sm text-text-muted">
            No slots configured. Add a slot to make this station
            available for drivers.
          </p>
        )}
      </div>
    </div>
  )
}
