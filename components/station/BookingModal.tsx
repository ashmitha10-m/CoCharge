
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format, addDays, isSameDay } from "date-fns"
import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import type { Station, Slot } from "@/types"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"

interface BookingModalProps {
  station: Station
  slots: Slot[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = 1 | 2 | 3

interface RazorpayResponse {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  handler: (response: RazorpayResponse) => void
  modal: {
    ondismiss: () => void
  }
  theme: {
    color: string
  }
}

interface RazorpayInstance {
  open: () => void
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true)
      return
    }

    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)

    document.body.appendChild(script)
  })
}

export function BookingModal({
  station,
  slots,
  open,
  onOpenChange,
}: BookingModalProps) {
  const router = useRouter()

  const [step, setStep] = useState<Step>(1)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  // Reset booking details whenever the modal closes.
  useEffect(() => {
    if (!open) {
      setStep(1)
      setSelectedDate(new Date())
      setSelectedSlot(null)
      setPaymentError(null)
      setIsProcessing(false)
    }
  }, [open])

  // Get available future slots for the selected date.
  const availableSlots = slots.filter(
    (s) =>
      s.status === "available" &&
      new Date(s.start_time) > new Date() &&
      isSameDay(new Date(s.start_time), selectedDate),
  )

  // Create Razorpay order and open payment checkout.
  const handleCheckout = async () => {
    if (!selectedSlot || isProcessing) return

    setIsProcessing(true)
    setPaymentError(null)

    try {
      const loaded = await loadRazorpayScript()

      if (!loaded) {
        throw new Error("Could not load Razorpay. Please try again.")
      }

      // Create payment order on the server.
      const orderResponse = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slotId: selectedSlot.id,
        }),
      })

      const orderData = await orderResponse.json()

      if (!orderResponse.ok) {
        throw new Error(
          orderData.error || "Could not create payment order",
        )
      }

      // Open Razorpay Checkout.
      const razorpay = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "CoCharge",
        description: `Charging at ${station.name}`,
        order_id: orderData.orderId,

        handler: async (response) => {
          try {
            // Verify payment on the server.
            const verifyResponse = await fetch(
              "/api/razorpay/verify-payment",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  ...response,
                  bookingId: orderData.bookingId,
                }),
              },
            )

            const verifyData = await verifyResponse.json()

            if (!verifyResponse.ok) {
              throw new Error(
                verifyData.error || "Payment verification failed",
              )
            }

            onOpenChange(false)
            router.push("/bookings?success=true")
            router.refresh()
          } catch (error) {
            setPaymentError(
              error instanceof Error
                ? error.message
                : "Payment verification failed",
            )
          } finally {
            setIsProcessing(false)
          }
        },

        modal: {
          ondismiss: () => {
            setIsProcessing(false)
          },
        },

        theme: {
          color: "#16a34a",
        },
      })

      razorpay.open()
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : "Something went wrong",
      )

      setIsProcessing(false)
    }
  }

  // Calculate estimated price in paise.
  // Uses the same rounding method as the database function.
  const priceEstimate =
    selectedSlot && station
      ? Math.round(
          ((new Date(selectedSlot.end_time).getTime() -
            new Date(selectedSlot.start_time).getTime()) /
            (1000 * 60 * 60)) *
            station.power_kw *
            station.price_per_kwh *
            100,
        )
      : 0

  // Show the next seven days.
  const dates = Array.from({ length: 7 }, (_, i) =>
    addDays(new Date(), i),
  )

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          aria-describedby="booking-modal-description"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Book Charging Slot
            </h2>

            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded p-1 hover:bg-surface-2"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description
            id="booking-modal-description"
            className="sr-only"
          >
            Select a charging date and time, review your booking,
            and continue to payment.
          </Dialog.Description>

          {/* Progress bar */}
          <div className="mt-4 mb-6 h-1 w-full rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>

          {/* STEP 1: Select date and slot */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-text-muted">
                Select date
              </p>

              <div className="flex gap-2 overflow-x-auto pb-2">
                {dates.map((date) => (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => {
                      setSelectedDate(date)
                      setSelectedSlot(null)
                    }}
                    className={cn(
                      "shrink-0 rounded-lg border px-4 py-2 text-sm transition-colors",
                      isSameDay(date, selectedDate)
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border hover:border-accent/50",
                    )}
                  >
                    <span className="block font-medium">
                      {isSameDay(date, new Date())
                        ? "Today"
                        : format(date, "EEE")}
                    </span>
                    <span className="block text-xs">
                      {format(date, "MMM d")}
                    </span>
                  </button>
                ))}
              </div>

              <p className="text-sm text-text-muted">
                Select time slot
              </p>

              <div className="grid grid-cols-2 gap-2">
                {availableSlots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => {
                      setSelectedSlot(slot)
                      setPaymentError(null)
                      setStep(2)
                    }}
                    className="rounded-lg border border-border p-3 text-left transition-colors hover:border-accent/50 hover:bg-accent/5"
                  >
                    <span className="block font-medium">
                      {format(
                        new Date(slot.start_time),
                        "h:mm a",
                      )}
                      {" - "}
                      {format(
                        new Date(slot.end_time),
                        "h:mm a",
                      )}
                    </span>

                    <span className="mt-1 block text-xs text-text-muted">
                      Available
                    </span>
                  </button>
                ))}
              </div>

              {availableSlots.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-5 text-center">
                  <p className="text-sm font-medium">
                    No available slots
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Try selecting another date.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Confirm booking details */}
          {step === 2 && selectedSlot && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-surface-2 p-4">
                <h3 className="font-medium">
                  {station.name}
                </h3>

                <p className="mt-1 text-sm text-text-muted">
                  {format(
                    new Date(selectedSlot.start_time),
                    "EEE, MMM d",
                  )}
                  {" • "}
                  {format(
                    new Date(selectedSlot.start_time),
                    "h:mm a",
                  )}
                  {" - "}
                  {format(
                    new Date(selectedSlot.end_time),
                    "h:mm a",
                  )}
                </p>

                <p className="mt-2 text-sm text-text-muted">
                  Charging speed: {station.power_kw} kW
                </p>

                <p className="mt-2 font-mono text-accent tabular-nums">
                  ~₹{(priceEstimate / 100).toFixed(2)} estimated
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>

                <Button
                  className="flex-1"
                  onClick={() => setStep(3)}
                >
                  Continue to payment
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Payment */}
          {step === 3 && selectedSlot && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-surface-2 p-4">
                <p className="text-sm text-text-muted">
                  Total estimated amount
                </p>

                <p className="font-mono text-2xl tabular-nums text-accent">
                  ₹{(priceEstimate / 100).toFixed(2)}
                </p>

                <p className="mt-2 text-xs text-text-muted">
                  Payment will be processed securely through Razorpay.
                </p>
              </div>

              {paymentError && (
                <p className="text-sm text-red-500">
                  {paymentError}
                </p>
              )}

              <Button
                className="w-full"
                onClick={handleCheckout}
                disabled={isProcessing}
              >
                {isProcessing
                  ? "Processing..."
                  : "Pay with Razorpay"}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setPaymentError(null)
                  setStep(2)
                }}
                disabled={isProcessing}
              >
                Back
              </Button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

