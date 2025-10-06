const calculateProfileScore = (tenant) => {
  const fields = [
    "fullName",
    "emailId",
    "phonenumber",
    "dob",
    "gender",
    "profilePhoto",
  ];

  let filled = 0;

  fields.forEach((field) => {
    if (tenant[field] !== undefined && tenant[field] !== null && tenant[field] !== "") {
      filled++;
    }
  });

  const score = Math.round((filled / fields.length) * 100);
  return score;
};

const calculateProfileScoreOwner = (owner) => {
  const fields = [
    "fullName",
    "emailId",
    "phonenumber",
    "dob",
    "gender",
    "profilePhoto",
    "companyName",
    "gstNumber",
    "panCard",
    "aadhaarCard",
    "address",
  ];

  let filled = 0;

  fields.forEach((field) => {
    if (owner[field] !== undefined && owner[field] !== null && owner[field] !== "") {
      filled++;
    }
  });

  if (Array.isArray(owner.documents) && owner.documents.length > 0) {
    filled++;
  }

  const total = fields.length + 1; // +1 for documents
  const score = Math.round((filled / total) * 100);
  return score;
};

module.exports = { calculateProfileScore, calculateProfileScoreOwner };
