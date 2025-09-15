const VisitRequest = require('../models/VisitRequest');
const Property = require('../models/Property');
const Payment = require('../models/Payment');
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Visit Request
const createVisitRequest = async (req, res) => {
  try {
    const {
      propertyId,
      preferredSlots,
      notes,
      coApplicants,
      consents
    } = req.body;

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const visitRequest = await VisitRequest.create({
      tenant: req.user._id,
      landlord: property.owner,
      property: propertyId,
      preferredSlots,
      notes,
      coApplicants,
      consents,
      status: 'submitted',
      progress: 20
    });

    res.status(201).json({
      success: true,
      data: {
        id: visitRequest._id,
        status: visitRequest.status,
        payment: {
          required: visitRequest.paymentRequired,
          amount: visitRequest.paymentAmount,
          currency: 'INR',
          status: visitRequest.paymentStatus
        },
        timeline: [
          {
            code: 'application_submitted',
            label: 'Application Submitted',
            at: visitRequest.createdAt
          }
        ]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Visit Requests
const getVisitRequests = async (req, res) => {
  try {
    const { status } = req.query;
    
    const query = { tenant: req.user._id };
    if (status) {
      query.status = status;
    }

    const visitRequests = await VisitRequest.find(query)
      .populate('property', 'title location images monthlyRent propertyId')
      .populate('landlord', 'fullName emailId phonenumber')
      .sort({ createdAt: -1 });

    const formattedRequests = visitRequests.map(visit => ({
      id: visit._id,
      status: visit.status,
      requestedAt: visit.createdAt,
      property: {
        id: visit.property._id,
        title: visit.property.title,
        city: visit.property.location?.city,
        price: visit.property.monthlyRent,
        thumb: visit.property.images?.[0]
      },
      progress: visit.progress,
      latestAction: {
        type: getLatestActionType(visit.status),
        dueAt: getActionDueDate(visit)
      }
    }));

    res.json({
      success: true,
      data: formattedRequests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Visit Request Details
const getVisitRequestDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const visitRequest = await VisitRequest.findById(id)
      .populate('property', 'title location images monthlyRent securityDeposit propertyId')
      .populate('landlord', 'fullName emailId phonenumber');

    if (!visitRequest) {
      return res.status(404).json({
        success: false,
        message: 'Visit request not found'
      });
    }

    if (visitRequest.tenant.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const timeline = generateTimeline(visitRequest);

    res.json({
      success: true,
      data: {
        id: visitRequest._id,
        status: visitRequest.status,
        progress: visitRequest.progress,
        property: {
          id: visitRequest.property._id,
          title: visitRequest.property.title,
          address: visitRequest.property.location?.fullAddress,
          rent: visitRequest.property.monthlyRent,
          deposit: visitRequest.property.securityDeposit,
          images: visitRequest.property.images
        },
        proposedSlots: visitRequest.preferredSlots,
        selectedSlot: visitRequest.selectedSlot,
        payment: {
          required: visitRequest.paymentRequired,
          amount: visitRequest.paymentAmount,
          status: visitRequest.paymentStatus
        },
        timeline
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Cancel Visit Request
const cancelVisitRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reasonCode, reasonText } = req.body;

    const visitRequest = await VisitRequest.findById(id);
    if (!visitRequest) {
      return res.status(404).json({
        success: false,
        message: 'Visit request not found'
      });
    }

    if (visitRequest.tenant.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    visitRequest.status = 'cancelled_by_tenant';
    visitRequest.reasonCode = reasonCode;
    visitRequest.reasonText = reasonText;
    visitRequest.updatedAt = new Date();
    await visitRequest.save();

    res.json({
      success: true,
      message: 'Visit request cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create Payment Intent
const createPaymentIntent = async (req, res) => {
  try {
    const { id } = req.params;
    const { method, amount, currency = 'INR', returnUrl } = req.body;

    const visitRequest = await VisitRequest.findById(id);
    if (!visitRequest) {
      return res.status(404).json({
        success: false,
        message: 'Visit request not found'
      });
    }

    if (visitRequest.tenant.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amount * 100, // Convert to paise
      currency,
      receipt: `visit_${id}`,
      notes: {
        visitRequestId: id,
        tenantId: req.user._id.toString()
      }
    });

    // Create payment record
    const payment = await Payment.create({
      paymentId: `pay_${Date.now()}`,
      userId: req.user._id,
      userType: 'tenant',
      visitRequestId: id,
      amount,
      currency,
      method,
      gateway: 'razorpay',
      gatewayOrderId: order.id,
      returnUrl
    });

    // Update visit request
    visitRequest.paymentId = payment.paymentId;
    await visitRequest.save();

    res.json({
      success: true,
      data: {
        paymentId: payment.paymentId,
        gateway: 'razorpay',
        status: 'pending',
        orderId: order.id,
        amount,
        currency
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Payment Status
const getPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.json({
      success: true,
      data: {
        paymentId: payment.paymentId,
        status: payment.status,
        paidAt: payment.paidAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Reapply Visit Request
const reapplyVisitRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { preferredSlots } = req.body;

    const visitRequest = await VisitRequest.findById(id);
    if (!visitRequest) {
      return res.status(404).json({
        success: false,
        message: 'Visit request not found'
      });
    }

    if (visitRequest.tenant.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    visitRequest.status = 'submitted';
    visitRequest.preferredSlots = preferredSlots;
    visitRequest.progress = 20;
    visitRequest.updatedAt = new Date();
    await visitRequest.save();

    res.json({
      success: true,
      message: 'Visit request reapplied successfully',
      data: visitRequest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Helper functions
const getLatestActionType = (status) => {
  const actionMap = {
    'submitted': 'profile_verification',
    'profile_verified': 'awaiting_landlord_review',
    'landlord_reviewing': 'awaiting_landlord_review',
    'visit_requested': 'awaiting_payment',
    'landlord_approved': 'awaiting_tenant_confirmation',
    'landlord_rejected': 'request_rejected',
    'scheduled': 'visit_scheduled',
    'completed': 'visit_completed'
  };
  return actionMap[status] || 'unknown';
};

const getActionDueDate = (visit) => {
  const now = new Date();
  const createdAt = new Date(visit.createdAt);
  
  switch (visit.status) {
    case 'submitted':
      return new Date(createdAt.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    case 'landlord_reviewing':
      return new Date(createdAt.getTime() + 48 * 60 * 60 * 1000); // 48 hours
    default:
      return null;
  }
};

const generateTimeline = (visitRequest) => {
  const timeline = [
    {
      code: 'application_submitted',
      label: 'Application Submitted',
      at: visitRequest.createdAt,
      state: 'done'
    }
  ];

  if (['profile_verified', 'landlord_reviewing', 'visit_requested', 'landlord_approved', 'scheduled', 'completed'].includes(visitRequest.status)) {
    timeline.push({
      code: 'profile_verification',
      label: 'Profile Verification Completed',
      at: visitRequest.createdAt,
      state: 'done'
    });
  }

  if (['landlord_reviewing', 'visit_requested', 'landlord_approved', 'scheduled', 'completed'].includes(visitRequest.status)) {
    timeline.push({
      code: 'landlord_review',
      label: 'Landlord Reviewing',
      state: visitRequest.status === 'landlord_reviewing' ? 'active' : 'done'
    });
  }

  if (['visit_requested', 'landlord_approved', 'scheduled', 'completed'].includes(visitRequest.status)) {
    timeline.push({
      code: 'visit_request',
      label: 'Visit Request',
      state: visitRequest.status === 'visit_requested' ? 'active' : 'done'
    });
  }

  return timeline;
};

module.exports = {
  createVisitRequest,
  getVisitRequests,
  getVisitRequestDetails,
  cancelVisitRequest,
  createPaymentIntent,
  getPaymentStatus,
  reapplyVisitRequest
};