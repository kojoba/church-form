import jwt from "jsonwebtoken";
import authConfig from "../config/auth.js";

export function authenticateAdmin(req, res, next) {
  const authorizationHeader = req.headers.authorization;

  if (
    !authorizationHeader ||
    !authorizationHeader.startsWith("Bearer ")
  ) {
    return res.status(401).json({
      success: false,
      message: "Authentication token is required.",
    });
  }

  const token = authorizationHeader
    .slice(7)
    .trim();

  if (!token) {
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
        subject: "church-admin",
      }
    );

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Your login session has expired.",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid authentication token.",
    });
  }
}