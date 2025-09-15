const Schedule = require('../models/Schedule');
const Property = require('../models/Property');

// Create Schedule
const createSchedule = async (req, res) => {
  try {
    const { property, date, time, notes } = req.body;

    const propertyDoc = await Property.findById(property);
    if (!propertyDoc) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const schedule = await Schedule.create({
      tenant: req.user._id,
      landlord: propertyDoc.owner,
      property,
      date,
      time,
      notes
    });

    res.status(201).json({
      success: true,
      message: 'Schedule created successfully',
      data: schedule
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Tenant Schedules
const getTenantSchedules = async (req, res) => {
  try {
    const schedules = await Schedule.find({ tenant: req.user._id })
      .populate('property', 'title location images')
      .populate('landlord', 'fullName emailId phonenumber')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: schedules
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Landlord Schedules
const getLandlordSchedules = async (req, res) => {
  try {
    const schedules = await Schedule.find({ landlord: req.user._id })
      .populate('property', 'title location images')
      .populate('tenant', 'fullName emailId phonenumber')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: schedules
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update Schedule Status
const updateScheduleStatus = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { status } = req.body;

    const schedule = await Schedule.findById(scheduleId);
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Check if user has permission to update
    if (schedule.tenant.toString() !== req.user._id.toString() && 
        schedule.landlord.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    schedule.status = status;
    schedule.updatedAt = new Date();
    await schedule.save();

    res.json({
      success: true,
      message: 'Schedule status updated successfully',
      data: schedule
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete Schedule
const deleteSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const schedule = await Schedule.findById(scheduleId);
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    if (schedule.tenant.toString() !== req.user._id.toString() && 
        schedule.landlord.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    await Schedule.findByIdAndDelete(scheduleId);

    res.json({
      success: true,
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createSchedule,
  getTenantSchedules,
  getLandlordSchedules,
  updateScheduleStatus,
  deleteSchedule
};