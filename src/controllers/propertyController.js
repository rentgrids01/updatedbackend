const Property = require("../models/Property");
const PropertyTenantCriteria = require("../models/PropertyTenantCriteria");
const Feature = require("../models/Feature");
const Amenity = require("../models/Amenity");
const mongoose = require("mongoose");
const { saveFile, deleteFile } = require("../utils/fileUpload");
const { generatePropertyId } = require("../utils/propertyIdGenerator");
const VisitRequest = require("../models/VisitRequest");

const getFullImageUrl = (imagePath, req) => {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath; // Already full URL
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  return `${baseUrl}${imagePath}`;
};

const processPropertyData = (property, req) => {
  const propertyObj = property.toObject ? property.toObject() : property;

  if (propertyObj.images && propertyObj.images.length > 0) {
    propertyObj.images = propertyObj.images.map((img) =>
      getFullImageUrl(img, req)
    );
  }

  if (propertyObj.documents && propertyObj.documents.length > 0) {
    propertyObj.documents = propertyObj.documents.map((doc) =>
      getFullImageUrl(doc, req)
    );
  }

  if (propertyObj.owner && propertyObj.owner.profilePhoto) {
    propertyObj.owner.profilePhoto = getFullImageUrl(
      propertyObj.owner.profilePhoto,
      req
    );
  }

  if (propertyObj.features && Array.isArray(propertyObj.features)) {
    propertyObj.features = propertyObj.features.map((feature) => {
      // Handle case where feature might be an ObjectId or populated object
      if (typeof feature === "object" && feature._id) {
        return {
          _id: feature._id,
          name: feature.name || "Unknown Feature",
          description: feature.description || "",
          icon: feature.icon ? getFullImageUrl(feature.icon, req) : null,
        };
      }
      return feature;
    });
  }

  if (propertyObj.amenities && Array.isArray(propertyObj.amenities)) {
    propertyObj.amenities = propertyObj.amenities.map((amenity) => {
      // Handle case where amenity might be an ObjectId or populated object
      if (typeof amenity === "object" && amenity._id) {
        return {
          _id: amenity._id,
          name: amenity.name || "Unknown Amenity",
          description: amenity.description || "",
          icon: amenity.icon ? getFullImageUrl(amenity.icon, req) : null,
        };
      }
      return amenity;
    });
  }

  return propertyObj;
};

// Helper function to mask owner's sensitive information for public APIs
const maskOwnerData = (owner) => {
  if (!owner) return null;

  try {
    // Handle both populated owner object and basic owner data
    const fullName = owner.fullName || owner.name || "Property Owner";
    const phoneNumber =
      owner.phonenumber || owner.phone || owner.mobileNumber || "";

    // Create masked name - first letter + *** + last letter (if name has multiple words)
    let maskedName;
    if (fullName.includes(" ")) {
      const nameParts = fullName.trim().split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      maskedName = `${firstName.charAt(0)}***${lastName.charAt(0)}`;
    } else {
      maskedName =
        fullName.length > 3
          ? `${fullName.charAt(0)}***${fullName.slice(-1)}`
          : `${fullName.charAt(0)}***`;
    }

    // Create masked mobile number
    let maskedMobile = "XXX-XXX-XXXX";
    if (phoneNumber && phoneNumber.length >= 6) {
      const cleanNumber = phoneNumber.toString().replace(/\D/g, "");
      if (cleanNumber.length >= 6) {
        maskedMobile = `${cleanNumber.slice(0, 3)}***${cleanNumber.slice(-3)}`;
      }
    }

    return {
      maskName: maskedName,
      mobileMasked: maskedMobile,
      isVerified: owner.isVerified || false,
    };
  } catch (error) {
    console.error("Error in maskOwnerData:", error);
    return {
      maskName: "Property Owner",
      mobileMasked: "XXX-XXX-XXXX",
      isVerified: false,
    };
  }
};

