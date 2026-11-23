import { z } from 'zod'

// Map pin fields shared by farmers and customers (set from the phone app).
// latitude and longitude go together: both numbers, or both null to clear the pin.
export const locationFields = {
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  locationAccuracy: z.number().int().nonnegative().max(100000).nullable().optional(),
  landmark: z.string().max(150).nullable().optional()
}

type LocationInput = {
  latitude?: number | null
  longitude?: number | null
  locationAccuracy?: number | null
  landmark?: string | null
}

// Zod refine: a pin needs both coordinates (or neither).
export const pinIsComplete = (d: LocationInput) =>
  (d.latitude === undefined) === (d.longitude === undefined) &&
  (d.latitude === null) === (d.longitude === null)

export const pinMessage = { message: 'latitude and longitude must be sent together', path: ['latitude'] }

type Stored = { latitude: unknown; longitude: unknown } | null

// Extra columns to write when the pin is set, moved or cleared: who did it and when.
// Sending the same pin again (a normal form save) changes nothing. Clearing it also clears its accuracy.
export function pinAudit(data: LocationInput, userId: string, existing: Stored = null) {
  if (data.latitude === undefined) return {}
  const oldLat = existing?.latitude == null ? null : Number(existing.latitude)
  const oldLng = existing?.longitude == null ? null : Number(existing.longitude)
  const same = (a: number | null, b: number | null | undefined) =>
    a === null || b == null ? a === (b ?? null) : Math.abs(a - b) < 0.0000005
  if (same(oldLat, data.latitude) && same(oldLng, data.longitude)) return {}
  const stamp = { locationUpdatedAt: new Date(), locationUpdatedById: userId }
  return data.latitude === null ? { ...stamp, locationAccuracy: null } : stamp
}
