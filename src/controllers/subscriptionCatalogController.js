const SubscriptionPlan = require('../models/SubscriptionPlan');
const PlanFeature = require('../models/PlanFeature');

// Get Published Plans
const getPublishedPlans = async (req, res) => {
  try {
    const { audience } = req.query;
    
    const query = { isPublished: true };
    if (audience && ['owner', 'tenant'].includes(audience)) {
      query.audience = { $in: [audience, 'both'] };
    }

    const plans = await SubscriptionPlan.find(query)
      .sort({ sortOrder: 1, price: 1 })
      .select('-createdBy -metadata');

    // Get features for each plan
    const plansWithFeatures = await Promise.all(
      plans.map(async (plan) => {
        const features = await PlanFeature.find({ planId: plan._id });
        return {
          ...plan.toObject(),
          features
        };
      })
    );

    res.json({
      data: plansWithFeatures,
      meta: { requestId: req.requestId || 'public' }
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

// Get Plan by Code
const getPlanByCode = async (req, res) => {
  try {
    const { code } = req.params;

    const plan = await SubscriptionPlan.findOne({ 
      code: code.toUpperCase(), 
      isPublished: true 
    }).select('-createdBy -metadata');

    if (!plan) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Plan not found'
        }
      });
    }

    // Get plan features
    const features = await PlanFeature.find({ planId: plan._id });

    res.json({
      data: {
        ...plan.toObject(),
        features
      },
      meta: { requestId: req.requestId || 'public' }
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
  getPublishedPlans,
  getPlanByCode
};