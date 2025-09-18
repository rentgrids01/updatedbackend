// utils/calculateMatchScore.js

function calculateMatchScore(landlordPref, tenantApp) {
  let totalCriteria = 0;
  let matchedCriteria = 0;

  // 1. Preferred Tenant Type
  if (landlordPref.preferredTenantType) {
    totalCriteria++;
    if (tenantApp.preferredTenantType === landlordPref.preferredTenantType) {
      matchedCriteria++;
    }
  }

  // 2. Budget
  if (landlordPref.budgetMin && landlordPref.budgetMax && tenantApp.propertyPreferences) {
    totalCriteria++;
    const overlap =
      tenantApp.propertyPreferences.budgetMin <= landlordPref.budgetMax &&
      tenantApp.propertyPreferences.budgetMax >= landlordPref.budgetMin;
    if (overlap) matchedCriteria++;
  }

  // 3. Lease Duration
  if (landlordPref.leaseDuration && tenantApp.propertyPreferences?.leaseDuration) {
    totalCriteria++;
    if (landlordPref.leaseDuration === tenantApp.propertyPreferences.leaseDuration) {
      matchedCriteria++;
    }
  }

  // 4. Pets Allowed
  if (landlordPref.petsAllowed) {
    totalCriteria++;
    if (landlordPref.petsAllowed === "Yes" || tenantApp.preferences?.pet === false) {
      matchedCriteria++;
    }
  }

  // 5. Smoking Allowed
  if (landlordPref.smokingAllowed) {
    totalCriteria++;
    if (landlordPref.smokingAllowed === "Yes" || tenantApp.preferences?.smoker === false) {
      matchedCriteria++;
    }
  }

  // 6. Gender Preference
  if (landlordPref.genderPreference) {
    totalCriteria++;
    if (
      landlordPref.genderPreference === "Any" ||
      landlordPref.genderPreference.toLowerCase() === tenantApp.gender?.toLowerCase()
    ) {
      matchedCriteria++;
    }
  }

  // 7. Age Preference
  if (landlordPref.agePreference && tenantApp.personalDetails?.age) {
    totalCriteria++;
    const [minAge, maxAge] = landlordPref.agePreference.split("-").map(Number);
    if (tenantApp.personalDetails.age >= minAge && tenantApp.personalDetails.age <= maxAge) {
      matchedCriteria++;
    }
  }

  const score = totalCriteria > 0 ? (matchedCriteria / totalCriteria) * 100 : 0;
  return Math.round(score);
}

module.exports = { calculateMatchScore };