// Get All Properties (Public) - Enhanced with advanced filtering
const getAllProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10, // Changed default to 10
      location,
      localities,
      minBudget,
      maxBudget,
      availability,
      preferredTenants,
      propertyType,
      furnishing,
      parking,
      bhk,
      minArea,
      maxArea,
      propertyAge,
      bathrooms,
      floors,
      showVerified = false,
      sortBy = "createdAt",
      order = "desc",
      status,
    } = req.query;

    const query = { isActive: true };

    // Status filter - allow different status values
    if (status) {
      if (Array.isArray(status)) {
        // If multiple statuses are provided
        query.status = { $in: status };
      } else {
        // Single status filter
        query.status = status;
      }
    } else {
      // Default behavior - show published properties
      query.status = "published";
    }

    // Location filters
    if (location) {
      query.$or = [
        { "location.city": new RegExp(location, "i") },
        { "location.locality": new RegExp(location, "i") },
        { "location.state": new RegExp(location, "i") },
      ];
    }

    if (localities && Array.isArray(localities)) {
      query["location.locality"] = {
        $in: localities.map((loc) => new RegExp(loc, "i")),
      };
    }

    // Budget filters
    if (minBudget || maxBudget) {
      query.monthlyRent = {};
      if (minBudget) query.monthlyRent.$gte = parseInt(minBudget);
      if (maxBudget) query.monthlyRent.$lte = parseInt(maxBudget);
    }

    // Availability filter
    if (availability) {
      const now = new Date();
      switch (availability) {
        case "immediate":
          query.availableFrom = { $lte: now };
          break;
        case "within_15_days":
          query.availableFrom = {
            $gte: now,
            $lte: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
          };
          break;
        case "after_30_days":
          query.availableFrom = {
            $gte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          };
          break;
      }
    }

    // Preferred tenants filter
    if (preferredTenants) {
      const tenantMap = {
        family: "Family",
        bachelor_male: "Bachelor Male",
        bachelor_female: "Bachelor Female",
        company: "Anyone", // Assuming company can be mapped to Anyone
        student: "Anyone", // Assuming student can be mapped to Anyone
      };
      query.availableFor = tenantMap[preferredTenants] || preferredTenants;
    }

    // Property type filter
    if (propertyType) {
      const typeMap = {
        independent_house: "house",
      };
      query.propertyType = typeMap[propertyType] || propertyType;
    }

    // Furnishing filter
    if (furnishing) {
      const furnishMap = {
        full: "furnished",
        semi: "semi-furnished",
        none: "unfurnished",
      };
      query.furnishType = furnishMap[furnishing] || furnishing;
    }

    // Parking filter - using the new parking field
    if (parking) {
      if (parking === "2wheeler" || parking === "4wheeler") {
        query.parking = {
          $regex:
            parking === "2wheeler"
              ? /bike|two.?wheeler|scooter/i
              : /car|four.?wheeler|vehicle/i,
        };
      }
    }

    // BHK filter
    if (bhk) {
      query.bhk = `${bhk}BHK`;
    }

    // Area filters
    if (minArea || maxArea) {
      query.area = {};
      if (minArea) query.area.$gte = parseInt(minArea);
      if (maxArea) query.area.$lte = parseInt(maxArea);
    }

    // Property age filter
    if (propertyAge) {
      const ageQueries = {
        lt1: /less than 1 year|under 1 year|new|0.*year/i,
        lt5: /[1-4].*year|less than 5 year/i,
        lt10: /[5-9].*year|less than 10 year/i,
      };
      if (ageQueries[propertyAge]) {
        query.ageOfBuilding = { $regex: ageQueries[propertyAge] };
      }
    }

    // Bathrooms filter
    if (bathrooms) {
      query.bathroom = { $gte: parseInt(bathrooms) };
    }

    // Floors filter
    if (floors) {
      switch (floors) {
        case "ground":
          query.floorNo = 0;
          break;
        case "1st":
          query.floorNo = 1;
          break;
        case "custom":
          // Can be extended for custom floor filtering
          break;
      }
    }

    // Show verified filter (placeholder - can be extended)
    if (showVerified === "true") {
      // Add verification logic here
      query.isVerified = true; // Assuming there's an isVerified field
    }

    const sortOrder = order === "desc" ? -1 : 1;
    const sort = {};
    sort[sortBy] = sortOrder;

    const maxLimit = Math.min(parseInt(limit), 20); // Max 20 per page

    const properties = await Property.find(query)
      .populate({
        path: "owner",
        select: "fullName emailId phonenumber profilePhoto isVerified",
        options: { strictPopulate: false },
      })
      .populate("features", "name description icon")
      .populate("amenities", "name description icon")
      .sort(sort)
      .limit(maxLimit)
      .skip((page - 1) * maxLimit);

    const total = await Property.countDocuments(query);

    // Process properties with masked owner data and full URLs
    const processedProperties = properties.map((property) => {
      const propertyObj = processPropertyData(property, req);

      // Always provide owner data, even if not populated properly
      if (propertyObj.owner) {
        propertyObj.owner = maskOwnerData(propertyObj.owner);
      } else {
        // Provide default masked owner data if owner is not populated
        propertyObj.owner = {
          maskName: "Property Owner",
          mobileMasked: "Contact for details",
          isVerified: false,
        };
      }

      return propertyObj;
    });

    res.json({
      success: true,
      data: {
        properties: processedProperties,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / maxLimit),
          hasNext: page * maxLimit < total,
          hasPrev: page > 1,
          totalResults: total,
          perPage: maxLimit,
        },
        filters: {
          appliedFilters: {
            location,
            localities,
            minBudget,
            maxBudget,
            availability,
            preferredTenants,
            propertyType,
            furnishing,
            parking,
            bhk,
            minArea,
            maxArea,
            propertyAge,
            bathrooms,
            floors,
            showVerified,
            status,
            sortBy,
            order,
          },
          totalFiltered: total,
          page: parseInt(page),
          limit: maxLimit,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Property by ID (Public)
const getPropertyById = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const property = await Property.findById(propertyId)
      .populate({
        path: "owner",
        select: "fullName emailId phonenumber profilePhoto isVerified",
        options: { strictPopulate: false },
      })
      .populate("features", "name description icon")
      .populate("amenities", "name description icon");

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    // Get tenant criteria
    const tenantCriteria = await PropertyTenantCriteria.findOne({
      property: propertyId,
    });

    // Increment view count
    property.views += 1;
    await property.save();

    // Process property data to include full URLs
    const processedProperty = processPropertyData(property, req);

    // Always provide owner data, even if not populated properly
    if (processedProperty.owner) {
      processedProperty.owner = maskOwnerData(processedProperty.owner);
    } else {
      // Provide default masked owner data if owner is not populated
      processedProperty.owner = {
        maskName: "Property Owner",
        mobileMasked: "Contact for details",
        isVerified: false,
      };
    }

    res.json({
      success: true,
      data: {
        ...processedProperty,
        tenantCriteria,
        viewCount: property.views,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Similar Properties (Public)
const getSimilarProperties = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { limit = 3, status = "published" } = req.query;

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    // Build status query
    const statusQuery = {};
    if (status && status !== "all") {
      statusQuery.status = status;
    }

    // Enhanced similarity logic
    const similarProperties = await Property.find({
      _id: { $ne: propertyId },
      $or: [
        {
          // Same city and bhk
          "location.city": property.location.city,
          bhk: property.bhk,
          monthlyRent: {
            $gte: property.monthlyRent * 0.7,
            $lte: property.monthlyRent * 1.3,
          },
        },
        {
          // Same locality with different bhk but similar price
          "location.locality": property.location.locality,
          monthlyRent: {
            $gte: property.monthlyRent * 0.8,
            $lte: property.monthlyRent * 1.2,
          },
        },
        {
          // Same property type and furnishing
          "location.city": property.location.city,
          propertyType: property.propertyType,
          furnishType: property.furnishType,
          monthlyRent: {
            $gte: property.monthlyRent * 0.6,
            $lte: property.monthlyRent * 1.4,
          },
        },
      ],
      ...statusQuery,
      isActive: true,
    })
      .populate({
        path: "owner",
        select: "fullName phonenumber isVerified",
        options: { strictPopulate: false },
      })
      .populate("features", "name icon")
      .populate("amenities", "name icon")
      .limit(parseInt(limit))
      .sort({ views: -1, createdAt: -1 }); // Sort by popularity and recency

    // Process similar properties to include full URLs and mask owner data
    const processedSimilarProperties = similarProperties.map((prop) => {
      const processedProp = processPropertyData(prop, req);

      // Always provide owner data, even if not populated properly
      if (processedProp.owner) {
        processedProp.owner = maskOwnerData(processedProp.owner);
      } else {
        // Provide default masked owner data if owner is not populated
        processedProp.owner = {
          maskName: "Property Owner",
          mobileMasked: "Contact for details",
          isVerified: false,
        };
      }

      return processedProp;
    });

    res.json({
      success: true,
      data: {
        similarProperties: processedSimilarProperties,
        count: processedSimilarProperties.length,
        basedOn: {
          city: property.location.city,
          locality: property.location.locality,
          bhk: property.bhk,
          priceRange: `₹${property.monthlyRent * 0.7} - ₹${
            property.monthlyRent * 1.3
          }`,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Owner Properties
const getOwnerProperties = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const query = { owner: req.user._id };
    if (status) {
      query.status = status;
    }

    const properties = await Property.find(query)
      .populate("features", "name description icon")
      .populate("amenities", "name description icon")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Property.countDocuments(query);

    const propertyIds = properties.map((p) => p._id);

    const visitRequestsCount = await VisitRequest.aggregate([
      {
        $match: {
          property: {
            $in: propertyIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        },
      },
      {
        $group: {
          _id: "$property",
          count: { $sum: 1 },
        },
      },
    ]);

    const visitCountMap = {};
    visitRequestsCount.forEach((item) => {
      visitCountMap[item._id.toString()] = item.count;
    });

    const processedProperties = properties.map((property) => {
      const propObj = processPropertyData(property, req);
      propObj.applicationCount = visitCountMap[property._id.toString()] || 0;
      return propObj;
    });

    res.json({
      success: true,
      data: {
        properties: processedProperties,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          hasNext: page * limit < total,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create Property
const createProperty = async (req, res) => {
  try {
    let propertyData = req.body;

    // --- Parse location if it's sent as string ---
    if (propertyData.location && typeof propertyData.location === "string") {
      try {
        propertyData.location = JSON.parse(propertyData.location);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Invalid location JSON format",
        });
      }
    }

    // --- Parse landlordSchedule if sent as JSON string ---
    if (
      propertyData.landlordSchedule &&
      typeof propertyData.landlordSchedule === "string"
    ) {
      try {
        propertyData.landlordSchedule = JSON.parse(
          propertyData.landlordSchedule
        );
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Invalid landlordSchedule JSON format",
        });
      }
    }

    // --- Convert numeric fields ---
    const numericFields = [
      "monthlyRent",
      "securityDeposit",
      "areaUnit",
      "bedroom",
      "bathroom",
      "floor",
    ];
    numericFields.forEach((field) => {
      if (propertyData[field]) {
        propertyData[field] = Number(propertyData[field]);
      }
    });

    // --- Parse array-like fields (features, amenities, nearbyPlaces) ---
    const parseArrayField = (value) => {
      if (!value) return [];
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          return value
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v);
        }
      }
      return Array.isArray(value) ? value : [];
    };

    propertyData.features = parseArrayField(propertyData.features);
    propertyData.amenities = parseArrayField(propertyData.amenities);
    propertyData.nearbyPlaces = parseArrayField(propertyData.nearbyPlaces);

    propertyData.owner = req.user._id;
    propertyData.createdAt = new Date();
    propertyData.updatedAt = new Date();

    // --- Create the property ---
    const newProperty = await Property.create(propertyData);

    // Populate the property with related data and process URLs
    const populatedProperty = await Property.findById(newProperty._id).populate(
      [
        { path: "features", select: "name description icon" },
        { path: "amenities", select: "name description icon" },
        { path: "owner", select: "fullName emailId phonenumber profilePhoto" },
      ]
    );

    const processedProperty = processPropertyData(populatedProperty, req);

    console.log("Property created with images:", processedProperty.images);

    res.status(201).json({
      success: true,
      message: "Property created successfully",
      data: processedProperty,
    });
  } catch (error) {
    console.error("Error creating property:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server Error",
    });
  }
};

// Update Property
const updateProperty = async (req, res) => {
  try {
    const { propertyId } = req.params; // property _id or custom propertyId
    let updateData = req.body;

    // --- Parse landlordSchedule if sent as string ---
    if (
      updateData.landlordSchedule &&
      typeof updateData.landlordSchedule === "string"
    ) {
      try {
        updateData.landlordSchedule = JSON.parse(updateData.landlordSchedule);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Invalid landlordSchedule JSON format",
        });
      }
    }

    // --- Parse location if sent as JSON string ---
    if (updateData.location && typeof updateData.location === "string") {
      try {
        updateData.location = JSON.parse(updateData.location);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Invalid location JSON format",
        });
      }
    }

    // --- Convert numeric fields ---
    const numericFields = [
      "monthlyRent",
      "securityDeposit",
      "areaUnit",
      "bedroom",
      "bathroom",
      "floor",
    ];
    numericFields.forEach((field) => {
      if (updateData[field]) {
        updateData[field] = Number(updateData[field]);
      }
    });

    // --- Parse array-like fields (features, amenities, nearbyPlaces) ---
    const parseArrayField = (value) => {
      if (!value) return [];
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          return value
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v);
        }
      }
      return Array.isArray(value) ? value : [];
    };

    if (updateData.features) {
      updateData.features = parseArrayField(updateData.features).filter((id) =>
        /^[0-9a-fA-F]{24}$/.test(id)
      );
    }

    if (updateData.amenities) {
      updateData.amenities = parseArrayField(updateData.amenities).filter(
        (id) => /^[0-9a-fA-F]{24}$/.test(id)
      );
    }

    if (updateData.nearbyPlaces) {
      updateData.nearbyPlaces = parseArrayField(updateData.nearbyPlaces);
    }

    updateData.updatedAt = new Date();

    // --- Update property ---
    const updatedProperty = await Property.findByIdAndUpdate(
      propertyId,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    ).populate([
      { path: "features", select: "name description icon" },
      { path: "amenities", select: "name description icon" },
      { path: "owner", select: "fullName emailId phonenumber profilePhoto" },
    ]);

    if (!updatedProperty) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const processedProperty = processPropertyData(updatedProperty, req);

    res.status(200).json({
      success: true,
      message: "Property updated successfully",
      data: processedProperty,
    });
  } catch (error) {
    console.error("Error updating property:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server Error",
    });
  }
};

