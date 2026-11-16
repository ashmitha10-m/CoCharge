
"use client"

import { useMemo } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { format, subDays, parseISO } from "date-fns"
import { cn } from "@/lib/utils"

interface BookingTrendsChartProps {
  data: {
    date: string
    bookings: number
  }[]
  className?: string
}

export function BookingTrendsChart({
  data,
  className,
}: BookingTrendsChartProps) {
  const chartData = useMemo(() => {
    const dataMap = new Map(
      data.map((item) => [item.date, item.bookings])
    )

    return Array.from({ length: 30 }, (_, i) => {
      const date = subDays(new Date(), 29 - i)
      const key = format(date, "yyyy-MM-dd")

      return {
        date: format(date, "MMM d"),
        bookings: dataMap.get(key) ?? 0,
      }
    })
  }, [data])

  return (
    <div className={cn("h-64 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient
              id="bookingGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            opacity={0.5}
          />

          <XAxis
            dataKey="date"
            stroke="var(--text-muted)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />

          <YAxis
            stroke="var(--text-muted)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "var(--text-primary)" }}
            formatter={(value) => [
              `${Number(value)} bookings`,
              "Bookings",
            ]}
          />

          <Area
            type="monotone"
            dataKey="bookings"
            stroke="#22d3ee"
            strokeWidth={2}
            fill="url(#bookingGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
