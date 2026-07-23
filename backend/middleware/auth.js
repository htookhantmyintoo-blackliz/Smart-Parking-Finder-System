const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function requireRole(role) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Missing authentication token." });
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload.role !== role) {
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
