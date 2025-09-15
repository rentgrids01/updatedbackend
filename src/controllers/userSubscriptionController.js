const UserSubscription = require('../models/UserSubscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const PlanFeature = require('../models/PlanFeature');
const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const SubscriptionUsage = require('../models/SubscriptionUsage');
const IdempotencyKey = require('../models/IdempotencyKey');
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Subscribe to Plan
const subscribeToPlan = async (req, res) => {
  try {
    const {
      plan_code,
      billing_cycle,
      coupon_code,
      trial_override_days,
      proration_behavior = 'create_prorations',
      start_now = true,
      payment_gateway = 'razorpay'
    } = req.body;

    // Idempotency check
    const idempotencyKey = req.headers['idempotency-key'];
    if (idempotencyKey) {
      const existing = await IdempotencyKey.findOne({
        key: idempotencyKey,
        scope: 'subscription_create'
      });
      if (existing) {
        return res.json(existing.result);
      }
    }

    // Find plan
    const plan = await SubscriptionPlan.findOne({
      code: plan_code.toUpperCase(),
      isPublished: true
    });

    if (!plan) {
      return res.status(404).json({
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Subscription plan not found'
        }
      });
    }

    // Check audience compatibility
    const userAudience = req.userType === 'owner' ? 'owner' : 'tenant';
    if (plan.audience !== 'both' && plan.audience !== userAudience) {
      return res.status(400).json({
        error: {
          code: 'INVALID_AUDIENCE',
          message: 'Plan not available for your user type'
        }
      });
    }

    // Check for existing active subscription
    const existingSubscription = await UserSubscription.findOne({
      userId: req.user._id,
      audience: userAudience,
      status: { $in: ['active', 'trialing'] }
    });

    if (existingSubscription) {
      return res.status(400).json({
        error: {
          code: 'ACTIVE_SUBSCRIPTION_EXISTS',
          message: 'You already have an active subscription'
        }
      });
    }

    let coupon = null;
    let discount = 0;

    // Validate coupon if provided
    if (coupon_code) {
      coupon = await Coupon.findOne({
        code: coupon_code.toUpperCase(),
        isActive: true,
        startsAt: { $lte: new Date() },
        endsAt: { $gte: new Date() }
      });

      if (!coupon) {
        return res.status(400).json({
          error: {
            code: 'INVALID_COUPON',
            message: 'Invalid or expired coupon code'
          }
        });
      }

      // Check redemption limits
      const redemptionCount = await CouponRedemption.countDocuments({
        couponId: coupon._id
      });

      if (coupon.maxRedemptions && redemptionCount >= coupon.maxRedemptions) {
        return res.status(400).json({
          error: {
            code: 'COUPON_LIMIT_EXCEEDED',
            message: 'Coupon redemption limit exceeded'
          }
        });
      }

      const userRedemptions = await CouponRedemption.countDocuments({
        couponId: coupon._id,
        userId: req.user._id
      });

      if (userRedemptions >= coupon.perUserLimit) {
        return res.status(400).json({
          error: {
            code: 'USER_COUPON_LIMIT_EXCEEDED',
            message: 'You have already used this coupon'
          }
        });
      }

      // Calculate discount
      if (coupon.kind === 'percent') {
        discount = (plan.price * coupon.value) / 100;
      } else {
        discount = coupon.value;
      }
    }

    // Calculate subscription period
    const now = new Date();
    const trialDays = trial_override_days !== undefined ? trial_override_days : plan.trialDays;
    const currentPeriodStart = start_now ? now : new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    let currentPeriodEnd;
    switch (billing_cycle || plan.billingCycle) {
      case 'monthly':
        currentPeriodEnd = new Date(currentPeriodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarterly':
        currentPeriodEnd = new Date(currentPeriodStart.getTime() + 90 * 24 * 60 * 60 * 1000);
        break;
      case 'yearly':
        currentPeriodEnd = new Date(currentPeriodStart.getTime() + 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        currentPeriodEnd = new Date(currentPeriodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    // Create subscription
    const subscription = await UserSubscription.create({
      userId: req.user._id,
      audience: userAudience,
      planId: plan._id,
      status: trialDays > 0 ? 'trialing' : 'active',
      currentPeriodStart,
      currentPeriodEnd,
      prorationBehavior: proration_behavior,
      gateway: payment_gateway,
      couponId: coupon?._id
    });

    // Create invoice
    const subtotal = plan.price + plan.setupFee;
    const total = Math.max(0, subtotal - discount);

    const invoice = await Invoice.create({
      userId: req.user._id,
      subscriptionId: subscription._id,
      currency: plan.currency,
      subtotal,
      discount,
      total,
      dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    // Create invoice items
    await InvoiceItem.create({
      invoiceId: invoice._id,
      description: `${plan.name} - ${billing_cycle || plan.billingCycle}`,
      quantity: 1,
      unitPrice: plan.price,
      lineTotal: plan.price
    });

    if (plan.setupFee > 0) {
      await InvoiceItem.create({
        invoiceId: invoice._id,
        description: 'Setup Fee',
        quantity: 1,
        unitPrice: plan.setupFee,
        lineTotal: plan.setupFee
      });
    }

    // Record coupon redemption
    if (coupon) {
      await CouponRedemption.create({
        couponId: coupon._id,
        userId: req.user._id,
        subscriptionId: subscription._id
      });
    }

    const result = {
      data: {
        subscription: {
          id: subscription._id,
          status: subscription.status,
          current_period_start: subscription.currentPeriodStart,
          current_period_end: subscription.currentPeriodEnd,
          plan: {
            code: plan.code,
            name: plan.name,
            price: plan.price
          }
        },
        invoice: {
          id: invoice._id,
          invoice_no: invoice.invoiceNo,
          total: invoice.total,
          status: invoice.status,
          due_at: invoice.dueAt
        }
      },
      meta: { requestId: req.requestId }
    };

    // Store idempotency result
    if (idempotencyKey) {
      await IdempotencyKey.create({
        key: idempotencyKey,
        scope: 'subscription_create',
        result
      });
    }

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'SUBSCRIPTION_ERROR',
        message: error.message
      }
    });
  }
};

// Get User Subscriptions
const getUserSubscriptions = async (req, res) => {
  try {
    const userAudience = req.userType === 'owner' ? 'owner' : 'tenant';
    
    const subscriptions = await UserSubscription.find({
      userId: req.user._id,
      audience: userAudience
    })
      .populate('planId', 'code name price billingCycle')
      .populate('couponId', 'code value kind')
      .sort({ createdAt: -1 });

    res.json({
      data: subscriptions,
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'FETCH_ERROR',
        message: error.message
      }
    });
  }
};

// Get Subscription by ID
const getSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;
    const userAudience = req.userType === 'owner' ? 'owner' : 'tenant';

    const subscription = await UserSubscription.findOne({
      _id: id,
      userId: req.user._id,
      audience: userAudience
    })
      .populate('planId')
      .populate('couponId');

    if (!subscription) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Subscription not found'
        }
      });
    }

    res.json({
      data: subscription,
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'FETCH_ERROR',
        message: error.message
      }
    });
  }
};

