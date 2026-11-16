
"use client"

import { useState } from "react"
import {
  useForm,
  type FieldPath,
} from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import {
  createStationSchema,
  stationLocationSchema,
  stationHardwareSchema,
  type CreateStationInput,
} from "@/lib/validations/station"

interface StationFormProps {
  onSubmit: (data: CreateStationInput) => Promise<void>
  isLoading: boolean
}

const CONNECTOR_OPTIONS = [
  { label: "CCS2", value: "CCS2" },
  { label: "CHAdeMO", value: "CHAdeMO" },
  { label: "J1772", value: "J1772" },
] as const

const AMENITY_OPTIONS = [
  { label: "Wi-Fi", value: "wifi" },
  { label: "Restroom", value: "restroom" },
  { label: "Coffee", value: "coffee" },
  { label: "Shelter", value: "shelter" },
  { label: "Restaurant", value: "restaurant" },
  { label: "Parking", value: "parking" },
] as const

const LOCATION_FIELDS: FieldPath<CreateStationInput>[] = [
  "address",
  "city",
  "state",
  "zip",
  "latitude",
  "longitude",
]

const HARDWARE_FIELDS: FieldPath<CreateStationInput>[] = [
  "name",
  "description",
  "connector_types",
  "power_kw",
  "price_per_kwh",
  "amenities",
]

