
import { z } from "zod"

const CONNECTOR_TYPES = [
  "CCS2",
  "CHAdeMO",
  "J1772",
] as const

const AMENITIES = [
  "wifi",
  "restroom",
  "coffee",
  "shelter",
  "restaurant",
  "parking",
] as const

export const stationLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
})
export const stationHardwareSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100),
  description: z.string().max(500).optional(),
  connector_types: z
    .array(z.enum(CONNECTOR_TYPES))
    .min(1, "Select at least one connector type"),
  power_kw: z
    .number()
    .min(1, "Power must be at least 1 kW")
    .max(350, "Power cannot exceed 350 kW"),
  price_per_kwh: z
    .number()
    .min(0, "Price cannot be negative")
    .max(100, "Price cannot exceed ₹100 per kWh"),
  amenities: z
    .array(z.enum(AMENITIES))
    .default([]),
})
export const stationPhotosSchema = z.object({
  photos: z
    .array(z.string().url())
    .max(6, "You can upload a maximum of 6 photos")
    .default([]),
})

export const createStationSchema = stationLocationSchema
  .merge(stationHardwareSchema)
  .merge(stationPhotosSchema)
export const updateStationSchema =
  createStationSchema.partial()
export type StationLocationInput =
  z.infer<typeof stationLocationSchema>
export type StationHardwareInput =
  z.infer<typeof stationHardwareSchema>
export type CreateStationInput =
  z.infer<typeof createStationSchema>
export type UpdateStationInput =
  z.infer<typeof updateStationSchema>
