const calculateMatchScore = (application, criteria) => {
  let score = 0;
  let total = 0;

  if (criteria.agePreference && application.personalDetails.age) {
    const [minAge, maxAge] = criteria.agePreference.split("-").map(Number);
    total += 1;
    if (application.personalDetails.age >= minAge && application.personalDetails.age <= maxAge) {
      score += 1;
    }
  }

  if (criteria.genderPreference) {
    total += 1;
    if (criteria.genderPreference.toLowerCase() === "any" || 
        criteria.genderPreference.toLowerCase() === application.preferences.gender.toLowerCase()) {
      score += 1;
    }
  }

  if (criteria.languagePreference && application.preferences.language) {
    total += 1;
    if (criteria.languagePreference.toLowerCase() === application.preferences.language.toLowerCase()) {
      score += 1;
    }
  }

  if (criteria.petsAllowed !== undefined) {
    total += 1;
    if (criteria.petsAllowed === application.preferences.pet) {
      score += 1;
    }
  }

  if (criteria.smokingAllowed !== undefined) {
    total += 1;
    if (criteria.smokingAllowed === application.preferences.smoker) {
      score += 1;
    }
  }

  if (criteria.coupleFriendly !== undefined) {
    total += 1;
    if (criteria.coupleFriendly === application.preferences.coupleFriendly) {
      score += 1;
    }
  }

  if (criteria.noOfOccupants && application.propertyPreferences.occupants) {
    total += 1;
    if (criteria.noOfOccupants >= application.propertyPreferences.occupants) {
      score += 1;
    }
  }

  if (criteria.leaseDuration && application.propertyPreferences.leaseDuration) {
    total += 1;
    if (criteria.leaseDuration === application.propertyPreferences.leaseDuration) {
      score += 1;
    }
  }

  if (criteria.moveInDate && application.propertyPreferences.moveInDate) {
    total += 1;
    const diff = Math.abs(new Date(criteria.moveInDate) - new Date(application.propertyPreferences.moveInDate));
    const diffDays = diff / (1000 * 60 * 60 * 24);
    if (diffDays <= 15) score += 1;
  }

  return total > 0 ? Math.round((score / total) * 100) : 0;
};

module.exports = { calculateMatchScore };
