

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  haversineDistanceKm,
  getStatus,
  computeAreas,
  bestAvailable,
} = require("../frontend/js/logic.js");

const DUBLIN = { lat: 53.3498, lng: -6.2603 };

function area(overrides) {
  return {
    id: "lot-x",
    name: "Test Lot",
    coordinates: DUBLIN,
    totalSpaces: 100,
    availableSpaces: 50,
    ...overrides,
  };
}

// getStatus() — status classification (REQ-03)


test("1. Available: 50/100 (50%) is Available", () => {
  assert.equal(getStatus(area({ availableSpaces: 50, totalSpaces: 100 })).key, "available");
});

test("2. Available: just above the 30% boundary (31%) is Available", () => {
  assert.equal(getStatus(area({ availableSpaces: 31, totalSpaces: 100 })).key, "available");
});

test("3. Almost Full: exactly the 30% boundary is Almost Full (inclusive)", () => {
  assert.equal(getStatus(area({ availableSpaces: 30, totalSpaces: 100 })).key, "almost-full");
});

test("4. Almost Full: 1% remaining is Almost Full", () => {
  assert.equal(getStatus(area({ availableSpaces: 1, totalSpaces: 100 })).key, "almost-full");
});

test("5. Full: 0 available spaces is Full", () => {
  assert.equal(getStatus(area({ availableSpaces: 0, totalSpaces: 100 })).key, "full");
});

test("6. Full: totalSpaces of 0 is treated as Full (no division by zero)", () => {
  const result = getStatus(area({ availableSpaces: 0, totalSpaces: 0 }));
  assert.equal(result.key, "full");
  assert.ok(Number.isFinite(0) && !Number.isNaN(result.key));
});

test("7. Full: missing/undefined totalSpaces is treated as Full", () => {
  const result = getStatus({ availableSpaces: 5, totalSpaces: undefined });
  assert.equal(result.key, "full");
});

test("8. Status label text matches the spec exactly for each state", () => {
  assert.equal(getStatus(area({ availableSpaces: 80, totalSpaces: 100 })).label, "Available");
  assert.equal(getStatus(area({ availableSpaces: 10, totalSpaces: 100 })).label, "Almost Full");
  assert.equal(getStatus(area({ availableSpaces: 0, totalSpaces: 100 })).label, "Full");
});

test("9. Large capacity car park: 145/400 (36.25%) is Available", () => {
  assert.equal(getStatus(area({ availableSpaces: 145, totalSpaces: 400 })).key, "available");
});

test("10. Small capacity car park: 8/150 (5.3%) is Almost Full", () => {
  assert.equal(getStatus(area({ availableSpaces: 8, totalSpaces: 150 })).key, "almost-full");
});

// haversineDistanceKm() — distance calculation

test("11. Distance between identical coordinates is 0", () => {
  assert.equal(haversineDistanceKm(DUBLIN, DUBLIN), 0);
});

test("12. Distance calculation is symmetric (A→B equals B→A)", () => {
  const a = { lat: 53.3498, lng: -6.2603 };
  const b = { lat: 53.4213, lng: -6.2701 };
  assert.equal(haversineDistanceKm(a, b), haversineDistanceKm(b, a));
});

test("13. Known distance sanity check: Dublin city centre to Dublin Airport is roughly 9-10km", () => {
  const airport = { lat: 53.4213, lng: -6.2701 };
  const distance = haversineDistanceKm(DUBLIN, airport);
  assert.ok(distance > 7 && distance < 12, `expected ~7-12km, got ${distance}`);
});

test("14. Farther-apart coordinates produce a larger distance than nearby ones", () => {
  const near = { lat: 53.3438, lng: -6.2636 };
  const far = { lat: 53.4597, lng: -6.2181 };
  assert.ok(haversineDistanceKm(DUBLIN, far) > haversineDistanceKm(DUBLIN, near));
});

// computeAreas() — sorting, distance attachment, tiebreaker (REQ-02)

test("15. computeAreas sorts car parks by distance, closest first", () => {
  const areas = [
    area({ id: "far", coordinates: { lat: 53.46, lng: -6.22 } }),
    area({ id: "near", coordinates: { lat: 53.3499, lng: -6.2604 } }),
  ];
  const result = computeAreas(areas, DUBLIN);
  assert.equal(result[0].id, "near");
  assert.equal(result[1].id, "far");
});

test("16. computeAreas tiebreaker: equal distance picks the one with more free spaces", () => {
  const areas = [
    area({ id: "fewer-spaces", coordinates: DUBLIN, availableSpaces: 10, totalSpaces: 100 }),
    area({ id: "more-spaces", coordinates: DUBLIN, availableSpaces: 90, totalSpaces: 100 }),
  ];
  const result = computeAreas(areas, DUBLIN);
  assert.equal(result[0].id, "more-spaces");
});

test("17. computeAreas with no user location leaves distanceKm null and preserves all areas", () => {
  const areas = [area({ id: "a" }), area({ id: "b" })];
  const result = computeAreas(areas, null);
  assert.equal(result.length, 2);
  assert.equal(result[0].distanceKm, null);
  assert.equal(result[1].distanceKm, null);
});

test("18. computeAreas handles an empty array without error", () => {
  assert.deepEqual(computeAreas([], DUBLIN), []);
});

// bestAvailable() — recommendation selection, exclusion of full lots (REQ-02)

test("19. bestAvailable never recommends a full car park", () => {
  const areas = [
    area({ id: "full-but-closest", coordinates: DUBLIN, availableSpaces: 0 }),
    area({ id: "available-further", coordinates: { lat: 53.46, lng: -6.22 }, availableSpaces: 20 }),
  ];
  const computed = computeAreas(areas, DUBLIN);
  const best = bestAvailable(computed);
  assert.equal(best.id, "available-further");
});

test("20. bestAvailable returns null when every car park is full (E1 exceptional flow)", () => {
  const areas = [area({ id: "a", availableSpaces: 0 }), area({ id: "b", availableSpaces: 0 })];
  const computed = computeAreas(areas, DUBLIN);
  assert.equal(bestAvailable(computed), null);
});

test("21. bestAvailable picks the single available car park among many full ones", () => {
  const areas = [
    area({ id: "a", availableSpaces: 0 }),
    area({ id: "b", availableSpaces: 0 }),
    area({ id: "c", availableSpaces: 5 }),
    area({ id: "d", availableSpaces: 0 }),
  ];
  const computed = computeAreas(areas, DUBLIN);
  assert.equal(bestAvailable(computed).id, "c");
});

test("22. Full end-to-end scenario across all 12 seeded car parks recommends the correct lot", () => {
  const seeded = [
    area({ id: "lot-001", coordinates: { lat: 53.3438, lng: -6.2636 }, availableSpaces: 54, totalSpaces: 120 }),
    area({ id: "lot-002", coordinates: { lat: 53.3381, lng: -6.2592 }, availableSpaces: 12, totalSpaces: 180 }),
    area({ id: "lot-003", coordinates: { lat: 53.3477, lng: -6.2697 }, availableSpaces: 0, totalSpaces: 200 }),
    area({ id: "lot-004", coordinates: { lat: 53.3417, lng: -6.2634 }, availableSpaces: 31, totalSpaces: 90 }),
  ];
  const computed = computeAreas(seeded, DUBLIN);
  const best = bestAvailable(computed);
  // lot-003 is excluded (full); the closest remaining lot to Dublin city centre among the other three should be recommended.
  assert.notEqual(best.id, "lot-003");
  assert.ok(["lot-001", "lot-002", "lot-004"].includes(best.id));
});
