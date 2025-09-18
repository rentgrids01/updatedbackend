// services/matchService.js
const PreferredTenant = require("../models/PreferredTenant");
const UniversalTenantApplication = require("../models/UniversalTenantApplication");
const { calculateMatchScore } = require("../utils/matchScore.js");
const Tenant = require("../models/Tenant");
const PropertyTenantCriteria = require("../models/PropertyTenantCriteria");

const getTenantMatchScore = async (tenantId, landlordId, propertyId) => {
  try {
    const tenant = await Tenant.findById(tenantId);

    if (!tenant) {
      console.warn("Tenant not found");
      return 0;
    }

    const applicationById = tenant.applicationId;
    if (!applicationById) {
      console.warn("Tenant has no applicationId");
      return 0;
    }

    const application = await UniversalTenantApplication.findById(applicationById);
    // console.log("Fetched Application:", application);
    if (!application) {
      console.warn("No tenant application found");
      return 0;
    }

    const query = { owner: landlordId };
    if (propertyId) query.property = propertyId;

    const preferredTenant = await PropertyTenantCriteria.findOne(query);
    console.log("Fetched PreferredTenant:", preferredTenant);

    if (!preferredTenant) {
      console.warn("No landlord preference found");
      return 0;
    }
    return calculateMatchScore(application.toObject(), preferredTenant.toObject());

  } catch (error) {
    console.error("Error calculating match score:", error);
    return 0;
  }
};

module.exports = { getTenantMatchScore };
