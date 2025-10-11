const express = require("express");
const {
  getMyNotifications,
  markNotificationRead,
} = require("../controllers/notificationController");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.use(auth);

router.get("/", getMyNotifications);
router.patch("/:id/read", markNotificationRead);

module.exports = router;
  