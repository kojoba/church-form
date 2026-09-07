import express from "express";
import { login } from "../controllers/auth.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/login", login);

router.get("/me", authenticateToken, (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      username: req.user.username,
      role: req.user.role,
    },
  });
});

export default router;