// Update Property Status
const updatePropertyStatus = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { status } = req.body;

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    property.status = status;
    property.updatedAt = new Date();
    await property.save();

    res.json({
      success: true,
      message: "Property status updated successfully",
      data: { status: property.status },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete Property
const deleteProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    await Property.findByIdAndDelete(propertyId);

    res.json({
      success: true,
      message: "Property deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const uploadPropertyImages = async (req, res) => {
  try {
    const { propertyId } = req.params;

    console.log("Upload request received for property:", propertyId);
    console.log("Files received:", req.files ? req.files.length : 0);

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID format",
      });
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message:
          "Unauthorized - You can only upload images to your own properties",
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No images uploaded",
      });
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const maxSize = 10 * 1024 * 1024; // 10MB

    for (const file of req.files) {
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: `Invalid file type: ${file.originalname}. Only JPEG, PNG, and WebP images are allowed.`,
        });
      }

      if (file.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: `File too large: ${file.originalname}. Maximum size is 10MB.`,
        });
      }
    }

    const imageUrls = [];
    const failedUploads = [];

    for (const file of req.files) {
      try {
        console.log(
          "Processing file:",
          file.originalname,
          "Size:",
          file.size,
          "Type:",
          file.mimetype
        );

        const result = await saveFile(
          file.buffer,
          "property_images",
          file.originalname
        );

        console.log("File saved successfully:", result.url);
        imageUrls.push(result.url);
      } catch (fileError) {
        console.error(
          "Failed to save file:",
          file.originalname,
          fileError.message
        );
        failedUploads.push({
          filename: file.originalname,
          error: fileError.message,
        });
      }
    }

    if (imageUrls.length === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to save any images",
        failedUploads: failedUploads,
      });
    }

    if (!property.images) {
      property.images = [];
    }

    property.images.push(...imageUrls);
    property.updatedAt = new Date();

    await property.save();

    const fullImageUrls = imageUrls.map((url) => getFullImageUrl(url, req));

    const responseData = {
      success: true,
      message: `${imageUrls.length} image(s) uploaded successfully`,
      data: {
        uploadedImages: fullImageUrls,
        totalImages: property.images.length,
        propertyId: property._id,
      },
    };

    if (failedUploads.length > 0) {
      responseData.warnings = {
        message: `${failedUploads.length} file(s) failed to upload`,
        failedUploads: failedUploads,
      };
    }

    res.json(responseData);
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during image upload",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const deletePropertyImage = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: "Image URL is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID format",
      });
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message:
          "Unauthorized - You can only delete images from your own properties",
      });
    }

    let relativeUrl = imageUrl;
    if (imageUrl.startsWith("http")) {
      const urlParts = imageUrl.split("/uploads/");
      if (urlParts.length > 1) {
        relativeUrl = "/uploads/" + urlParts[1];
      }
    }

    const initialLength = property.images.length;
    const imageExists = property.images.some(
      (img) => img === relativeUrl || img === imageUrl
    );

    if (!imageExists) {
      return res.status(404).json({
        success: false,
        message: "Image not found in property",
        availableImages: property.images.length,
      });
    }

    property.images = property.images.filter(
      (img) => img !== relativeUrl && img !== imageUrl
    );

    property.updatedAt = new Date();
    await property.save();

    let fileDeleted = false;
    try {
      const deleteResult = await deleteFile(relativeUrl);
      fileDeleted = deleteResult.success;
      if (!fileDeleted) {
        console.warn(
          "Physical file not found or already deleted:",
          relativeUrl
        );
      }
    } catch (error) {
      console.warn(
        "Failed to delete physical file:",
        relativeUrl,
        error.message
      );
    }

    console.log(`Image removed from property ${propertyId}:`, relativeUrl);

    res.json({
      success: true,
      message: "Image deleted successfully",
      data: {
        deletedImageUrl: relativeUrl,
        physicalFileDeleted: fileDeleted,
        remainingImages: property.images.length,
        propertyId: property._id,
      },
    });
  } catch (error) {
    console.error("Delete image error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during image deletion",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Upload Property Documents
const uploadPropertyDocuments = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No documents uploaded",
      });
    }

    const documentUrls = [];
    for (const file of req.files) {
      const result = await saveFile(
        file.buffer,
        "property_documents",
        file.originalname
      );
      documentUrls.push(result.url);
    }

    property.documents.push(...documentUrls);
    await property.save();

    // Process URLs to full URLs
    const fullDocumentUrls = documentUrls.map((url) =>
      getFullImageUrl(url, req)
    );

    res.json({
      success: true,
      message: "Documents uploaded successfully",
      documentUrls: fullDocumentUrls,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete Property Document
const deletePropertyDocument = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { docUrl } = req.body;

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    property.documents = property.documents.filter((doc) => doc !== docUrl);
    await property.save();

    res.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getAllProperties,
  getPropertyById,
  getSimilarProperties,
  getOwnerProperties,
  createProperty,
  updateProperty,
  updatePropertyStatus,
  deleteProperty,
  uploadPropertyImages,
  deletePropertyImage,
  uploadPropertyDocuments,
  deletePropertyDocument,
};
