import jwt from "jsonwebtoken";
import authConfig from "../config/auth.js";

export function authenticateToken(req, res, next) {
  const authorizationHeader =
    req.headers.authorization ?? "";

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Authentication token is required.",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      authConfig.jwtSecret,
      {
        algorithms: ["HS256"],
        issuer: "church-form-backend",
        audience: "church-form-admin",
      }
    );

    req.user = {
      id: decoded.sub,
      username: decoded.username,
      role: decoded.role,
    };

    return next();
  } catch (error) {
    const message =
      error.name === "TokenExpiredError"
        ? "Your session has expired. Please log in again."
        : "Invalid authentication token.";

    return res.status(401).json({
      success: false,
      message,
    });
  }
}