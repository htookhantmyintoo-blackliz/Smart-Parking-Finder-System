(() => {
  "use strict";

  const API_BASE = "https://smart-parking-finder-system-tlzt.onrender.com/api";
  const FALLBACK_LOCATION = { lat: 53.349805, lng: -6.26031 }; // Dublin City Centre
  const POLL_INTERVAL_MS = 15000; 

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
    if (!a || !b) return null;
    const lat1Val = Number(a.lat);
    const lng1Val = Number(a.lng);
    const lat2Val = Number(a.lat ?? b.lat);
    const lng2Val = Number(a.lng ?? b.lng);

    if (isNaN(lat1Val) || isNaN(lng1Val) || isNaN(lat2Val) || isNaN(lng2Val)) {
      return null;
    }

    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(Number(b.lat) - lat1Val);
    const dLng = toRad(Number(b.lng) - lng1Val);
    const rLat1 = toRad(lat1Val);
    const rLat2 = toRad(Number(b.lat));
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  async function resolveUserLocation() {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) { 
        usingFallback = true; 
        resolve(FALLBACK_LOCATION); 
        return; 
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          usingFallback = false;
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => { 
          usingFallback = true; 
          resolve(FALLBACK_LOCATION); 
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    });
  }

  function getStatus(area) {
    if (!area.totalSpaces || area.availableSpaces === 0) return { key: "full", label: "Full" };
    if (area.availableSpaces / area.totalSpaces <= 0.3) return { key: "almost-full", label: "Almost Full" };
    return { key: "available", label: "Available" };
  }

  function withComputedFields(areas) {
    const activeLocation = userLocation || FALLBACK_LOCATION;

    return areas
      .map((area) => ({
        ...area,
        distanceKm: area.coordinates ? haversineDistanceKm(activeLocation, area.coordinates) : null,
        status: getStatus(area),
      }))
      .sort((a, b) => {
        const distA = a.distanceKm ?? Infinity;
        const distB = b.distanceKm ?? Infinity;
        if (distA !== distB) return distA - distB;
        return b.availableSpaces - a.availableSpaces;
      });
  }

  async function loadParkingAreas() {
    try {
      const rawAreas = await apiFetch("/parking-areas");
      parkingAreas = rawAreas.map((a) => {
        const lat = Number(a.lat ?? a.latitude);
        const lng = Number(a.lng ?? a.longitude);
        return {
          ...a,
          totalSpaces: Number(a.totalSpaces ?? a.total_spaces ?? 0),
          availableSpaces: Number(a.availableSpaces ?? a.available_spaces ?? 0),
          coordinates: (!isNaN(lat) && !isNaN(lng)) ? { lat, lng } : null
        };
      });
    } catch (err) {
      console.error("Failed to load parking areas:", err);
      if (lotCount) lotCount.textContent = "Could not reach the server. Is the backend running?";
    }
  }

  function renderFlap(total) {
    if (!totalFlap) return;
    const digits = String(total).padStart(3, "0").split("");
    const isFirstRender = lastTotalAvailable === null;
    const changed = total !== lastTotalAvailable;

    totalFlap.innerHTML = digits
      .map((d) => `<div class="flap${changed && !isFirstRender ? " is-updating" : ""}"><span>${d}</span></div>`)
      .join("");
    lastTotalAvailable = total;
  }

  function renderDashboard() {
    if (!grid) return;
    if (parkingAreas.length === 0) {
      grid.innerHTML = `<p class="no-results">No parking areas found.</p>`;
      if (lotCount) lotCount.textContent = "";
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

    if (noResults) noResults.hidden = visible.length > 0 || !query;
    if (query && noResultsQuery) noResultsQuery.textContent = searchQuery.trim();

    const totalAvailable = computed.reduce((sum, a) => sum + a.availableSpaces, 0);
    if (lotCount) {
      if (query) {
        const openMatches = visible.filter((a) => a.status.key !== "full").length;
        lotCount.textContent = `${openMatches} of ${visible.length} matching car parks have space`;
      } else {
        const openLots = computed.filter((a) => a.status.key !== "full").length;
        lotCount.textContent = `${openLots} of ${computed.length} car parks have space`;
      }
    }
    renderFlap(totalAvailable);
  }

  function renderLoadingSkeleton() {
    if (!grid) return;
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
    if (lotCount) lotCount.textContent = "Loading car parks…";
  }

  function findBestParking() {
    const computed = withComputedFields(parkingAreas);
    const candidates = computed.filter((a) => a.availableSpaces > 0);

    if (!recommendationPanel) return;

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
          <span class="mono">${best.distanceKm !== null ? best.distanceKm.toFixed(2) + " km away" : ""}</span>
          <span class="tag tag--${best.status.key}">${best.status.label}</span>
          <span class="mono">${best.availableSpaces} / ${best.totalSpaces} free</span>
        </div>
      </div>`;
    recommendationPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openDrawer() {
    if (driverPortal) driverPortal.hidden = false;
    if (drawerOverlay) drawerOverlay.hidden = false;
  }
  function closeDrawer() {
    if (driverPortal) driverPortal.hidden = true;
    if (drawerOverlay) drawerOverlay.hidden = true;
  }

  function showDriverLoggedIn(name) {
    if (driverLoggedOutView) driverLoggedOutView.hidden = true;
    if (driverLoggedInView) driverLoggedInView.hidden = false;
    if (currentDriverName) currentDriverName.textContent = name;
    if (driverNavBtn) driverNavBtn.textContent = `Hi, ${name.split(" ")[0]}`;
  }

  function showDriverLoggedOut() {
    if (driverLoggedInView) driverLoggedInView.hidden = true;
    if (driverLoggedOutView) driverLoggedOutView.hidden = false;
    if (driverLoginSubView) driverLoginSubView.hidden = false;
    if (driverRegisterSubView) driverRegisterSubView.hidden = true;
    if (driverNavBtn) driverNavBtn.textContent = "Driver Sign In";
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
      if (driverLoginForm) driverLoginForm.reset();
      if (driverAuthFeedback) driverAuthFeedback.textContent = "";
      setTimeout(closeDrawer, 500);
    } catch (err) {
      if (driverAuthFeedback) {
        driverAuthFeedback.dataset.tone = "error";
        driverAuthFeedback.textContent = err.message;
      }
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

      if (driverAuthFeedback) {
        driverAuthFeedback.dataset.tone = "success";
        driverAuthFeedback.textContent = "Account created. Switching to sign in…";
      }
      if (driverRegisterForm) driverRegisterForm.reset();

      setTimeout(() => {
        if (driverLoginSubView) driverLoginSubView.hidden = false;
        if (driverRegisterSubView) driverRegisterSubView.hidden = true;
        if (driverAuthFeedback) driverAuthFeedback.textContent = "";
      }, 1400);
    } catch (err) {
      if (driverAuthFeedback) {
        driverAuthFeedback.dataset.tone = "error";
        driverAuthFeedback.textContent = err.message;
      }
    }
  }

  async function init() {
    renderLoadingSkeleton();
    
    const [_, loc] = await Promise.all([
      loadParkingAreas(),
      resolveUserLocation()
    ]);

    userLocation = loc;

    if (locationStatus) {
      locationStatus.textContent = usingFallback
        ? "Using central reference point (location unavailable)"
        : "Connected to live location";
    }

    renderDashboard();

    if (driverToken && driverName) showDriverLoggedIn(driverName);

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value;
        renderDashboard();
      });
    }

    const findBtn = document.getElementById("findBestBtn");
    if (findBtn) findBtn.addEventListener("click", findBestParking);

    const findBtnMobile = document.getElementById("findBestBtnMobile");
    if (findBtnMobile) findBtnMobile.addEventListener("click", findBestParking);

    if (driverNavBtn) driverNavBtn.addEventListener("click", openDrawer);
    if (driverDrawerClose) driverDrawerClose.addEventListener("click", closeDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener("click", closeDrawer);

    if (toRegisterViewBtn) {
      toRegisterViewBtn.addEventListener("click", () => {
        if (driverLoginSubView) driverLoginSubView.hidden = true;
        if (driverRegisterSubView) driverRegisterSubView.hidden = false;
        if (driverAuthFeedback) driverAuthFeedback.textContent = "";
      });
    }

    if (toLoginViewBtn) {
      toLoginViewBtn.addEventListener("click", () => {
        if (driverLoginSubView) driverLoginSubView.hidden = false;
        if (driverRegisterSubView) driverRegisterSubView.hidden = true;
        if (driverAuthFeedback) driverAuthFeedback.textContent = "";
      });
    }

    if (driverLoginForm) driverLoginForm.addEventListener("submit", handleDriverLogin);
    if (driverRegisterForm) driverRegisterForm.addEventListener("submit", handleDriverRegister);

    if (driverLogoutBtn) {
      driverLogoutBtn.addEventListener("click", () => {
        driverToken = null;
        driverName = null;
        localStorage.removeItem("driverToken");
        localStorage.removeItem("driverName");
        showDriverLoggedOut();
      });
    }

    setInterval(async () => {
      await loadParkingAreas();
      renderDashboard();
    }, POLL_INTERVAL_MS);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
