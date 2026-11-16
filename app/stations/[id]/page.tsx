
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { StationDetailClient } from "./StationDetailClient"

export default async function StationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: station, error } = await supabase
    .from("stations")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !station) notFound()

  const now = new Date().toISOString()

  const { data: slots, error: slotsError } = await supabase
    .from("slots")
    .select("*")
    .eq("station_id", id)
    .eq("status", "available")
    .gte("start_time", now)
    .order("start_time", { ascending: true })

  if (slotsError) {
    console.error("Error fetching charging slots:", slotsError)
  }

  return (
    <div className="min-h-screen p-6">
      <StationDetailClient
        station={station}
        slots={slots ?? []}
      />
    </div>
  )
}
