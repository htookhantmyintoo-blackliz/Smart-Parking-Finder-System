"use strict";

// Calculate distance between two lat/lng coordinates in km (Haversine formula)
function haversineDistanceKm(a, b) {
  if (!a || !b) return null;

  const lat1Val = Number(a.lat);
  const lng1Val = Number(a.lng);
  const lat2Val = Number(b.lat);
  const lng2Val = Number(b.lng);

  if (isNaN(lat1Val) || isNaN(lng1Val) || isNaN(lat2Val) || isNaN(lng2Val)) {
    return null;
  }

  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2Val - lat1Val);
  const dLng = toRad(lng2Val - lng1Val);
  const rLat1 = toRad(lat1Val);
  const rLat2 = toRad(lat2Val);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Work out whether a car park is Available / Almost Full / Full
function getStatus(area) {
  if (!area.totalSpaces || area.availableSpaces === 0) {
    return { key: "full", label: "Full" };
  }
  if (area.availableSpaces / area.totalSpaces <= 0.3) {
    return { key: "almost-full", label: "Almost Full" };
  }
  return { key: "available", label: "Available" };
}

// Attach distance + status to every area, then sort: closest first, and if two are equally close, the one with more free spaces wins.
function computeAreas(areas, userLocation) {
  return areas
    .map((area) => ({
      ...area,
      distanceKm:
        userLocation && area.coordinates
          ? haversineDistanceKm(userLocation, area.coordinates)
          : null,
      status: getStatus(area),
    }))
    .sort((a, b) => {
      const distA = a.distanceKm ?? Infinity;
      const distB = b.distanceKm ?? Infinity;
      if (distA !== distB) return distA - distB;
      return b.availableSpaces - a.availableSpaces;
    });
}

// Pick the best car park to recommend: closest one that still has free spaces. computedAreas should already be sorted by computeAreas().
// Returns null if every car park is full (E1 exceptional flow).
function bestAvailable(computedAreas) {
  const candidates = computedAreas.filter((area) => area.availableSpaces > 0);
  return candidates.length > 0 ? candidates[0] : null;
}

module.exports = {
  haversineDistanceKm,
  getStatus,
  computeAreas,
  bestAvailable,
};

if (typeof window !== "undefined") {
  window.ParkingLogic = { haversineDistanceKm, getStatus, computeAreas, bestAvailable };
}