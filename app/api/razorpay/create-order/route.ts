
import { NextResponse } from "next/server"
import Razorpay from "razorpay"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const { slotId } = await request.json()

    if (!slotId) {
      return NextResponse.json(
        { error: "Missing slot ID" },
        { status: 400 },
      )
    }

    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keyId || !keySecret) {
      console.error("Razorpay environment variables are missing")

      return NextResponse.json(
        { error: "Payment service is not configured" },
        { status: 500 },
      )
    }

    const supabase = await createClient()

    // Confirm the user is signed in.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in to continue" },
        { status: 401 },
      )
    }

    // Atomically reserve the slot and create a pending booking.
    const { data: reservations, error: reservationError } =
      await supabase.rpc("create_booking_reservation", {
        p_slot_id: slotId,
      })

    if (reservationError || !reservations?.length) {
      console.error("Slot reservation error:", reservationError)

      return NextResponse.json(
        {
          error:
            reservationError?.message ||
            "This charging slot is no longer available",
        },
        { status: 409 },
      )
    }

    const reservation = reservations[0]

    // Create a Razorpay order using the reserved booking amount.
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    })

    const order = await razorpay.orders.create({
      amount: Number(reservation.amount_paise),
      currency: "INR",
      receipt: `co_${Date.now()}`,
      notes: {
        booking_id: reservation.booking_id,
        slot_id: slotId,
        driver_id: user.id,
      },
    })

    // Attach the Razorpay order ID to the pending booking.
    const { error: attachError } = await supabase.rpc(
      "attach_razorpay_order",
      {
        p_booking_id: reservation.booking_id,
        p_order_id: order.id,
      },
    )

    if (attachError) {
      console.error("Razorpay order attachment error:", attachError)

      return NextResponse.json(
        { error: "Could not link payment to your booking" },
        { status: 500 },
      )
    }

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      bookingId: reservation.booking_id,
      keyId,
      reservedUntil: reservation.reserved_until,
    })
  } catch (error) {
    console.error("Razorpay create-order error:", error)

    return NextResponse.json(
      { error: "Failed to create payment order. Please try again." },
      { status: 500 },
    )
  }
}

