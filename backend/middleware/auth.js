const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

if (process.env.NODE_ENV === "production" && JWT_SECRET === "dev-secret-change-me") {
  console.warn("⚠️ WARNING: Using default JWT_SECRET in production mode!");
}

/* Middleware to authorize requests based on user roles. Accepts a single role string (e.g., "admin") or an array of allowed roles (e.g., ["admin", "driver"]).*/
function requireRole(roles) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = match ? match[1].trim() : null;

    if (!token) {
      return res.status(401).json({ error: "Missing authentication token." });
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET);

      if (!allowedRoles.includes(payload.role)) {
        return res.status(403).json({ error: "Insufficient permissions." });
      }

      req.user = payload;
      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
  };
}

module.exports = { requireRole, JWT_SECRET };
