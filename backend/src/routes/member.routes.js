import express from "express";

import {
  createMember,
  getMembers,
  getMemberById,
  getDuplicate,
  getSeatingChart,
  sendMemberReminder,
} from "../controllers/member.controller.js";

import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public registration routes
router.post("/check-duplicate", getDuplicate);
router.post("/", createMember);
router.post("/:id/send-reminder", authenticateToken, sendMemberReminder);

// Protected administrative routes
router.get("/seating-chart", authenticateToken, getSeatingChart);
router.get("/", authenticateToken, getMembers);
router.get("/:id", authenticateToken, getMemberById);

router.get(
  "/seating-chart",
  authenticateToken,
  getSeatingChart
);

router.get(
  "/",
  authenticateToken,
  getMembers
);

router.get(
  "/:id",
  authenticateToken,
  getMemberById
);

export default router;