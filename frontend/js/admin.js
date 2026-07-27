(() => {
  "use strict";

  const API_BASE = "https://smart-parking-finder-system-a2lq.onrender.com/api";
  let parkingAreas = [];
  let adminToken = localStorage.getItem("adminToken") || null;

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

  function renderOverview() {
    adminOverviewBody.innerHTML = parkingAreas
      .map(
        (a) => `
        <tr>
          <td>${a.name}</td>
          <td class="mono">${a.availableSpaces}</td>
          <td class="mono">${a.totalSpaces}</td>
        </tr>`
      )
      .join("");
  }

  function populateAdminSelect() {
    adminLotSelect.innerHTML = parkingAreas.map((a) => `<option value="${a.id}">${a.name}</option>`).join("");
    syncSpacesInputMax();
  }

  // Keeps the "Available spaces" input capped to the selected car park's
  // total capacity, so the browser itself blocks out-of-range values.
  function syncSpacesInputMax() {
    const area = parkingAreas.find((a) => a.id === adminLotSelect.value);
    if (area) adminSpacesInput.max = area.totalSpaces;
  }

  async function loadParkingAreas() {
    parkingAreas = await apiFetch("/parking-areas");
    renderOverview();
    populateAdminSelect();
  }

  function showLoggedIn() {
    adminLoginView.hidden = true;
    adminControlView.hidden = false;
  }
  function showLoggedOut() {
    adminControlView.hidden = true;
    adminLoginView.hidden = false;
  }

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
      adminLoginForm.reset();
      adminAuthFeedback.textContent = "";
      await loadParkingAreas();
      showLoggedIn();
    } catch (err) {
      adminAuthFeedback.dataset.tone = "error";
      adminAuthFeedback.textContent = err.message;
    }
  }

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

      adminFeedback.dataset.tone = "success";
      adminFeedback.textContent = `Updated ${updated.name} to ${updated.availableSpaces} spaces.`;
      renderOverview();
      adminForm.reset();
    } catch (err) {
      adminFeedback.dataset.tone = "error";
      adminFeedback.textContent = err.message;
      if (err.message === "Invalid or expired token." || err.message === "Missing authentication token.") {
        adminToken = null;
        localStorage.removeItem("adminToken");
        showLoggedOut();
      }
    }
  }

  async function init() {
    adminLoginForm.addEventListener("submit", handleAdminLogin);
    adminForm.addEventListener("submit", handleAdminSubmit);
    adminLotSelect.addEventListener("change", syncSpacesInputMax);
    adminLogoutBtn.addEventListener("click", () => {
      adminToken = null;
      localStorage.removeItem("adminToken");
      adminFeedback.textContent = "";
      showLoggedOut();
    });

    if (adminToken) {
      try {
        await loadParkingAreas();
        showLoggedIn();
      } catch {
        adminToken = null;
        localStorage.removeItem("adminToken");
        showLoggedOut();
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
