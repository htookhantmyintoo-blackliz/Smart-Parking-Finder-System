const express = require("express");
const db = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

// Helper to format response
function rowToArea(row) {
  return {
    id: row.id,
    name: row.name,
    coordinates: { lat: row.lat, lng: row.lng },
    totalSpaces: row.total_spaces,
    availableSpaces: row.available_spaces,
  };
}

// Get all parking areas
router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM parking_areas ORDER BY name").all();
  res.json(rows.map(rowToArea));
});

// Update available spaces (Admin only)
router.put("/:id", requireRole("admin"), (req, res) => {
  const { id } = req.params;
  const { availableSpaces } = req.body || {};

  const area = db.prepare("SELECT * FROM parking_areas WHERE id = ?").get(id);
  if (!area) {
    return res.status(404).json({ error: "Parking area not found." });
  }

  const value = Number(availableSpaces);
  if (!Number.isFinite(value) || value < 0 || value > area.total_spaces) {
    return res.status(400).json({ error: "Invalid entry count value." });
  }

  db.prepare("UPDATE parking_areas SET available_spaces = ? WHERE id = ?").run(value, id);

  const updated = db.prepare("SELECT * FROM parking_areas WHERE id = ?").get(id);
  res.json(rowToArea(updated));
});

module.exports = router;
