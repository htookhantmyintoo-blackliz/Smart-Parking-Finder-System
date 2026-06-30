/**
 * DATA LAYER (Sprint 1 Setup)
 * Fallback reference point and baseline static structures for Dublin City Centre.
 */
const FALLBACK_LOCATION = { lat: 53.3498, lng: -6.2603 };

const parkingAreas = [
  {
    id: "lot-001",
    name: "Trinity Street Car Park",
    coordinates: { lat: 53.3438, lng: -6.2636 },
    totalSpaces: 120,
    availableSpaces: 54,
  },
  {
    id: "lot-002",
    name: "St Stephen's Green Car Park",
    coordinates: { lat: 53.3381, lng: -6.2592 },
    totalSpaces: 180,
    availableSpaces: 12,
  },
  {
    id: "lot-003",
    name: "Jervis Centre Car Park",
    coordinates: { lat: 53.3477, lng: -6.2697 },
    totalSpaces: 200,
    availableSpaces: 0,
  },
  {
    id: "lot-004",
    name: "Drury Street Car Park",
    coordinates: { lat: 53.3417, lng: -6.2634 },
    totalSpaces: 90,
    availableSpaces: 31,
  },
  {
    id: "lot-005",
    name: "Setanta Place Car Park",
    coordinates: { lat: 53.3406, lng: -6.2576 },
    totalSpaces: 150,
    availableSpaces: 8,
  },
  {
    id: "lot-006",
    name: "Marlborough Street Car Park",
    coordinates: { lat: 53.3508, lng: -6.2603 },
    totalSpaces: 110,
    availableSpaces: 76,
  },
];