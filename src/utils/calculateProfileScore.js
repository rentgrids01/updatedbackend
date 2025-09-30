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

module.exports = { calculateProfileScore };
