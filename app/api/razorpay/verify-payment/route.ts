
import { NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import Razorpay from "razorpay"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId,
    } = await request.json()

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !bookingId
    ) {
      return NextResponse.json(
        { error: "Missing payment details" },
        { status: 400 },
      )
    }

    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Payment service is not configured" },
        { status: 500 },
      )
    }

    // Authenticate the driver.
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      )
    }

    // Read the booking using the authenticated user's permissions.
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .eq("driver_id", user.id)
      .eq("razorpay_order_id", razorpay_order_id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 },
      )
    }

    // Verify Razorpay's payment signature.
    const expectedSignature = createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex")

    const expectedBuffer = Buffer.from(expectedSignature, "hex")
    const receivedBuffer = Buffer.from(razorpay_signature, "hex")

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return NextResponse.json(
        { error: "Payment signature verification failed" },
        { status: 400 },
      )
    }

    // Verify the payment directly with Razorpay.
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    })

    const payment = await razorpay.payments.fetch(razorpay_payment_id)

    if (
      payment.order_id !== razorpay_order_id ||
      payment.status !== "captured" ||
      payment.currency !== "INR" ||
      Number(payment.amount) !== Number(booking.amount_cents)
    ) {
      return NextResponse.json(
        { error: "Payment details could not be verified" },
        { status: 400 },
      )
    }

    // Confirm the booking and mark its slot booked atomically.
    const admin = createAdminClient()

    const { error: confirmationError } = await admin.rpc(
      "confirm_paid_booking",
      {
        p_booking_id: bookingId,
        p_order_id: razorpay_order_id,
        p_payment_id: razorpay_payment_id,
      },
    )

    if (confirmationError) {
      console.error("Booking confirmation error:", confirmationError)

      return NextResponse.json(
        { error: "Payment received, but booking confirmation failed. Please contact support." },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Razorpay verification error:", error)

    return NextResponse.json(
      { error: "Payment verification failed" },
      { status: 500 },
    )
  }
}
