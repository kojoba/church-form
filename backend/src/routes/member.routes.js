import express from "express";

import {
  createMember,
  getMembers,
  getMemberById,
  getDuplicate,
} from "../controllers/member.controller.js";

import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public routes
router.post("/check-duplicate", getDuplicate);
router.post("/", createMember);

// Protected routes
router.get("/", authenticateToken, getMembers);
router.get("/:id", authenticateToken, getMemberById);

export default router;