// Get User Entitlements
const getUserEntitlements = async (req, res) => {
  try {
    const userAudience = req.userType === 'owner' ? 'owner' : 'tenant';

    const activeSubscription = await UserSubscription.findOne({
      userId: req.user._id,
      audience: userAudience,
      status: { $in: ['active', 'trialing'] }
    }).populate('planId');

    if (!activeSubscription) {
      return res.json({
        data: {
          hasActiveSubscription: false,
          features: {}
        },
        meta: { requestId: req.requestId }
      });
    }

    const features = await PlanFeature.find({ planId: activeSubscription.planId._id });
    const featureMap = {};
    features.forEach(feature => {
      featureMap[feature.featureKey] = feature.featureValue;
    });

    res.json({
      data: {
        hasActiveSubscription: true,
        subscription: {
          id: activeSubscription._id,
          status: activeSubscription.status,
          plan: activeSubscription.planId.name,
          current_period_end: activeSubscription.currentPeriodEnd
        },
        features: featureMap
      },
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'FETCH_ERROR',
        message: error.message
      }
    });
  }
};

// Cancel Subscription
const cancelSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancel_at_period_end = true } = req.body;
    const userAudience = req.userType === 'owner' ? 'owner' : 'tenant';

    const subscription = await UserSubscription.findOne({
      _id: id,
      userId: req.user._id,
      audience: userAudience,
      status: { $in: ['active', 'trialing'] }
    });

    if (!subscription) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Active subscription not found'
        }
      });
    }

    if (cancel_at_period_end) {
      subscription.cancelAtPeriodEnd = true;
    } else {
      subscription.status = 'canceled';
      subscription.canceledAt = new Date();
    }

    subscription.updatedAt = new Date();
    await subscription.save();

    res.json({
      data: subscription,
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'CANCEL_ERROR',
        message: error.message
      }
    });
  }
};

