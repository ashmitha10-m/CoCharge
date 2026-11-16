
"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export function useBooking() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const cancelBooking = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", bookingId)

      if (error) throw error
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["bookings"],
      })
    },
  })

  return { cancelBooking }
}
