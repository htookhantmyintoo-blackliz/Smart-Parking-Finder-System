require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const parkingRoutes = require("./routes/parking");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/parking-areas", parkingRoutes);

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Serve frontend
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
app.use(express.static(FRONTEND_DIR));
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Smart Parking Finder backend running at http://localhost:${PORT}`);
});
