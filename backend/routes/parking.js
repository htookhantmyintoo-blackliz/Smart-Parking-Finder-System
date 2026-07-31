const express = require("express");
const db = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

// Format database row into clean API object
function rowToArea(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    coordinates: { lat: Number(row.lat), lng: Number(row.lng) },
    totalSpaces: Number(row.total_spaces),
    availableSpaces: Number(row.available_spaces),
  };
}

// Retrieve all parking areas (Public)
router.get("/", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM parking_areas ORDER BY name ASC").all();
    res.json(rows.map(rowToArea));
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve parking areas." });
  }
});

// Retrieve single parking area (Public)
router.get("/:id", (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM parking_areas WHERE id = ?").get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: "Parking area not found." });
    }
    res.json(rowToArea(row));
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve parking area." });
  }
});

// Add a new parking area (Admin only)
router.post("/", requireRole("admin"), (req, res) => {
  const { id, name, lat, lng, totalSpaces, availableSpaces } = req.body || {};

  if (!id || !name || lat === undefined || lng === undefined || totalSpaces === undefined) {
    return res.status(400).json({ error: "Missing required fields (id, name, lat, lng, totalSpaces)." });
  }

  const parsedTotal = parseInt(totalSpaces, 10);
  const parsedAvailable = availableSpaces !== undefined ? parseInt(availableSpaces, 10) : parsedTotal;

  if (isNaN(parsedTotal) || parsedTotal <= 0) {
    return res.status(400).json({ error: "Total spaces must be a positive integer." });
  }

  if (isNaN(parsedAvailable) || parsedAvailable < 0 || parsedAvailable > parsedTotal) {
    return res.status(400).json({ error: "Available spaces must be between 0 and total spaces." });
  }

  const existing = db.prepare("SELECT id FROM parking_areas WHERE id = ?").get(id.trim());
  if (existing) {
    return res.status(409).json({ error: "Parking area with this ID already exists." });
  }

  db.prepare(`
    INSERT INTO parking_areas (id, name, lat, lng, total_spaces, available_spaces)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id.trim(), name.trim(), Number(lat), Number(lng), parsedTotal, parsedAvailable);

  const created = db.prepare("SELECT * FROM parking_areas WHERE id = ?").get(id.trim());
  res.status(201).json(rowToArea(created));
});

// Update parking area details or space count (Admin only)
router.put("/:id", requireRole("admin"), (req, res) => {
  const { id } = req.params;
  const { name, lat, lng, totalSpaces, availableSpaces } = req.body || {};

  const area = db.prepare("SELECT * FROM parking_areas WHERE id = ?").get(id);
  if (!area) {
    return res.status(404).json({ error: "Parking area not found." });
  }

  // Fallback to current DB values if optional fields aren't supplied in payload
  const newName = name !== undefined ? name.trim() : area.name;
  const newLat = lat !== undefined ? Number(lat) : area.lat;
  const newLng = lng !== undefined ? Number(lng) : area.lng;
  const newTotal = totalSpaces !== undefined ? parseInt(totalSpaces, 10) : area.total_spaces;
  const newAvailable = availableSpaces !== undefined ? parseInt(availableSpaces, 10) : area.available_spaces;

  if (isNaN(newTotal) || newTotal <= 0) {
    return res.status(400).json({ error: "Total spaces must be a positive integer." });
  }

  if (isNaN(newAvailable) || newAvailable < 0 || newAvailable > newTotal) {
    return res.status(400).json({ error: "Available spaces must be between 0 and total spaces." });
  }

  db.prepare(`
    UPDATE parking_areas
    SET name = ?, lat = ?, lng = ?, total_spaces = ?, available_spaces = ?
    WHERE id = ?
  `).run(newName, newLat, newLng, newTotal, newAvailable, id);

  const updated = db.prepare("SELECT * FROM parking_areas WHERE id = ?").get(id);
  res.json(rowToArea(updated));
});

// emove a parking area (Admin only)
router.delete("/:id", requireRole("admin"), (req, res) => {
  const { id } = req.params;

  const area = db.prepare("SELECT id FROM parking_areas WHERE id = ?").get(id);
  if (!area) {
    return res.status(404).json({ error: "Parking area not found." });
  }

  db.prepare("DELETE FROM parking_areas WHERE id = ?").run(id);
  res.json({ message: "Parking area removed successfully.", id });
});

module.exports = router;
