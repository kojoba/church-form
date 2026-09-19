import express from "express";

import {
  createMember,
  getMembers,
  getMemberById,
  getDuplicate,
  getSeatingChart,
  sendMemberReminder,
  assignMemberSeat,
  releaseMemberSeat,
} from "../controllers/member.controller.js";

import {
  authenticateAdmin,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// Public registration routes
router.post("/check-duplicate", getDuplicate);
router.post("/", createMember);

// Protected admin routes
router.get(
  "/",
  authenticateAdmin,
  getMembers
);

router.get(
  "/seating-chart",
  authenticateAdmin,
  getSeatingChart
);

router.post(
  "/:id/assign-seat",
  authenticateAdmin,
  assignMemberSeat
);

router.delete(
  "/:id/seat",
  authenticateAdmin,
  releaseMemberSeat
);

router.post(
  "/:id/send-reminder",
  authenticateAdmin,
  sendMemberReminder
);

router.get(
  "/:id",
  authenticateAdmin,
  getMemberById
);

export default router;