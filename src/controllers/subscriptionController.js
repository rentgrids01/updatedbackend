const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Payment = require('../models/Payment');
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Get Subscription Plans
const getSubscriptionPlans = async (req, res) => {
  try {
    const { userType } = req.query;
    
    const query = { isActive: true };
    if (userType) {
      query.planType = { $in: [userType, 'both'] };
    }

    const plans = await SubscriptionPlan.find(query).sort({ price: 1 });

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Purchase Subscription
const purchaseSubscription = async (req, res) => {
  try {
    const { planId, duration = 1 } = req.body;

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    // Check if user type matches plan type
    if (plan.planType !== 'both' && plan.planType !== req.userType) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan for user type'
      });
    }

    const amount = plan.price * duration;

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      receipt: `sub_${Date.now()}`,
      notes: {
        planId: planId,
        userId: req.user._id.toString(),
        userType: req.userType,
        duration
      }
    });

    // Create payment record
    const payment = await Payment.create({
      paymentId: `pay_${Date.now()}`,
      userId: req.user._id,
      userType: req.userType,
      amount,
      currency: 'INR',
      gateway: 'razorpay',
      gatewayOrderId: order.id
    });

    res.json({
      success: true,
      data: {
        paymentId: payment.paymentId,
        orderId: order.id,
        amount,
        currency: 'INR'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Subscription Status
const getSubscriptionStatus = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      userId: req.user._id,
      userType: req.userType,
      status: 'active'
    }).populate('planId');

    if (!subscription) {
      return res.json({
        success: true,
        data: {
          hasActiveSubscription: false,
          message: 'No active subscription found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        hasActiveSubscription: true,
        subscription: {
          id: subscription._id,
          planName: subscription.planId.planName,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          status: subscription.status,
          autoRenew: subscription.autoRenew
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Subscription Features
const getSubscriptionFeatures = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      userId: req.user._id,
      userType: req.userType,
      status: 'active'
    }).populate('planId');

    if (!subscription) {
      return res.json({
        success: true,
        data: {
          features: [],
          message: 'No active subscription'
        }
      });
    }

    res.json({
      success: true,
      data: {
        features: subscription.planId.features,
        planName: subscription.planId.planName
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Cancel Subscription
const cancelSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      userId: req.user._id,
      userType: req.userType,
      status: 'active'
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    subscription.status = 'cancelled';
    subscription.autoRenew = false;
    await subscription.save();

    res.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getSubscriptionPlans,
  purchaseSubscription,
  getSubscriptionStatus,
  getSubscriptionFeatures,
  cancelSubscription
};