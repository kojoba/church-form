import express from "express";

import {
  createMember,
  getMembers,
  getMemberById,
  getDuplicate,
} from "../controllers/member.controller.js";

import { authenticateAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public routes
router.post("/check-duplicate", getDuplicate);
router.post("/", createMember);

// Protected routes
router.get("/", getMembers);
router.get("/:id", getMemberById);

export default router;