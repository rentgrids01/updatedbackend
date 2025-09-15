const express = require('express');
const { generatePropertyDescription } = require('../controllers/aiController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware
router.use(auth);
router.use(requireRole(['landlord']));

router.post('/property-description', generatePropertyDescription);

module.exports = router;