export function StationForm({
  onSubmit,
  isLoading,
}: StationFormProps) {
  const [step, setStep] = useState(0)
  const [submitError, setSubmitError] = useState("")

  const {
    register,
    handleSubmit,
    getValues,
    trigger,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateStationInput>({
    resolver: zodResolver(createStationSchema),

    defaultValues: {
      address: "",
      city: "",
      state: "",
      zip: "",
      latitude: 12.9352,
      longitude: 77.6245,
      name: "",
      description: "",
      connector_types: [],
      power_kw: 7.4,
      price_per_kwh: 12,
      amenities: [],
      photos: [],
    },
  })

  const selectedConnectors = watch("connector_types")
  const selectedAmenities = watch("amenities")

  // Toggle connector selection
  const toggleConnector = (
    value: "CCS2" | "CHAdeMO" | "J1772"
  ) => {
    const updated = selectedConnectors.includes(value)
      ? selectedConnectors.filter((item) => item !== value)
      : [...selectedConnectors, value]

    setValue("connector_types", updated, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    })
  }

  // Toggle amenity selection
  const toggleAmenity = (
    value:
      | "wifi"
      | "restroom"
      | "coffee"
      | "shelter"
      | "restaurant"
      | "parking"
  ) => {
    const updated = selectedAmenities.includes(value)
      ? selectedAmenities.filter((item) => item !== value)
      : [...selectedAmenities, value]

    setValue("amenities", updated, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    })
  }

  // Validate current step before continuing
 const nextStep = () => {
  setSubmitError("")

  const currentValues = getValues()

  const result =
    step === 0
      ? stationLocationSchema.safeParse(currentValues)
      : stationHardwareSchema.safeParse(currentValues)

  console.log("Current step:", step)
  console.log("Validation result:", result)

  if (!result.success) {
    setSubmitError(
      result.error.issues
        .map((issue) => issue.message)
        .join(". ")
    )
    return
  }

  setStep((current) => Math.min(current + 1, 2))
}
  const previousStep = () => {
    setSubmitError("")
    setStep((current) => Math.max(current - 1, 0))
  }

  // Final form submission
  const submitForm = handleSubmit(
    async (data) => {
      setSubmitError("")

      console.log("Submitting station:", data)

      try {
        await onSubmit(data)
      } catch (error) {
        console.error("Station submission error:", error)

        setSubmitError(
          error instanceof Error
            ? error.message
            : "Unable to create station. Please try again."
        )
      }
    },
    (formErrors) => {
      console.error("Final form validation errors:", formErrors)
      setSubmitError(
        "Some fields are invalid. Please go back and check them."
      )
    }
  )

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"

  const labelClass =
    "mb-2 block text-sm font-medium text-gray-300"

  const errorClass =
    "mt-1 text-xs text-red-400"

  return (
    <form
      onSubmit={submitForm}
      className="space-y-7"
    >
      {/* Progress bar */}
      <div className="flex gap-2">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className={`h-1.5 flex-1 rounded-full ${
              item <= step
                ? "bg-cyan-400"
                : "bg-white/10"
            }`}
          />
        ))}
      </div>

      <p className="text-sm text-gray-400">
        Step {step + 1} of 3:{" "}
        {["Location", "Hardware", "Photos"][step]}
      </p>

      {/* STEP 1: LOCATION */}
      {step === 0 && (
        <div className="space-y-5">

          <div>
            <label className={labelClass}>
              Address
            </label>
            <input
              {...register("address")}
              placeholder="Enter station address"
              className={inputClass}
            />
            {errors.address && (
              <p className={errorClass}>
                {errors.address.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                City
              </label>
              <input
                {...register("city")}
                placeholder="Bengaluru"
                className={inputClass}
              />
              {errors.city && (
                <p className={errorClass}>
                  {errors.city.message}
                </p>
              )}
            </div>

            <div>
              <label className={labelClass}>
                State
              </label>
              <input
                {...register("state")}
                placeholder="Karnataka"
                className={inputClass}
              />
              {errors.state && (
                <p className={errorClass}>
                  {errors.state.message}
                </p>
              )}
            </div>
          </div>

          <div className="max-w-md">
            <label className={labelClass}>
              ZIP Code
            </label>
            <input
              {...register("zip")}
              placeholder="560095"
              className={inputClass}
            />
            {errors.zip && (
              <p className={errorClass}>
                {errors.zip.message}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>
              Latitude
            </label>
            <input
              type="number"
              step="any"
              {...register("latitude", {
                valueAsNumber: true,
              })}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter the latitude of your charging location.
            </p>
            {errors.latitude && (
              <p className={errorClass}>
                {errors.latitude.message}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>
              Longitude
            </label>
            <input
              type="number"
              step="any"
              {...register("longitude", {
                valueAsNumber: true,
              })}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter the longitude of your charging location.
            </p>
            {errors.longitude && (
              <p className={errorClass}>
                {errors.longitude.message}
              </p>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: HARDWARE */}
      {step === 1 && (
        <div className="space-y-5">

          <div>
            <label className={labelClass}>
              Station Name
            </label>
            <input
              {...register("name")}
              placeholder="My EV Charging Station"
              className={inputClass}
            />
            {errors.name && (
              <p className={errorClass}>
                {errors.name.message}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>
              Description
            </label>
            <textarea
              {...register("description")}
              rows={3}
              placeholder="Describe your charging station..."
              className={inputClass}
            />
            {errors.description && (
              <p className={errorClass}>
                {errors.description.message}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>
              Connector Types
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {CONNECTOR_OPTIONS.map((connector) => (
                <button
                  key={connector.value}
                  type="button"
                  onClick={() =>
                    toggleConnector(connector.value)
                  }
                  className={`rounded-lg border p-3 text-sm transition ${
                    selectedConnectors.includes(connector.value)
                      ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                      : "border-white/10 bg-white/5 text-gray-300"
                  }`}
                >
                  {connector.label}
                </button>
              ))}
            </div>

            {errors.connector_types && (
              <p className={errorClass}>
                {errors.connector_types.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                Charging Power (kW)
              </label>
              <input
                type="number"
                step="any"
                {...register("power_kw", {
                  valueAsNumber: true,
                })}
                className={inputClass}
              />
              {errors.power_kw && (
                <p className={errorClass}>
                  {errors.power_kw.message}
                </p>
              )}
            </div>

            <div>
              <label className={labelClass}>
                Price per kWh (₹)
              </label>
              <input
                type="number"
                step="any"
                {...register("price_per_kwh", {
                  valueAsNumber: true,
                })}
                className={inputClass}
              />
              {errors.price_per_kwh && (
                <p className={errorClass}>
                  {errors.price_per_kwh.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Amenities
            </label>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {AMENITY_OPTIONS.map((amenity) => (
                <button
                  key={amenity.value}
                  type="button"
                  onClick={() =>
                    toggleAmenity(amenity.value)
                  }
                  className={`rounded-lg border p-3 text-sm transition ${
                    selectedAmenities.includes(amenity.value)
                      ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                      : "border-white/10 bg-white/5 text-gray-300"
                  }`}
                >
                  {amenity.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: PHOTOS */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h3 className="text-lg font-semibold text-white">
              Station Photos
            </h3>

            <p className="mt-2 text-sm text-gray-400">
              Photo uploading is not configured yet.
              You can create your station without photos.
            </p>
          </div>

          <div className="rounded-xl border border-dashed border-white/20 p-8 text-center">
            <p className="text-sm text-gray-400">
              No photos added
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {submitError && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400"
        >
          {submitError}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex gap-3 pt-2">

        {step > 0 && (
          <button
            type="button"
            onClick={previousStep}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-white/15 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5 disabled:opacity-50"
          >
            Back
          </button>
        )}

        {step < 2 ? (
          <button
            type="button"
            onClick={nextStep}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-cyan-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-300 disabled:opacity-50"
          >
            Continue
          </button>
        ) : (
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 rounded-lg bg-cyan-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading
              ? "Creating Station..."
              : "Create Station"}
          </button>
        )}
      </div>
    </form>
  )
}
