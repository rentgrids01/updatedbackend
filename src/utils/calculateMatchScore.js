function calculateMatchScore(propertyCriteria, tenantApp) {
  if (!tenantApp) return 0;

  let score = 0;
  let total = 0;

  // Tenant Type
  total++;
  if (propertyCriteria.preferTenantType?.includes(tenantApp.preferences?.tenantType)) score++;

  // Gender
  total++;
  if (
    propertyCriteria.genderPreference === 'Any' ||
    propertyCriteria.genderPreference?.toLowerCase() === tenantApp.preferences?.gender?.toLowerCase()
  ) score++;

  // Language
  total++;
  if (
    propertyCriteria.languagePreference &&
    tenantApp.preferences?.language &&
    propertyCriteria.languagePreference.toLowerCase() === tenantApp.preferences.language.toLowerCase()
  ) score++;

  // Move-in Date
  total++;
  if (tenantApp.propertyPreferences?.moveInDate && propertyCriteria.moveInDate) {
    if (new Date(tenantApp.propertyPreferences.moveInDate) <= new Date(propertyCriteria.moveInDate)) score++;
  }

  // Lease Duration
  total++;
  if (
    tenantApp.propertyPreferences?.leaseDuration &&
    propertyCriteria.leaseDuration &&
    tenantApp.propertyPreferences.leaseDuration === propertyCriteria.leaseDuration
  ) score++;

  // Number of Occupants
  total++;
  if (
    tenantApp.propertyPreferences?.occupants &&
    propertyCriteria.numberOfOccupants &&
    tenantApp.propertyPreferences.occupants <= propertyCriteria.numberOfOccupants
  ) score++;

  // Pets Allowed
  total++;
  if (tenantApp.preferences?.pet === propertyCriteria.petsAllowed) score++;

  // Smoking Allowed
  total++;
  if (tenantApp.preferences?.smoker === propertyCriteria.smokingAllowed) score++;

  // Couple Friendly
  total++;
  if (tenantApp.preferences?.coupleFriendly === propertyCriteria.coupleFriendly) score++;

  return total ? Math.round((score / total) * 100) : 0;
}

module.exports = calculateMatchScore;