// Pause Subscription
const pauseSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { resume_at } = req.body;
    const userAudience = req.userType === 'owner' ? 'owner' : 'tenant';

    const subscription = await UserSubscription.findOne({
      _id: id,
      userId: req.user._id,
      audience: userAudience,
      status: 'active'
    });

    if (!subscription) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Active subscription not found'
        }
      });
    }

    subscription.status = 'paused';
    subscription.pausedAt = new Date();
    if (resume_at) {
      subscription.resumeAt = new Date(resume_at);
    }
    subscription.updatedAt = new Date();
    await subscription.save();

    res.json({
      data: subscription,
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'PAUSE_ERROR',
        message: error.message
      }
    });
  }
};

// Resume Subscription
const resumeSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const userAudience = req.userType === 'owner' ? 'owner' : 'tenant';

    const subscription = await UserSubscription.findOne({
      _id: id,
      userId: req.user._id,
      audience: userAudience,
      status: 'paused'
    });

    if (!subscription) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Paused subscription not found'
        }
      });
    }

    subscription.status = 'active';
    subscription.pausedAt = null;
    subscription.resumeAt = null;
    subscription.updatedAt = new Date();
    await subscription.save();

    res.json({
      data: subscription,
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'RESUME_ERROR',
        message: error.message
      }
    });
  }
};

// Report Usage
const reportUsage = async (req, res) => {
  try {
    const { metric, quantity = 1 } = req.body;
    const userAudience = req.userType === 'owner' ? 'owner' : 'tenant';

    const activeSubscription = await UserSubscription.findOne({
      userId: req.user._id,
      audience: userAudience,
      status: { $in: ['active', 'trialing'] }
    });

    if (!activeSubscription) {
      return res.status(404).json({
        error: {
          code: 'NO_ACTIVE_SUBSCRIPTION',
          message: 'No active subscription found'
        }
      });
    }

    // Find or create usage record for current period
    let usage = await SubscriptionUsage.findOne({
      subscriptionId: activeSubscription._id,
      metric,
      periodStart: activeSubscription.currentPeriodStart,
      periodEnd: activeSubscription.currentPeriodEnd
    });

    if (!usage) {
      usage = await SubscriptionUsage.create({
        subscriptionId: activeSubscription._id,
        metric,
        used: quantity,
        periodStart: activeSubscription.currentPeriodStart,
        periodEnd: activeSubscription.currentPeriodEnd
      });
    } else {
      usage.used += quantity;
      await usage.save();
    }

    res.json({
      data: {
        metric,
        used: usage.used,
        period_start: usage.periodStart,
        period_end: usage.periodEnd
      },
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'USAGE_ERROR',
        message: error.message
      }
    });
  }
};

module.exports = {
  subscribeToPlan,
  getUserSubscriptions,
  getSubscriptionById,
  getUserEntitlements,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  reportUsage
};