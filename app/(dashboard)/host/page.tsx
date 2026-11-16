
"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useHostStats } from "@/hooks/useHostStats"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Skeleton } from "@/components/ui/Skeleton"
import { EarningsChart } from "@/components/host/EarningsChart"
import {
  IndianRupee,
  Zap,
  Star,
  Activity,
  Plus,
  MapPin,
} from "lucide-react"

export default function HostDashboardPage() {
  const supabase = createClient()

  const {
    data: authData,
    isLoading: authLoading,
  } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser()

      if (error) throw error

      return data
    },
  })

  const user = authData?.user

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
  } = useHostStats(user?.id ?? null)

  const {
    data: stations,
    isLoading: stationsLoading,
    isError: stationsError,
  } = useQuery({
    queryKey: ["host-stations", user?.id],

    queryFn: async () => {
      if (!user) return []

      const { data, error } = await supabase
        .from("stations")
        .select("*")
        .eq("host_id", user.id)
        .order("created_at", { ascending: false })

      if (error) throw error

      return data ?? []
    },

    enabled: !!user,
  })

  if (authLoading || statsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>

        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!user) {
    return (
      <Card className="p-8 text-center">
        <p className="font-medium text-text-primary">
          Please sign in to access your host dashboard.
        </p>

        <Button asChild className="mt-4">
          <Link href="/login">Sign In</Link>
        </Button>
      </Card>
    )
  }

  if (statsError) {
    return (
      <Card className="p-8 text-center">
        <p className="font-medium text-text-primary">
          Could not load host statistics.
        </p>

        <p className="mt-2 text-sm text-text-muted">
          Please refresh and try again.
        </p>
      </Card>
    )
  }

  const statCards = [
    {
      label: "Total Earnings",
      value: `₹${(stats?.totalEarnings ?? 0).toFixed(2)}`,
      icon: IndianRupee,
    },
    {
      label: "Today's Earnings",
      value: `₹${(stats?.todayEarnings ?? 0).toFixed(2)}`,
      icon: IndianRupee,
    },
    {
      label: "This Week",
      value: `₹${(stats?.weeklyEarnings ?? 0).toFixed(2)}`,
      icon: Activity,
    },
    {
      label: "This Month",
      value: `₹${(stats?.monthlyEarnings ?? 0).toFixed(2)}`,
      icon: IndianRupee,
    },
    {
      label: "Completed Bookings",
      value: stats?.completedBookings ?? 0,
      icon: Zap,
    },
    {
      label: "Active Sessions",
      value: stats?.activeSessions ?? 0,
      icon: Activity,
    },
    {
      label: "Total kWh",
      value: (stats?.totalKwh ?? 0).toFixed(1),
      icon: Zap,
    },
    {
      label: "Avg Rating",
      value: (stats?.avgRating ?? 0).toFixed(1),
      icon: Star,
    },
  ]

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Host Dashboard
          </h1>

          <p className="mt-1 text-sm text-text-muted">
            Manage your charging stations and earnings.
          </p>
        </div>

        <Button asChild>
          <Link href="/host/stations/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Station
          </Link>
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/10 p-2">
                <stat.icon className="h-5 w-5 text-accent" />
              </div>

              <div>
                <p className="text-sm text-text-muted">
                  {stat.label}
                </p>

                <p className="font-mono text-xl font-semibold tabular-nums text-text-primary">
                  {stat.value}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Earnings Chart */}
      <Card className="p-6">
        <h2 className="text-lg font-medium text-text-primary">
          Earnings (Last 30 Days)
        </h2>

        <div className="mt-4 h-64">
          <EarningsChart
            data={(stats?.earningsByDay ?? []).map((d) => ({
              date: d.date,
              earnings: d.amount,
            }))}
          />
        </div>
      </Card>

      {/* Earnings by Station */}
      <Card className="p-6">
        <div>
          <h2 className="text-lg font-medium text-text-primary">
            Earnings by Station
          </h2>

          <p className="mt-1 text-sm text-text-muted">
            Revenue generated by each charging station.
          </p>
        </div>

        <div className="mt-5 space-y-4">
          {(!stats?.earningsByStation ||
            stats.earningsByStation.length === 0) && (
            <p className="py-8 text-center text-sm text-text-muted">
              No completed bookings yet. Earnings will appear here
              once charging sessions are completed.
            </p>
          )}

          {stats?.earningsByStation.map((station) => (
            <div
              key={station.stationId}
              className="rounded-lg border border-border p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-text-primary">
                    {station.stationName}
                  </p>

                  <p className="mt-1 text-sm text-text-muted">
                    {station.bookings} completed{" "}
                    {station.bookings === 1 ? "booking" : "bookings"}
                  </p>
                </div>

                <p className="font-mono text-lg font-semibold text-accent">
                  ₹{station.amount.toFixed(2)}
                </p>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{
                    width: `${
                      stats.totalEarnings > 0
                        ? (station.amount / stats.totalEarnings) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Host Stations */}
      <Card className="p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-text-primary">
            Your Stations
          </h2>

          <Button variant="outline" size="sm" asChild>
            <Link href="/host/stations">
              View All
            </Link>
          </Button>
        </div>

        <div className="mt-4 space-y-3">

          {stationsLoading && (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          )}

          {stationsError && (
            <p className="py-6 text-center text-text-muted">
              Could not load your stations. Please try again.
            </p>
          )}

          {!stationsLoading &&
            !stationsError &&
            stations?.slice(0, 5).map((station) => (
              <Link
                key={station.id}
                href={`/host/stations/${station.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-border p-4 transition-colors hover:border-accent/50"
              >
                <div className="min-w-0">
                  <p className="font-medium text-text-primary">
                    {station.name}
                  </p>

                  <p className="mt-1 flex items-center gap-1 text-sm text-text-muted">
                    <MapPin className="h-3.5 w-3.5" />
                    {station.city ?? station.address ?? "Location unavailable"}
                  </p>

                  <p className="mt-1 text-xs capitalize text-text-muted">
                    {station.status}
                  </p>
                </div>

                <span className="shrink-0 font-mono text-accent">
                  ₹{Number(station.price_per_kwh).toFixed(2)}/kWh
                </span>
              </Link>
            ))}

          {!stationsLoading &&
            !stationsError &&
            (!stations || stations.length === 0) && (
              <div className="py-10 text-center">
                <Zap className="mx-auto h-10 w-10 text-text-muted" />

                <p className="mt-3 font-medium text-text-primary">
                  No stations listed yet
                </p>

                <p className="mt-1 text-sm text-text-muted">
                  Add your first charging station to get started.
                </p>

                <Button asChild className="mt-4">
                  <Link href="/host/stations/new">
                    Add Your First Station
                  </Link>
                </Button>
              </div>
            )}
        </div>
      </Card>
    </div>
  )
}
