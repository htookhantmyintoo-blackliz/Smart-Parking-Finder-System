/**
 * app.js
 * Smart Parking Finder System
 *
 * All application logic and rendering in one file:
 *   REQ-01  View Real-Time Parking Availability
 *   REQ-02  Smart Parking Recommendation ("Find Best Parking")
 *   REQ-03  Colour-Coded Visual Status Indicators
 *   REQ-04  Geolocation-Based Distance Calculation
 *   REQ-05  Administrative Data Simulation
 *
 * Behaviour is aligned with the Requirements Specification (Section 3.1
 * Use Case Specifications), including exact thresholds, the REQ-02
 * tie-breaker rule, REQ-05 reject-on-invalid-input behaviour, the 5-second
 * geolocation timeout, and the spec's exact UI message strings.
 */

(() => {
  "use strict";

  // ---------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------

  // Fallback reference point used when the user does not grant (or the
  // browser does not support) geolocation — central Dublin.
  const FALLBACK_LOCATION = { lat: 53.3498, lng: -6.2603 };

  // Occupancy ratio at/below which a non-empty area counts as "Almost Full".
  // Per Requirements Specification Table 0 (Definitions):
  //   Available   > 30% of total spaces unoccupied
  //   Almost Full  1%–30% of total spaces unoccupied
  //   Full         exactly 0% (0 spaces) unoccupied
  const ALMOST_FULL_THRESHOLD = 0.3;

  // Distances within this tolerance (km) are treated as "tied" for the
  // REQ-02 Alternate Flow A1 tie-breaker rule below.
  const DISTANCE_TIE_EPSILON = 0.0001;

  // ---------------------------------------------------------------
  // State
  // ---------------------------------------------------------------
  let userLocation = null; // { lat, lng } once resolved
  let usingFallback = false;

  // ---------------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------------
  const grid = document.getElementById("parkingGrid");
  const recommendationPanel = document.getElementById("recommendationPanel");
  const locationStatus = document.getElementById("locationStatus");
  const lotCount = document.getElementById("lotCount");

  const adminToggle = document.getElementById("adminToggle");
  const adminPanel = document.getElementById("adminPanel");
  const adminForm = document.getElementById("adminForm");
  const adminLotSelect = document.getElementById("adminLotSelect");
  const adminSpacesInput = document.getElementById("adminSpacesInput");
  const adminFeedback = document.getElementById("adminFeedback");

  // Small helper to keep template strings free of raw user-entered text.
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  // =================================================================
  // LOGIC — distance, status, recommendation (pure calculations)
  // =================================================================

  /**
   * REQ-04 — Great-circle distance between two lat/lng points, in km.
   * Standard Haversine formula.
   */
  function haversineDistanceKm(a, b) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371; // Earth radius in km

    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return R * c;
  }

  /**
   * REQ-03 — Classify a parking area's occupancy into a status.
   * Guards against totalSpaces === 0 (Requirements Specification REQ-03
   * Exceptional Flow E1: Division-by-Zero Protection — forces "Full"
   * rather than crashing or misclassifying).
   */
  function getStatus(area) {
    if (area.availableSpaces <= 0) {
      return { key: "full", label: "Full" };
    }
    if (!area.totalSpaces || area.totalSpaces <= 0) {
      return { key: "full", label: "Full" };
    }
    const ratio = area.availableSpaces / area.totalSpaces;
    if (ratio <= ALMOST_FULL_THRESHOLD) {
      return { key: "almost-full", label: "Almost Full" };
    }
    return { key: "available", label: "Available" };
  }

  /**
   * Attach live distance + status to every area and sort by distance
   * (nearest first). If no user location is available yet, distance is
   * null and original array order is preserved for those items.
   */
  function withComputedFields(areas, location) {
    return areas
      .map((area) => ({
        ...area,
        distanceKm: location ? haversineDistanceKm(location, area.coordinates) : null,
        status: getStatus(area),
      }))
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }

  /**
   * REQ-02 — Pick the best parking recommendation: nearest area that is
   * not full. Returns null if every area is full or the list is empty.
   *
   * Implements Requirements Specification REQ-02 Alternate Flow A1
   * (Tied Minimum Distance): if two or more available areas share the
   * same closest distance, the tiebreaker selects the one with the
   * higher availableSpaces count rather than an arbitrary sort order.
   */
  function findBestCandidate(computedAreas) {
    const candidates = computedAreas.filter((a) => a.availableSpaces > 0);
    if (candidates.length === 0) {
      return null;
    }

    const minDistance = Math.min(...candidates.map((a) => a.distanceKm ?? Infinity));
    const nearest = candidates.filter(
      (a) => Math.abs((a.distanceKm ?? Infinity) - minDistance) <= DISTANCE_TIE_EPSILON
    );

    if (nearest.length === 1) {
      return nearest[0];
    }

    // Tiebreaker: highest availableSpaces among the tied-nearest areas.
    return nearest.reduce(
      (best, a) => (a.availableSpaces > best.availableSpaces ? a : best),
      nearest[0]
    );
  }

  // =================================================================
  // GEOLOCATION — REQ-04 plumbing
  // =================================================================
  function resolveUserLocation() {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) {
        usingFallback = true;
        resolve(FALLBACK_LOCATION);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          usingFallback = false;
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          // Permission denied, timeout, or position unavailable.
          usingFallback = true;
          resolve(FALLBACK_LOCATION);
        },
        { enableHighAccuracy: true, timeout: 5000 } // REQ-04 E1: 5-second window
      );
    });
  }

  // =================================================================
  // RENDERING — REQ-01
  // =================================================================
  function renderCard(area) {
    const card = document.createElement("article");
    card.className = "parking-card";
    card.dataset.status = area.status.key;

    const fillPercent = area.totalSpaces
      ? Math.max(0, Math.min(100, Math.round((area.availableSpaces / area.totalSpaces) * 100)))
      : 0;

    card.innerHTML = `
      <header class="parking-card__header">
        <h3 class="parking-card__name">${escapeHtml(area.name)}</h3>
        <span class="badge badge--${area.status.key}">${area.status.label}</span>
      </header>
      <dl class="parking-card__stats">
        <div>
          <dt>Available</dt>
          <dd class="mono">${area.availableSpaces}<span class="muted"> / ${area.totalSpaces}</span></dd>
        </div>
        <div>
          <dt>Distance</dt>
          <dd class="mono">${area.distanceKm !== null ? area.distanceKm.toFixed(2) + " km" : "—"}</dd>
        </div>
      </dl>
      <div class="parking-card__bar" role="img" aria-label="${fillPercent}% of spaces available">
        <span style="width:${fillPercent}%"></span>
      </div>
    `;
    return card;
  }

  function renderDashboard() {
    if (!Array.isArray(parkingAreas) || parkingAreas.length === 0) {
      // REQ-01 Exceptional Flow E1: Null / Void Dataset.
      grid.innerHTML = `<p class="parking-grid__empty">No parking areas found.</p>`;
      lotCount.textContent = "";
      return [];
    }

    const computed = withComputedFields(parkingAreas, userLocation);
    grid.innerHTML = "";
    computed.forEach((area) => grid.appendChild(renderCard(area)));

    const available = computed.filter((a) => a.status.key !== "full").length;
    lotCount.textContent = `${available} of ${computed.length} areas have space`;

    return computed;
  }

  // =================================================================
  // RECOMMENDATION — REQ-02
  // =================================================================
  function findBestParking() {
    const computed = withComputedFields(parkingAreas, userLocation);
    const best = findBestCandidate(computed);

    recommendationPanel.hidden = false;

    if (!best) {
      // REQ-02 Exceptional Flow E1: Absolute Capacity Reached.
      recommendationPanel.innerHTML = `
        <div class="recommendation__empty">
          No available parking found. Please try again later.
        </div>
      `;
      recommendationPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    recommendationPanel.innerHTML = `
      <span class="recommendation__star" aria-hidden="true">&#9733;</span>
      <div class="recommendation__body">
        <p class="recommendation__eyebrow">Best match</p>
        <h2 class="recommendation__name">${escapeHtml(best.name)}</h2>
        <div class="recommendation__stats">
          <span class="mono">${best.distanceKm !== null ? best.distanceKm.toFixed(2) + " km away" : "Distance unavailable"}</span>
          <span class="badge badge--${best.status.key}">${best.status.label}</span>
          <span class="mono">${best.availableSpaces} / ${best.totalSpaces} free</span>
        </div>
      </div>
    `;
    recommendationPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // =================================================================
  // ADMIN PANEL — REQ-05
  // =================================================================
  function populateAdminSelect() {
    adminLotSelect.innerHTML = parkingAreas
      .map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`)
      .join("");
    syncAdminSpacesMax();
  }

  // Keeps the number input's max in step with the selected lot's capacity.
  // This is a UX aid only — the authoritative check is the reject logic
  // in handleAdminSubmit below (REQ-05 Exceptional Flow E1).
  function syncAdminSpacesMax() {
    const area = parkingAreas.find((a) => a.id === adminLotSelect.value);
    if (area) {
      adminSpacesInput.max = String(area.totalSpaces);
    }
  }

  function handleAdminSubmit(event) {
    event.preventDefault();
    const id = adminLotSelect.value;
    const rawValue = adminSpacesInput.value;
    const value = Number(rawValue);
    const area = parkingAreas.find((a) => a.id === id);

    // REQ-05 Exceptional Flow E1: Out-of-Bounds Validation Failure.
    // Reject (do not clamp) if: the field is empty/non-numeric, the value
    // is negative, not a whole number, or exceeds the area's totalSpaces.
    // Application state remains unchanged on rejection.
    const isValid =
      !!area &&
      rawValue !== "" &&
      Number.isFinite(value) &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= area.totalSpaces;

    if (!isValid) {
      adminFeedback.textContent = "Invalid entry count value.";
      adminFeedback.dataset.tone = "error";
      return; // state unchanged
    }

    area.availableSpaces = value;
    adminFeedback.textContent = `${area.name} updated to ${area.availableSpaces} available spaces.`;
    adminFeedback.dataset.tone = "success";
    adminForm.reset();

    renderDashboard();
    // Keep the recommendation panel in sync if it is currently shown.
    if (!recommendationPanel.hidden) {
      findBestParking();
    }
  }

  function toggleAdminPanel() {
    const isOpen = !adminPanel.hidden;
    adminPanel.hidden = isOpen;
    adminToggle.setAttribute("aria-expanded", String(!isOpen));
    if (!adminPanel.hidden) {
      adminLotSelect.focus();
    }
  }

  // =================================================================
  // Init
  // =================================================================
  async function init() {
    populateAdminSelect();
    renderDashboard(); // render immediately with no distance, then re-render once located

    locationStatus.textContent = "Locating you…";
    try {
      userLocation = await resolveUserLocation();
    } catch {
      userLocation = FALLBACK_LOCATION;
      usingFallback = true;
    }
    // REQ-04 Alternate Flow A1: Permission Rejected.
    locationStatus.textContent = usingFallback
      ? "Using simulated distances."
      : "Using your current location";
    renderDashboard();

    document.getElementById("findBestBtn").addEventListener("click", findBestParking);
    document.getElementById("findBestBtnMobile").addEventListener("click", findBestParking);

    adminToggle.addEventListener("click", toggleAdminPanel);
    adminLotSelect.addEventListener("change", syncAdminSpacesMax);
    adminForm.addEventListener("submit", handleAdminSubmit);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
