const mongoose = require('mongoose');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const PlanFeature = require('../models/PlanFeature');
require('dotenv').config();

const seedSubscriptionPlans = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await SubscriptionPlan.deleteMany({});
    await PlanFeature.deleteMany({});

    // Owner Plans
    const ownerBasic = await SubscriptionPlan.create({
      code: 'OWNER_BASIC_MONTHLY',
      name: 'Owner Basic',
      audience: 'owner',
      category: 'Basic',
      description: 'Perfect for individual property owners',
      billingCycle: 'monthly',
      price: 999,
      setupFee: 0,
      trialDays: 7,
      isPopular: false,
      isPublished: true,
      sortOrder: 1
    });

    const ownerPro = await SubscriptionPlan.create({
      code: 'OWNER_PRO_MONTHLY',
      name: 'Owner Pro',
      audience: 'owner',
      category: 'Professional',
      description: 'For professional property managers',
      billingCycle: 'monthly',
      price: 1999,
      setupFee: 0,
      trialDays: 14,
      isPopular: true,
      isPublished: true,
      sortOrder: 2
    });

    const ownerEnterprise = await SubscriptionPlan.create({
      code: 'OWNER_ENTERPRISE_MONTHLY',
      name: 'Owner Enterprise',
      audience: 'owner',
      category: 'Enterprise',
      description: 'For large property management companies',
      billingCycle: 'monthly',
      price: 4999,
      setupFee: 1000,
      trialDays: 30,
      isPopular: false,
      isPublished: true,
      sortOrder: 3
    });

    // Tenant Plans
    const tenantBasic = await SubscriptionPlan.create({
      code: 'TENANT_BASIC_MONTHLY',
      name: 'Tenant Basic',
      audience: 'tenant',
      category: 'Basic',
      description: 'Essential features for property search',
      billingCycle: 'monthly',
      price: 199,
      setupFee: 0,
      trialDays: 3,
      isPopular: false,
      isPublished: true,
      sortOrder: 1
    });

    const tenantPremium = await SubscriptionPlan.create({
      code: 'TENANT_PREMIUM_MONTHLY',
      name: 'Tenant Premium',
      audience: 'tenant',
      category: 'Premium',
      description: 'Advanced search and priority support',
      billingCycle: 'monthly',
      price: 499,
      setupFee: 0,
      trialDays: 7,
      isPopular: true,
      isPublished: true,
      sortOrder: 2
    });

    // Add features for Owner Basic
    await PlanFeature.insertMany([
      { planId: ownerBasic._id, featureKey: 'max_properties', featureValue: 5 },
      { planId: ownerBasic._id, featureKey: 'max_images_per_property', featureValue: 10 },
      { planId: ownerBasic._id, featureKey: 'featured_listings', featureValue: 1 },
      { planId: ownerBasic._id, featureKey: 'analytics_dashboard', featureValue: true },
      { planId: ownerBasic._id, featureKey: 'email_support', featureValue: true }
    ]);

    // Add features for Owner Pro
    await PlanFeature.insertMany([
      { planId: ownerPro._id, featureKey: 'max_properties', featureValue: 25 },
      { planId: ownerPro._id, featureKey: 'max_images_per_property', featureValue: 25 },
      { planId: ownerPro._id, featureKey: 'featured_listings', featureValue: 5 },
      { planId: ownerPro._id, featureKey: 'analytics_dashboard', featureValue: true },
      { planId: ownerPro._id, featureKey: 'priority_support', featureValue: true },
      { planId: ownerPro._id, featureKey: 'ai_description_generator', featureValue: true },
      { planId: ownerPro._id, featureKey: 'bulk_operations', featureValue: true }
    ]);

    // Add features for Owner Enterprise
    await PlanFeature.insertMany([
      { planId: ownerEnterprise._id, featureKey: 'max_properties', featureValue: -1 }, // Unlimited
      { planId: ownerEnterprise._id, featureKey: 'max_images_per_property', featureValue: 50 },
      { planId: ownerEnterprise._id, featureKey: 'featured_listings', featureValue: -1 }, // Unlimited
      { planId: ownerEnterprise._id, featureKey: 'analytics_dashboard', featureValue: true },
      { planId: ownerEnterprise._id, featureKey: 'dedicated_support', featureValue: true },
      { planId: ownerEnterprise._id, featureKey: 'ai_description_generator', featureValue: true },
      { planId: ownerEnterprise._id, featureKey: 'bulk_operations', featureValue: true },
      { planId: ownerEnterprise._id, featureKey: 'api_access', featureValue: true },
      { planId: ownerEnterprise._id, featureKey: 'white_label', featureValue: true }
    ]);

    // Add features for Tenant Basic
    await PlanFeature.insertMany([
      { planId: tenantBasic._id, featureKey: 'max_saved_properties', featureValue: 10 },
      { planId: tenantBasic._id, featureKey: 'search_alerts', featureValue: 3 },
      { planId: tenantBasic._id, featureKey: 'visit_requests', featureValue: 5 },
      { planId: tenantBasic._id, featureKey: 'email_support', featureValue: true }
    ]);

    // Add features for Tenant Premium
    await PlanFeature.insertMany([
      { planId: tenantPremium._id, featureKey: 'max_saved_properties', featureValue: 50 },
      { planId: tenantPremium._id, featureKey: 'search_alerts', featureValue: 10 },
      { planId: tenantPremium._id, featureKey: 'visit_requests', featureValue: 20 },
      { planId: tenantPremium._id, featureKey: 'priority_support', featureValue: true },
      { planId: tenantPremium._id, featureKey: 'advanced_filters', featureValue: true },
      { planId: tenantPremium._id, featureKey: 'property_insights', featureValue: true }
    ]);

    console.log('Subscription plans seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding subscription plans:', error);
    process.exit(1);
  }
};

seedSubscriptionPlans();