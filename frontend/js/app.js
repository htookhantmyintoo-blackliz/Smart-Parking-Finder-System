(() => {
  "use strict";

  // State
  let parkingAreas = [];
  let userLocation = null;
  let usingFallback = false;

  // Saved tokens
  let driverToken = localStorage.getItem("driverToken") || null;
  let driverName = localStorage.getItem("driverName") || null;
  let adminToken = localStorage.getItem("adminToken") || null;

  // DOM elements - Main
  const grid = document.getElementById("parkingGrid");
  const recommendationPanel = document.getElementById("recommendationPanel");
  const locationStatus = document.getElementById("locationStatus");
  const lotCount = document.getElementById("lotCount");

  const driverNavBtn = document.getElementById("driverNavBtn");
  const adminNavBtn = document.getElementById("adminNavBtn");
  const driverPortal = document.getElementById("driverPortal");
  const adminPortal = document.getElementById("adminPortal");

  // DOM elements - Driver
  const driverLoggedOutView = document.getElementById("driverLoggedOutView");
  const driverLoggedInView = document.getElementById("driverLoggedInView");
  const driverLoginSubView = document.getElementById("driverLoginSubView");
  const driverRegisterSubView = document.getElementById("driverRegisterSubView");
  const driverLoginForm = document.getElementById("driverLoginForm");
  const driverRegisterForm = document.getElementById("driverRegisterForm");
  const driverAuthFeedback = document.getElementById("driverAuthFeedback");
  const currentDriverName = document.getElementById("currentDriverName");
  const driverLogoutBtn = document.getElementById("driverLogoutBtn");

  const toRegisterViewBtn = document.getElementById("toRegisterViewBtn");
  const toLoginViewBtn = document.getElementById("toLoginViewBtn");

  // DOM elements - Admin
  const adminLoginView = document.getElementById("adminLoginView");
  const adminControlView = document.getElementById("adminControlView");
  const adminLoginForm = document.getElementById("adminLoginForm");
  const adminAuthFeedback = document.getElementById("adminAuthFeedback");
  const adminForm = document.getElementById("adminForm");
  const adminLotSelect = document.getElementById("adminLotSelect");
  const adminSpacesInput = document.getElementById("adminSpacesInput");
  const adminFeedback = document.getElementById("adminFeedback");
  const adminLogoutBtn = document.getElementById("adminLogoutBtn");

  // API helper
  async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  // Calculate distance
  function haversineDistanceKm(a, b) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  // Get user location
  async function resolveUserLocation() {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) { usingFallback = true; resolve(FALLBACK_LOCATION); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { usingFallback = true; resolve(FALLBACK_LOCATION); },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    });
  }

  // Get status key and label
  function getStatus(area) {
    if (area.availableSpaces === 0) return { key: "full", label: "Full" };
    if (area.availableSpaces / area.totalSpaces <= 0.2) return { key: "almost-full", label: "Almost Full" };
    return { key: "available", label: "Available" };
  }

  // Add distance and status to areas
  function withComputedFields(areas) {
    return areas
      .map((area) => ({
        ...area,
        distanceKm: userLocation ? haversineDistanceKm(userLocation, area.coordinates) : null,
        status: getStatus(area),
      }))
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }

  // Fetch parking areas
  async function loadParkingAreas() {
    try {
      parkingAreas = await apiFetch("/parking-areas");
    } catch (err) {
      console.error("Failed to load parking areas:", err);
      lotCount.textContent = "Could not reach the server. Is the backend running?";
    }
  }

  // Render dashboard grid
  function renderDashboard() {
    const computed = withComputedFields(parkingAreas);
    grid.innerHTML = "";

    computed.forEach((area) => {
      const card = document.createElement("article");
      card.className = "parking-card";
      card.dataset.status = area.status.key;
      card.innerHTML = `
        <header class="parking-card__header">
          <h3 class="parking-card__name">${area.name}</h3>
          <span class="badge badge--${area.status.key}">${area.status.label}</span>
        </header>
        <dl class="parking-card__stats">
          <div><dt>Available</dt><dd class="mono">${area.availableSpaces}<span class="muted"> / ${area.totalSpaces}</span></dd></div>
          <div><dt>Distance</dt><dd class="mono">${area.distanceKm !== null ? area.distanceKm.toFixed(2) + " km" : "—"}</dd></div>
        </dl>
        <div class="parking-card__bar" aria-hidden="true">
          <span style="width:${Math.round((area.availableSpaces / area.totalSpaces) * 100)}%"></span>
        </div>`;
      grid.appendChild(card);
    });
    const available = computed.filter((a) => a.status.key !== "full").length;
    lotCount.textContent = `${available} of ${computed.length} areas have space available`;
  }

  // Find best parking spot
  function findBestParking() {
    const computed = withComputedFields(parkingAreas);
    const candidates = computed.filter((a) => a.availableSpaces > 0);

    if (candidates.length === 0) {
      recommendationPanel.hidden = false;
      recommendationPanel.innerHTML = `<div class="recommendation__empty">No parking spaces currently available.</div>`;
      return;
    }
    const best = candidates[0];
    recommendationPanel.hidden = false;
    recommendationPanel.innerHTML = `
      <span class="recommendation__star" aria-hidden="true">&#9733;</span>
      <div class="recommendation__body">
        <p class="recommendation__eyebrow">Best Match</p>
        <h2 class="recommendation__name">${best.name}</h2>
        <div class="recommendation__stats">
          <span class="mono">${best.distanceKm.toFixed(2)} km away</span>
          <span class="badge badge--${best.status.key}">${best.status.label}</span>
          <span class="mono">${best.availableSpaces} / ${best.totalSpaces} free</span>
        </div>
      </div>`;
    recommendationPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Update driver UI when logged in
  function showDriverLoggedIn(name) {
    driverLoggedOutView.hidden = true;
    driverLoggedInView.hidden = false;
    currentDriverName.textContent = name;
    driverNavBtn.textContent = "My Account";
  }

  // Handle driver login
  async function handleDriverLogin(e) {
    e.preventDefault();
    const username = document.getElementById("driverLogUsername").value.trim();
    const password = document.getElementById("driverLogPassword").value;

    try {
      const data = await apiFetch("/auth/driver/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      driverToken = data.token;
      driverName = data.name;
      localStorage.setItem("driverToken", driverToken);
      localStorage.setItem("driverName", driverName);

      showDriverLoggedIn(driverName);
      driverLoginForm.reset();
      driverAuthFeedback.textContent = "";
    } catch (err) {
      driverAuthFeedback.style.color = "var(--status-full)";
      driverAuthFeedback.textContent = err.message;
    }
  }

  // Handle driver registration
  async function handleDriverRegister(e) {
    e.preventDefault();
    const name = document.getElementById("driverRegName").value.trim();
    const username = document.getElementById("driverRegUsername").value.trim();
    const password = document.getElementById("driverRegPassword").value;

    try {
      await apiFetch("/auth/driver/register", {
        method: "POST",
        body: JSON.stringify({ name, username, password }),
      });

      driverAuthFeedback.style.color = "var(--status-available)";
      driverAuthFeedback.textContent = "Account created successfully! Switching to Sign In...";
      driverRegisterForm.reset();

      setTimeout(() => {
        driverLoginSubView.hidden = false;
        driverRegisterSubView.hidden = true;
        driverAuthFeedback.textContent = "";
      }, 1500);
    } catch (err) {
      driverAuthFeedback.style.color = "var(--status-full)";
      driverAuthFeedback.textContent = err.message;
    }
  }

  // Handle admin login
  async function handleAdminLogin(e) {
    e.preventDefault();
    const username = document.getElementById("adminUsername").value.trim();
    const password = document.getElementById("adminPassword").value;

    try {
      const data = await apiFetch("/auth/admin/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      adminToken = data.token;
      localStorage.setItem("adminToken", adminToken);

      adminLoginView.hidden = true;
      adminControlView.hidden = false;
      adminLoginForm.reset();
      adminAuthFeedback.textContent = "";
      populateAdminSelect();
    } catch (err) {
      adminAuthFeedback.style.color = "var(--status-full)";
      adminAuthFeedback.textContent = err.message;
    }
  }

  // Populate admin dropdown
  function populateAdminSelect() {
    adminLotSelect.innerHTML = parkingAreas.map((a) => `<option value="${a.id}">${a.name}</option>`).join("");
  }

  // Handle admin update spaces
  async function handleAdminSubmit(e) {
    e.preventDefault();
    const id = adminLotSelect.value;
    const availableSpaces = Number(adminSpacesInput.value);

    try {
      const updated = await apiFetch(`/parking-areas/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ availableSpaces }),
      });

      const idx = parkingAreas.findIndex((a) => a.id === updated.id);
      if (idx !== -1) parkingAreas[idx] = updated;

      adminFeedback.style.color = "var(--status-available)";
      adminFeedback.textContent = `Successfully updated spaces for ${updated.name}.`;
      renderDashboard();
      if (!recommendationPanel.hidden) findBestParking();
    } catch (err) {
      adminFeedback.style.color = "var(--status-full)";
      adminFeedback.textContent = err.message;
      if (err.message === "Invalid or expired token." || err.message === "Missing authentication token.") {
        adminToken = null;
        localStorage.removeItem("adminToken");
        adminControlView.hidden = true;
        adminLoginView.hidden = false;
      }
    }
  }

  // App initialization
  async function init() {
    await loadParkingAreas();
    renderDashboard();

    userLocation = await resolveUserLocation();
    locationStatus.textContent = usingFallback
      ? "Location unavailable. Using central reference point."
      : "Connected to live location service.";
    renderDashboard();

    // Restore session
    if (driverToken && driverName) showDriverLoggedIn(driverName);
    if (adminToken) {
      adminLoginView.hidden = true;
      adminControlView.hidden = false;
      populateAdminSelect();
    }

    // Event listeners
    document.getElementById("findBestBtn").addEventListener("click", findBestParking);
    document.getElementById("findBestBtnMobile").addEventListener("click", findBestParking);

    // Navigation events
    driverNavBtn.addEventListener("click", () => {
      driverPortal.hidden = !driverPortal.hidden;
      adminPortal.hidden = true;
    });

    adminNavBtn.addEventListener("click", () => {
      adminPortal.hidden = !adminPortal.hidden;
      driverPortal.hidden = true;
    });

    // Subview toggle events
    toRegisterViewBtn.addEventListener("click", () => {
      driverLoginSubView.hidden = true;
      driverRegisterSubView.hidden = false;
      driverAuthFeedback.textContent = "";
    });

    toLoginViewBtn.addEventListener("click", () => {
      driverLoginSubView.hidden = false;
      driverRegisterSubView.hidden = true;
      driverAuthFeedback.textContent = "";
    });

    // Form Event
    driverLoginForm.addEventListener("submit", handleDriverLogin);
    driverRegisterForm.addEventListener("submit", handleDriverRegister);
    adminLoginForm.addEventListener("submit", handleAdminLogin);
    adminForm.addEventListener("submit", handleAdminSubmit);

    // Logout Event 
    driverLogoutBtn.addEventListener("click", () => {
      driverToken = null;
      driverName = null;
      localStorage.removeItem("driverToken");
      localStorage.removeItem("driverName");
      driverLoggedInView.hidden = true;
      driverLoggedOutView.hidden = false;
      driverLoginSubView.hidden = false;
      driverRegisterSubView.hidden = true;
      driverNavBtn.textContent = "Driver Portal";
    });

    adminLogoutBtn.addEventListener("click", () => {
      adminToken = null;
      localStorage.removeItem("adminToken");
      adminControlView.hidden = true;
      adminLoginView.hidden = false;
      adminFeedback.textContent = "";
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
