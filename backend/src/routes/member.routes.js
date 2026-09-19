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
  authenticateToken,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/check-duplicate", getDuplicate);
router.post("/", createMember);

router.get("/", authenticateToken, getMembers);
router.get("/seating-chart", authenticateToken, getSeatingChart);

router.post(
  "/:id/assign-seat",
  authenticateToken,
  assignMemberSeat,
);

router.delete(
  "/:id/seat",
  authenticateToken,
  releaseMemberSeat,
);

router.post(
  "/:id/send-reminder",
  authenticateToken,
  sendMemberReminder,
);

router.get("/:id", authenticateToken, getMemberById);

export default router;