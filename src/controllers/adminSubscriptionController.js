const SubscriptionPlan = require('../models/SubscriptionPlan');
const PlanFeature = require('../models/PlanFeature');
const Coupon = require('../models/Coupon');
const UserSubscription = require('../models/UserSubscription');
const Invoice = require('../models/Invoice');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const { saveFile } = require('../utils/fileUpload');

// Plan Management
const createPlan = async (req, res) => {
  try {
    const planData = req.body;
    
    let planImageUrl = '';
    if (req.file) {
      const result = await saveFile(
        req.file.buffer,
        'plan_images',
        req.file.originalname
      );
      planImageUrl = result.url;
    }

    const plan = await SubscriptionPlan.create({
      ...planData,
      planImage: planImageUrl,
      createdBy: req.user._id
    });

    res.status(201).json({
      data: plan,
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'CREATION_ERROR',
        message: error.message
      }
    });
  }
};

const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (req.file) {
      const result = await saveFile(
        req.file.buffer,
        'plan_images',
        req.file.originalname
      );
      updateData.planImage = result.url;
    }

    updateData.updatedAt = new Date();

    const plan = await SubscriptionPlan.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!plan) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Plan not found'
        }
      });
    }

    res.json({
      data: plan,
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'UPDATE_ERROR',
        message: error.message
      }
    });
  }
};

const publishPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { isPublished } = req.body;

    const plan = await SubscriptionPlan.findByIdAndUpdate(
      id,
      { isPublished, updatedAt: new Date() },
      { new: true }
    );

    if (!plan) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Plan not found'
        }
      });
    }

    res.json({
      data: plan,
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'UPDATE_ERROR',
        message: error.message
      }
    });
  }
};

const getAllPlans = async (req, res) => {
  try {
    const { page = 1, limit = 10, audience, isPublished } = req.query;
    
    const query = {};
    if (audience) query.audience = audience;
    if (isPublished !== undefined) query.isPublished = isPublished === 'true';

    const plans = await SubscriptionPlan.find(query)
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'fullName');

    const total = await SubscriptionPlan.countDocuments(query);

    res.json({
      data: {
        plans,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          hasNext: page * limit < total
        }
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

const getPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await SubscriptionPlan.findById(id)
      .populate('createdBy', 'fullName');

    if (!plan) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Plan not found'
        }
      });
    }

    // Get plan features
    const features = await PlanFeature.find({ planId: id });

    res.json({
      data: {
        ...plan.toObject(),
        features
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

const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if plan has active subscriptions
    const activeSubscriptions = await UserSubscription.countDocuments({
      planId: id,
      status: { $in: ['active', 'trialing'] }
    });

    if (activeSubscriptions > 0) {
      return res.status(400).json({
        error: {
          code: 'PLAN_IN_USE',
          message: 'Cannot delete plan with active subscriptions'
        }
      });
    }

    await SubscriptionPlan.findByIdAndDelete(id);
    await PlanFeature.deleteMany({ planId: id });

    res.json({
      data: { message: 'Plan deleted successfully' },
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'DELETE_ERROR',
        message: error.message
      }
    });
  }
};

// Feature Management
const addPlanFeature = async (req, res) => {
  try {
    const { id } = req.params;
    const { featureKey, featureValue } = req.body;

    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Plan not found'
        }
      });
    }

    const feature = await PlanFeature.create({
      planId: id,
      featureKey,
      featureValue
    });

    res.status(201).json({
      data: feature,
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'CREATION_ERROR',
        message: error.message
      }
    });
  }
};

const updatePlanFeature = async (req, res) => {
  try {
    const { id, featureKey } = req.params;
    const { featureValue } = req.body;

    const feature = await PlanFeature.findOneAndUpdate(
      { planId: id, featureKey },
      { featureValue },
      { new: true, upsert: true }
    );

    res.json({
      data: feature,
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'UPDATE_ERROR',
        message: error.message
      }
    });
  }
};

const deletePlanFeature = async (req, res) => {
  try {
    const { id, featureKey } = req.params;

    await PlanFeature.findOneAndDelete({ planId: id, featureKey });

    res.json({
      data: { message: 'Feature deleted successfully' },
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'DELETE_ERROR',
        message: error.message
      }
    });
  }
};

// Coupon Management
const createCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.create({
      ...req.body,
      createdBy: req.user._id
    });

    res.status(201).json({
      data: coupon,
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'CREATION_ERROR',
        message: error.message
      }
    });
  }
};

const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!coupon) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Coupon not found'
        }
      });
    }

    res.json({
      data: coupon,
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'UPDATE_ERROR',
        message: error.message
      }
    });
  }
};

const getAllCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive } = req.query;
    
    const query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'fullName');

    const total = await Coupon.countDocuments(query);

    res.json({
      data: {
        coupons,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          hasNext: page * limit < total
        }
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

const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    await Coupon.findByIdAndDelete(id);

    res.json({
      data: { message: 'Coupon deleted successfully' },
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'DELETE_ERROR',
        message: error.message
      }
    });
  }
};

// Oversight
const getAllSubscriptions = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, audience } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (audience) query.audience = audience;

    const subscriptions = await UserSubscription.find(query)
      .populate('planId', 'name code price')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await UserSubscription.countDocuments(query);

    res.json({
      data: {
        subscriptions,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          hasNext: page * limit < total
        }
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

const getSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    const subscription = await UserSubscription.findById(id)
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

const updateSubscriptionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const subscription = await UserSubscription.findByIdAndUpdate(
      id,
      { status, updatedAt: new Date() },
      { new: true }
    );

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
        code: 'UPDATE_ERROR',
        message: error.message
      }
    });
  }
};

const getAllInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = {};
    if (status) query.status = status;

    const invoices = await Invoice.find(query)
      .populate('subscriptionId', 'planId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Invoice.countDocuments(query);

    res.json({
      data: {
        invoices,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          hasNext: page * limit < total
        }
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

const getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = {};
    if (status) query.status = status;

    const payments = await SubscriptionPayment.find(query)
      .populate('invoiceId', 'invoiceNo total')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SubscriptionPayment.countDocuments(query);

    res.json({
      data: {
        payments,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          hasNext: page * limit < total
        }
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

module.exports = {
  createPlan,
  updatePlan,
  publishPlan,
  getAllPlans,
  getPlanById,
  deletePlan,
  addPlanFeature,
  updatePlanFeature,
  deletePlanFeature,
  createCoupon,
  updateCoupon,
  getAllCoupons,
  deleteCoupon,
  getAllSubscriptions,
  getSubscriptionById,
  updateSubscriptionStatus,
  getAllInvoices,
  getAllPayments
};