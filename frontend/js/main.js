(() => {
  "use strict";

  const API_BASE = "https://smart-parking-finder-system-tlzt.onrender.com/api";

  let parkingAreas = [];
  let userLocation = null;
  let usingFallback = false;
  let lastTotalAvailable = null;

  let driverToken = localStorage.getItem("driverToken") || null;
  let driverName = localStorage.getItem("driverName") || null;

  const grid = document.getElementById("parkingGrid");
  const searchInput = document.getElementById("searchInput");
  const noResults = document.getElementById("noResults");
  const noResultsQuery = document.getElementById("noResultsQuery");
  let searchQuery = "";
  const recommendationPanel = document.getElementById("recommendationPanel");
  const locationStatus = document.getElementById("locationStatus");
  const lotCount = document.getElementById("lotCount");
  const totalFlap = document.getElementById("totalFlap");

  const driverNavBtn = document.getElementById("driverNavBtn");
  const driverPortal = document.getElementById("driverPortal");
  const drawerOverlay = document.getElementById("drawerOverlay");
  const driverDrawerClose = document.getElementById("driverDrawerClose");

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

  async function apiFetch(path, options = {}) {
    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      });
    } catch (networkErr) {
      throw new Error(
        "Can't reach the server. Make sure the backend is live and active on Render."
      );
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

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
      if (!("geolocation" in navigator)) { usingFallback = true; resolve(FALLBACK_LOCATION); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { usingFallback = true; resolve(FALLBACK_LOCATION); },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    });
  }

  // Per the spec: Available > 30% free, Almost Full between >0% and <=30%,
  // Full === 0. A missing/zero totalSpaces is treated as Full so the ratio
  // calculation never divides by zero.
  function getStatus(area) {
    if (!area.totalSpaces || area.availableSpaces === 0) return { key: "full", label: "Full" };
    if (area.availableSpaces / area.totalSpaces <= 0.3) return { key: "almost-full", label: "Almost Full" };
    return { key: "available", label: "Available" };
  }

  function withComputedFields(areas) {
    return areas
      .map((area) => ({
        ...area,
        distanceKm: userLocation ? haversineDistanceKm(userLocation, area.coordinates) : null,
        status: getStatus(area),
      }))
      .sort((a, b) => {
        const distA = a.distanceKm ?? Infinity;
        const distB = b.distanceKm ?? Infinity;
        if (distA !== distB) return distA - distB;
        // Tiebreaker: if two car parks are equally close, prefer the one
        // with more free spaces.
        return b.availableSpaces - a.availableSpaces;
      });
  }

  async function loadParkingAreas() {
    try {
      parkingAreas = await apiFetch("/parking-areas");
    } catch (err) {
      console.error("Failed to load parking areas:", err);
      lotCount.textContent = "Could not reach the server. Is the backend running?";
    }
  }

  // Renders the total-available count as individual "split-flap" digits
  function renderFlap(total) {
    const digits = String(total).padStart(3, "0").split("");
    const isFirstRender = lastTotalAvailable === null;
    const changed = total !== lastTotalAvailable;

    totalFlap.innerHTML = digits
      .map((d) => `<div class="flap${changed && !isFirstRender ? " is-updating" : ""}"><span>${d}</span></div>`)
      .join("");
    lastTotalAvailable = total;
  }

  function renderDashboard() {
    if (parkingAreas.length === 0) {
      grid.innerHTML = `<p class="no-results">No parking areas found.</p>`;
      lotCount.textContent = "";
      renderFlap(0);
      return;
    }

    const computed = withComputedFields(parkingAreas);
    const query = searchQuery.trim().toLowerCase();
    const visible = query ? computed.filter((a) => a.name.toLowerCase().includes(query)) : computed;

    grid.innerHTML = "";

    visible.forEach((area) => {
      const card = document.createElement("article");
      card.className = "plate";
      card.dataset.status = area.status.key;
      card.innerHTML = `
        <header class="plate__head">
          <h3 class="plate__name">${area.name}</h3>
          <span class="tag tag--${area.status.key}">${area.status.label}</span>
        </header>
        <div class="plate__row">
          <span class="plate__count mono">${area.availableSpaces}<span> / ${area.totalSpaces}</span></span>
          <span class="plate__distance mono">${area.distanceKm !== null ? area.distanceKm.toFixed(2) + " km" : "—"}</span>
        </div>
        <div class="plate__bar" aria-hidden="true">
          <span style="width:${Math.round((area.availableSpaces / area.totalSpaces) * 100)}%"></span>
        </div>`;
      grid.appendChild(card);
    });

    noResults.hidden = visible.length > 0 || !query;
    if (query) noResultsQuery.textContent = searchQuery.trim();

    const totalAvailable = computed.reduce((sum, a) => sum + a.availableSpaces, 0);
    if (query) {
      const openMatches = visible.filter((a) => a.status.key !== "full").length;
      lotCount.textContent = `${openMatches} of ${visible.length} matching car parks have space`;
    } else {
      const openLots = computed.filter((a) => a.status.key !== "full").length;
      lotCount.textContent = `${openLots} of ${computed.length} car parks have space`;
    }
    renderFlap(totalAvailable);
  }

  // Shown briefly while the first request to the server is in flight
  function renderLoadingSkeleton() {
    grid.innerHTML = Array.from({ length: 6 })
      .map(
        () => `
        <article class="plate is-skeleton">
          <header class="plate__head">
            <div class="skeleton-block" style="width:60%;height:18px;"></div>
          </header>
          <div class="plate__row">
            <div class="skeleton-block" style="width:40%;height:26px;"></div>
          </div>
          <div class="plate__bar" aria-hidden="true"></div>
        </article>`
      )
      .join("");
    lotCount.textContent = "Loading car parks…";
  }

  function findBestParking() {
    const computed = withComputedFields(parkingAreas);
    const candidates = computed.filter((a) => a.availableSpaces > 0);

    if (candidates.length === 0) {
      recommendationPanel.hidden = false;
      recommendationPanel.innerHTML = `<p class="recommendation__empty">No available parking found. Please try again later.</p>`;
      return;
    }
    const best = candidates[0];
    recommendationPanel.hidden = false;
    recommendationPanel.innerHTML = `
      <span class="recommendation__mark" aria-hidden="true">P</span>
      <div>
        <p class="recommendation__eyebrow">Best match</p>
        <h2 class="recommendation__name">${best.name}</h2>
        <div class="recommendation__stats">
          <span class="mono">${best.distanceKm.toFixed(2)} km away</span>
          <span class="tag tag--${best.status.key}">${best.status.label}</span>
          <span class="mono">${best.availableSpaces} / ${best.totalSpaces} free</span>
        </div>
      </div>`;
    recommendationPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // --- Driver drawer open/close ---
  function openDrawer() {
    driverPortal.hidden = false;
    drawerOverlay.hidden = false;
  }
  function closeDrawer() {
    driverPortal.hidden = true;
    drawerOverlay.hidden = true;
  }

  function showDriverLoggedIn(name) {
    driverLoggedOutView.hidden = true;
    driverLoggedInView.hidden = false;
    currentDriverName.textContent = name;
    driverNavBtn.textContent = `Hi, ${name.split(" ")[0]}`;
  }

  function showDriverLoggedOut() {
    driverLoggedInView.hidden = true;
    driverLoggedOutView.hidden = false;
    driverLoginSubView.hidden = false;
    driverRegisterSubView.hidden = true;
    driverNavBtn.textContent = "Driver Sign In";
  }

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
      setTimeout(closeDrawer, 500);
    } catch (err) {
      driverAuthFeedback.dataset.tone = "error";
      driverAuthFeedback.textContent = err.message;
    }
  }

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

      driverAuthFeedback.dataset.tone = "success";
      driverAuthFeedback.textContent = "Account created. Switching to sign in…";
      driverRegisterForm.reset();

      setTimeout(() => {
        driverLoginSubView.hidden = false;
        driverRegisterSubView.hidden = true;
        driverAuthFeedback.textContent = "";
      }, 1400);
    } catch (err) {
      driverAuthFeedback.dataset.tone = "error";
      driverAuthFeedback.textContent = err.message;
    }
  }

  async function init() {
    renderLoadingSkeleton();
    await loadParkingAreas();
    renderDashboard();

    userLocation = await resolveUserLocation();
    locationStatus.textContent = usingFallback
      ? "Using central reference point (location unavailable)"
      : "Connected to live location";
    renderDashboard();

    if (driverToken && driverName) showDriverLoggedIn(driverName);

    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderDashboard();
    });

    document.getElementById("findBestBtn").addEventListener("click", findBestParking);
    document.getElementById("findBestBtnMobile").addEventListener("click", findBestParking);

    driverNavBtn.addEventListener("click", openDrawer);
    driverDrawerClose.addEventListener("click", closeDrawer);
    drawerOverlay.addEventListener("click", closeDrawer);

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

    driverLoginForm.addEventListener("submit", handleDriverLogin);
    driverRegisterForm.addEventListener("submit", handleDriverRegister);

    driverLogoutBtn.addEventListener("click", () => {
      driverToken = null;
      driverName = null;
      localStorage.removeItem("driverToken");
      localStorage.removeItem("driverName");
      showDriverLoggedOut();
    });

    // Keep the dashboard close to real-time without needing a refresh
    setInterval(async () => {
      await loadParkingAreas();
      renderDashboard();
    }, POLL_INTERVAL_MS);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
