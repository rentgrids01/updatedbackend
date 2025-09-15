const express = require('express');
const {
  createSchedule,
  getTenantSchedules,
  getLandlordSchedules,
  updateScheduleStatus,
  deleteSchedule
} = require('../controllers/scheduleController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all schedule routes
router.use(auth);

router.post('/', createSchedule);
router.get('/tenant', getTenantSchedules);
router.get('/landlord', getLandlordSchedules);
router.patch('/:scheduleId/status', updateScheduleStatus);
router.delete('/:scheduleId', deleteSchedule);

module.exports = router;