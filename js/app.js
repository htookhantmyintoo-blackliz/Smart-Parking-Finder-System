/**
 * app.js — Core Presentation and Authentication State Management
 */

(() => {
  "use strict";

  const ADMIN_CREDENTIALS = { username: "admin", password: "admin123" };

  // App State Variables
  let userLocation = null; 
  let usingFallback = false;
  let isAdminAuthenticated = false;
  let isDriverAuthenticated = false;

  // DOM References
  const grid = document.getElementById("parkingGrid");
  const recommendationPanel = document.getElementById("recommendationPanel");
  const locationStatus = document.getElementById("locationStatus");
  const lotCount = document.getElementById("lotCount");

  const driverNavBtn = document.getElementById("driverNavBtn");
  const adminNavBtn = document.getElementById("adminNavBtn");
  const driverPortal = document.getElementById("driverPortal");
  const adminPortal = document.getElementById("adminPortal");

  // Driver UI Elements
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

  // Admin UI Elements
  const adminLoginView = document.getElementById("adminLoginView");
  const adminControlView = document.getElementById("adminControlView");
  const adminLoginForm = document.getElementById("adminLoginForm");
  const adminAuthFeedback = document.getElementById("adminAuthFeedback");
  const adminForm = document.getElementById("adminForm");
  const adminLotSelect = document.getElementById("adminLotSelect");
  const adminSpacesInput = document.getElementById("adminSpacesInput");
  const adminFeedback = document.getElementById("adminFeedback");
  const adminLogoutBtn = document.getElementById("adminLogoutBtn");

  // Mock database setup for demonstration
  if (!localStorage.getItem("mockDrivers")) {
    const defaultDrivers = [{ name: "John Doe", username: "driver", password: "password123" }];
    localStorage.setItem("mockDrivers", JSON.stringify(defaultDrivers));
  }

  // Distance Calculation (Haversine Formula)
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

  async function resolveUserLocation() {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) { resolve(FALLBACK_LOCATION); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(FALLBACK_LOCATION),
        { enableHighAccuracy: true, timeout: 6000 }
      );
    });
  }

  // Get Capacity Status Labels
  function getStatus(area) {
    if (area.availableSpaces === 0) return { key: "full", label: "Full" };
    if ((area.availableSpaces / area.totalSpaces) <= 0.2) return { key: "almost-full", label: "Almost Full" };
    return { key: "available", label: "Available" };
  }

  function withComputedFields(areas) {
    return areas
      .map((area) => ({
        ...area,
        distanceKm: userLocation ? haversineDistanceKm(userLocation, area.coordinates) : null,
        status: getStatus(area),
      }))
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }

  // Render Parking Dashboard Grid
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

  // Recommendation Filtering Logic
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

  // Driver Authentication Handlers
  function handleDriverLogin(e) {
    e.preventDefault();
    const user = document.getElementById("driverLogUsername").value.trim();
    const pass = document.getElementById("driverLogPassword").value;
    const drivers = JSON.parse(localStorage.getItem("mockDrivers"));

    const found = drivers.find((d) => d.username === user && d.password === pass);
    if (found) {
      isDriverAuthenticated = true;
      driverLoggedOutView.hidden = true;
      driverLoggedInView.hidden = false;
      currentDriverName.textContent = found.name;
      driverNavBtn.textContent = "My Account";
      driverLoginForm.reset();
      driverAuthFeedback.textContent = "";
    } else {
      driverAuthFeedback.style.color = "var(--status-full)";
      driverAuthFeedback.textContent = "Invalid username or password.";
    }
  }

  function handleDriverRegister(e) {
    e.preventDefault();
    const name = document.getElementById("driverRegName").value.trim();
    const user = document.getElementById("driverRegUsername").value.trim();
    const pass = document.getElementById("driverRegPassword").value;
    const drivers = JSON.parse(localStorage.getItem("mockDrivers"));

    if (drivers.some((d) => d.username === user)) {
      driverAuthFeedback.style.color = "var(--status-full)";
      driverAuthFeedback.textContent = "Username is already taken.";
      return;
    }

    drivers.push({ name, username: user, password: pass });
    localStorage.setItem("mockDrivers", JSON.stringify(drivers));
    
    driverAuthFeedback.style.color = "var(--status-available)";
    driverAuthFeedback.textContent = "Account created successfully! Switching to Sign In...";
    driverRegisterForm.reset();

    setTimeout(() => {
      driverLoginSubView.hidden = false;
      driverRegisterSubView.hidden = true;
      driverAuthFeedback.textContent = "";
    }, 1500);
  }

  // Admin Authentication Handlers
  function handleAdminLogin(e) {
    e.preventDefault();
    const user = document.getElementById("adminUsername").value.trim();
    const pass = document.getElementById("adminPassword").value;

    if (user === ADMIN_CREDENTIALS.username && pass === ADMIN_CREDENTIALS.password) {
      isAdminAuthenticated = true;
      adminLoginView.hidden = true;
      adminControlView.hidden = false;
      adminLoginForm.reset();
      adminAuthFeedback.textContent = "";
      populateAdminSelect();
    } else {
      adminAuthFeedback.style.color = "var(--status-full)";
      adminAuthFeedback.textContent = "Invalid admin credentials.";
    }
  }

  function populateAdminSelect() {
    adminLotSelect.innerHTML = parkingAreas.map((a) => `<option value="${a.id}">${a.name}</option>`).join("");
  }

  function handleAdminSubmit(e) {
    e.preventDefault();
    if (!isAdminAuthenticated) return;
    const id = adminLotSelect.value;
    const val = Number(adminSpacesInput.value);
    const area = parkingAreas.find((a) => a.id === id);

    if (area && val >= 0) {
      area.availableSpaces = Math.min(val, area.totalSpaces);
      adminFeedback.style.color = "var(--status-available)";
      adminFeedback.textContent = `Successfully updated spaces for ${area.name}.`;
      renderDashboard();
      if (!recommendationPanel.hidden) findBestParking();
    }
  }

  // Lifecycle Initialization
  async function init() {
    renderDashboard();
    userLocation = await resolveUserLocation();
    locationStatus.textContent = usingFallback 
      ? "Location unavailable. Using central reference point." 
      : "Connected to live location service.";
    renderDashboard();

    document.getElementById("findBestBtn").addEventListener("click", findBestParking);
    document.getElementById("findBestBtnMobile").addEventListener("click", findBestParking);

    // Navigation Controls
    driverNavBtn.addEventListener("click", () => {
      driverPortal.hidden = !driverPortal.hidden;
      adminPortal.hidden = true; 
    });

    adminNavBtn.addEventListener("click", () => {
      adminPortal.hidden = !adminPortal.hidden;
      driverPortal.hidden = true; 
    });

    // Form Navigation
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

    // Form Event Listeners
    driverLoginForm.addEventListener("submit", handleDriverLogin);
    driverRegisterForm.addEventListener("submit", handleDriverRegister);
    adminLoginForm.addEventListener("submit", handleAdminLogin);
    adminForm.addEventListener("submit", handleAdminSubmit);

    // Logout Event Listeners
    driverLogoutBtn.addEventListener("click", () => {
      isDriverAuthenticated = false;
      driverLoggedInView.hidden = true;
      driverLoggedOutView.hidden = false;
      driverLoginSubView.hidden = false;
      driverRegisterSubView.hidden = true;
      driverNavBtn.textContent = "Driver Portal";
    });

    adminLogoutBtn.addEventListener("click", () => {
      isAdminAuthenticated = false;
      adminControlView.hidden = true;
      adminLoginView.hidden = false;
      adminFeedback.textContent = "";
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();