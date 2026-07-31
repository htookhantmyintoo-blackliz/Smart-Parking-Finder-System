(() => {
  "use strict";

  const API_BASE = "https://smart-parking-finder-system-tlzt.onrender.com/api";
  let parkingAreas = [];
  let adminToken = localStorage.getItem("adminToken") || null;

  // DOM Elements
  const adminLoginView = document.getElementById("adminLoginView");
  const adminControlView = document.getElementById("adminControlView");
  const adminLoginForm = document.getElementById("adminLoginForm");
  const adminAuthFeedback = document.getElementById("adminAuthFeedback");
  const adminForm = document.getElementById("adminForm");
  const adminLotSelect = document.getElementById("adminLotSelect");
  const adminSpacesInput = document.getElementById("adminSpacesInput");
  const adminFeedback = document.getElementById("adminFeedback");
  const adminLogoutBtn = document.getElementById("adminLogoutBtn");
  const adminOverviewBody = document.getElementById("adminOverviewBody");

  // API Fetch Helper
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

  // Render Table Overview
  function renderOverview() {
    if (!adminOverviewBody) return;
    if (parkingAreas.length === 0) {
      adminOverviewBody.innerHTML = `<tr><td colspan="3">No car parks available.</td></tr>`;
      return;
    }

    adminOverviewBody.innerHTML = parkingAreas
      .map(
        (a) => `
        <tr>
          <td><strong>${a.name}</strong></td>
          <td class="mono">${a.availableSpaces}</td>
          <td class="mono">${a.totalSpaces}</td>
        </tr>`
      )
      .join("");
  }

  // Populate Dropdown & Sync Inputs
  function populateAdminSelect() {
    if (!adminLotSelect) return;
    adminLotSelect.innerHTML = parkingAreas
      .map((a) => `<option value="${a.id}">${a.name}</option>`)
      .join("");
    
    syncSpacesInput();
  }

  function syncSpacesInput() {
    if (!adminLotSelect || !adminSpacesInput) return;
    const selectedId = adminLotSelect.value;
    const area = parkingAreas.find((a) => a.id === selectedId);
    if (area) {
      adminSpacesInput.value = area.availableSpaces;
      adminSpacesInput.max = area.totalSpaces;
    }
  }

  // Load Parking Data
  async function loadParkingAreas() {
    parkingAreas = await apiFetch("/parking-areas");
    renderOverview();
    populateAdminSelect();
  }

  // Toggle View State
  function showLoggedIn() {
    if (adminLoginView) adminLoginView.hidden = true;
    if (adminControlView) adminControlView.hidden = false;
  }

  function showLoggedOut() {
    if (adminControlView) adminControlView.hidden = true;
    if (adminLoginView) adminLoginView.hidden = false;
    if (adminLoginForm) adminLoginForm.reset();
  }

  // Display Feedback
  function setFeedback(element, message, type = "error") {
    if (!element) return;
    element.dataset.tone = type;
    element.textContent = message;

    if (type === "success") {
      setTimeout(() => {
        element.textContent = "";
      }, 3500);
    }
  }

  // Admin Login Handler
  async function handleAdminLogin(e) {
    e.preventDefault();
    const username = document.getElementById("adminUsername").value.trim();
    const password = document.getElementById("adminPassword").value;

    try {
      const data = await apiFetch("/auth/admin/login", {
        method: "POST",
        body: JSON.stringify({ username, email: username, password }),
      });

      adminToken = data.token;
      localStorage.setItem("adminToken", adminToken);
      if (adminAuthFeedback) adminAuthFeedback.textContent = "";

      await loadParkingAreas();
      showLoggedIn();
    } catch (err) {
      setFeedback(adminAuthFeedback, err.message, "error");
    }
  }

  // Update Availability Handler
  async function handleAdminSubmit(e) {
    e.preventDefault();
    const id = adminLotSelect.value;
    const parsedSpaces = parseInt(adminSpacesInput.value, 10);

    if (isNaN(parsedSpaces) || parsedSpaces < 0) {
      setFeedback(adminFeedback, "Please enter a valid non-negative number.", "error");
      return;
    }

    try {
      const updated = await apiFetch(`/parking-areas/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ availableSpaces: parsedSpaces }),
      });

      // Update local array state
      const idx = parkingAreas.findIndex((a) => a.id === updated.id);
      if (idx !== -1) parkingAreas[idx] = updated;

      setFeedback(
        adminFeedback,
        `Updated ${updated.name} to ${updated.availableSpaces} spaces.`,
        "success"
      );

      renderOverview();
      adminLotSelect.value = updated.id;
      syncSpacesInput();
    } catch (err) {
      setFeedback(adminFeedback, err.message, "error");

      if (
        err.message.includes("token") ||
        err.message.includes("unauthorized") ||
        err.message.includes("Forbidden")
      ) {
        adminToken = null;
        localStorage.removeItem("adminToken");
        showLoggedOut();
      }
    }
  }

  // Initialization
  async function init() {
    if (adminLoginForm) adminLoginForm.addEventListener("submit", handleAdminLogin);
    if (adminForm) adminForm.addEventListener("submit", handleAdminSubmit);
    if (adminLotSelect) adminLotSelect.addEventListener("change", syncSpacesInput);

    if (adminLogoutBtn) {
      adminLogoutBtn.addEventListener("click", () => {
        adminToken = null;
        localStorage.removeItem("adminToken");
        if (adminFeedback) adminFeedback.textContent = "";
        showLoggedOut();
      });
    }

    if (adminToken) {
      try {
        await loadParkingAreas();
        showLoggedIn();
      } catch {
        adminToken = null;
        localStorage.removeItem("adminToken");
        showLoggedOut();
      }
    } else {
      showLoggedOut();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
