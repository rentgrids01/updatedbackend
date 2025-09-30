const Property = require('../models/Property');
const PropertyTenantCriteria = require('../models/PropertyTenantCriteria');
const Feature = require('../models/Feature');
const Amenity = require('../models/Amenity');
const { saveFile, deleteFile } = require('../utils/fileUpload');
const { generatePropertyId } = require('../utils/propertyIdGenerator');

// Helper function to convert relative URLs to full URLs
const getFullImageUrl = (imagePath, req) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http')) return imagePath; // Already full URL
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}${imagePath}`;
};

// Helper function to process property data with full URLs
const processPropertyData = (property, req) => {
  const propertyObj = property.toObject ? property.toObject() : property;
  
  if (propertyObj.images && propertyObj.images.length > 0) {
    propertyObj.images = propertyObj.images.map(img => getFullImageUrl(img, req));
  }
  
  if (propertyObj.documents && propertyObj.documents.length > 0) {
    propertyObj.documents = propertyObj.documents.map(doc => getFullImageUrl(doc, req));
  }
  
  if (propertyObj.owner && propertyObj.owner.profilePhoto) {
    propertyObj.owner.profilePhoto = getFullImageUrl(propertyObj.owner.profilePhoto, req);
  }
  
  if (propertyObj.features && Array.isArray(propertyObj.features)) {
    propertyObj.features = propertyObj.features.map(feature => {
      // Handle case where feature might be an ObjectId or populated object
      if (typeof feature === 'object' && feature._id) {
        return {
          _id: feature._id,
          name: feature.name || 'Unknown Feature',
          description: feature.description || '',
          icon: feature.icon ? getFullImageUrl(feature.icon, req) : null
        };
      }
      return feature;
    });
  }
  
  if (propertyObj.amenities && Array.isArray(propertyObj.amenities)) {
    propertyObj.amenities = propertyObj.amenities.map(amenity => {
      // Handle case where amenity might be an ObjectId or populated object
      if (typeof amenity === 'object' && amenity._id) {
        return {
          _id: amenity._id,
          name: amenity.name || 'Unknown Amenity',
          description: amenity.description || '',
          icon: amenity.icon ? getFullImageUrl(amenity.icon, req) : null
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
    const fullName = owner.fullName || owner.name || 'Property Owner';
    const phoneNumber = owner.phonenumber || owner.phone || owner.mobileNumber || '';
    
    // Create masked name - first letter + *** + last letter (if name has multiple words)
    let maskedName;
    if (fullName.includes(' ')) {
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      maskedName = `${firstName.charAt(0)}***${lastName.charAt(0)}`;
    } else {
      maskedName = fullName.length > 3 ? `${fullName.charAt(0)}***${fullName.slice(-1)}` : `${fullName.charAt(0)}***`;
    }
    
    // Create masked mobile number
    let maskedMobile = 'XXX-XXX-XXXX';
    if (phoneNumber && phoneNumber.length >= 6) {
      const cleanNumber = phoneNumber.toString().replace(/\D/g, '');
      if (cleanNumber.length >= 6) {
        maskedMobile = `${cleanNumber.slice(0, 3)}***${cleanNumber.slice(-3)}`;
      }
    }
    
    return {
      maskName: maskedName,
      mobileMasked: maskedMobile,
      isVerified: owner.isVerified || false
    };
  } catch (error) {
    console.error('Error in maskOwnerData:', error);
    return {
      maskName: 'Property Owner',
      mobileMasked: 'XXX-XXX-XXXX',
      isVerified: false
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
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    const query = { status: 'published', isActive: true };

    // Location filters
    if (location) {
      query.$or = [
        { 'location.city': new RegExp(location, 'i') },
        { 'location.locality': new RegExp(location, 'i') },
        { 'location.state': new RegExp(location, 'i') }
      ];
    }

    if (localities && Array.isArray(localities)) {
      query['location.locality'] = { $in: localities.map(loc => new RegExp(loc, 'i')) };
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
        case 'immediate':
          query.availableFrom = { $lte: now };
          break;
        case 'within_15_days':
          query.availableFrom = { 
            $gte: now, 
            $lte: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000) 
          };
          break;
        case 'after_30_days':
          query.availableFrom = { 
            $gte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) 
          };
          break;
      }
    }

    // Preferred tenants filter
    if (preferredTenants) {
      const tenantMap = {
        'family': 'Family',
        'bachelor_male': 'Bachelor Male',
        'bachelor_female': 'Bachelor Female',
        'company': 'Anyone', // Assuming company can be mapped to Anyone
        'student': 'Anyone'   // Assuming student can be mapped to Anyone
      };
      query.availableFor = tenantMap[preferredTenants] || preferredTenants;
    }

    // Property type filter
    if (propertyType) {
      const typeMap = {
        'independent_house': 'house'
      };
      query.propertyType = typeMap[propertyType] || propertyType;
    }

    // Furnishing filter
    if (furnishing) {
      const furnishMap = {
        'full': 'furnished',
        'semi': 'semi-furnished',
        'none': 'unfurnished'
      };
      query.furnishType = furnishMap[furnishing] || furnishing;
    }

    // Parking filter - using the new parking field
    if (parking) {
      if (parking === '2wheeler' || parking === '4wheeler') {
        query.parking = { $regex: parking === '2wheeler' ? /bike|two.?wheeler|scooter/i : /car|four.?wheeler|vehicle/i };
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
        'lt1': /less than 1 year|under 1 year|new|0.*year/i,
        'lt5': /[1-4].*year|less than 5 year/i,
        'lt10': /[5-9].*year|less than 10 year/i
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
        case 'ground':
          query.floorNo = 0;
          break;
        case '1st':
          query.floorNo = 1;
          break;
        case 'custom':
          // Can be extended for custom floor filtering
          break;
      }
    }

    // Show verified filter (placeholder - can be extended)
    if (showVerified === 'true') {
      // Add verification logic here
      query.isVerified = true; // Assuming there's an isVerified field
    }

    const sortOrder = order === 'desc' ? -1 : 1;
    const sort = {};
    sort[sortBy] = sortOrder;

    const maxLimit = Math.min(parseInt(limit), 20); // Max 20 per page

    const properties = await Property.find(query)
      .populate({
        path: 'owner',
        select: 'fullName emailId phonenumber profilePhoto isVerified',
        options: { strictPopulate: false }
      })
      .populate('features', 'name description icon')
      .populate('amenities', 'name description icon')
      .sort(sort)
      .limit(maxLimit)
      .skip((page - 1) * maxLimit);

    const total = await Property.countDocuments(query);

    // Process properties with masked owner data and full URLs
    const processedProperties = properties.map(property => {
      const propertyObj = processPropertyData(property, req);
      
      // Always provide owner data, even if not populated properly
      if (propertyObj.owner) {
        propertyObj.owner = maskOwnerData(propertyObj.owner);
      } else {
        // Provide default masked owner data if owner is not populated
        propertyObj.owner = {
          maskName: 'Property Owner',
          mobileMasked: 'Contact for details',
          isVerified: false
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
          perPage: maxLimit
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
            sortBy,
            order
          },
          totalFiltered: total,
          page: parseInt(page),
          limit: maxLimit
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Property by ID (Public)
const getPropertyById = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const property = await Property.findById(propertyId)
      .populate({
        path: 'owner',
        select: 'fullName emailId phonenumber profilePhoto isVerified',
        options: { strictPopulate: false }
      })
      .populate('features', 'name description icon')
      .populate('amenities', 'name description icon');

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Get tenant criteria
    const tenantCriteria = await PropertyTenantCriteria.findOne({ property: propertyId });

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
        maskName: 'Property Owner',
        mobileMasked: 'Contact for details',
        isVerified: false
      };
    }

    res.json({
      success: true,
      data: {
        ...processedProperty,
        tenantCriteria,
        viewCount: property.views
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Similar Properties (Public)
const getSimilarProperties = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { limit = 3 } = req.query;

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Enhanced similarity logic
    const similarProperties = await Property.find({
      _id: { $ne: propertyId },
      $or: [
        {
          // Same city and bhk
          'location.city': property.location.city,
          bhk: property.bhk,
          monthlyRent: {
            $gte: property.monthlyRent * 0.7,
            $lte: property.monthlyRent * 1.3
          }
        },
        {
          // Same locality with different bhk but similar price
          'location.locality': property.location.locality,
          monthlyRent: {
            $gte: property.monthlyRent * 0.8,
            $lte: property.monthlyRent * 1.2
          }
        },
        {
          // Same property type and furnishing
          'location.city': property.location.city,
          propertyType: property.propertyType,
          furnishType: property.furnishType,
          monthlyRent: {
            $gte: property.monthlyRent * 0.6,
            $lte: property.monthlyRent * 1.4
          }
        }
      ],
      status: 'published',
      isActive: true
    })
      .populate({
        path: 'owner',
        select: 'fullName phonenumber isVerified',
        options: { strictPopulate: false }
      })
      .populate('features', 'name icon')
      .populate('amenities', 'name icon')
      .limit(parseInt(limit))
      .sort({ views: -1, createdAt: -1 }); // Sort by popularity and recency

    // Process similar properties to include full URLs and mask owner data
    const processedSimilarProperties = similarProperties.map(prop => {
      const processedProp = processPropertyData(prop, req);
      
      // Always provide owner data, even if not populated properly
      if (processedProp.owner) {
        processedProp.owner = maskOwnerData(processedProp.owner);
      } else {
        // Provide default masked owner data if owner is not populated
        processedProp.owner = {
          maskName: 'Property Owner',
          mobileMasked: 'Contact for details',
          isVerified: false
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
          priceRange: `₹${property.monthlyRent * 0.7} - ₹${property.monthlyRent * 1.3}`
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
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
      .populate('features', 'name description icon')
      .populate('amenities', 'name description icon')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Property.countDocuments(query);

    // Process properties to include full URLs
    const processedProperties = properties.map(property => processPropertyData(property, req));

    res.json({
      success: true,
      data: {
        properties: processedProperties,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          hasNext: page * limit < total
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create Property
  const createProperty = async (req, res) => {
    try {
      const propertyData = req.body;

      if (req.body.landlordSchedule && typeof req.body.landlordSchedule === "string") {
        try {
          req.body.landlordSchedule = JSON.parse(req.body.landlordSchedule);
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: "Invalid landlordSchedule JSON format",
          });
        }
      }

      // Handle coordinates if provided
      let coordinates = {};
      if (propertyData.latitude && propertyData.longitude) {
        coordinates = {
          latitude: parseFloat(propertyData.latitude),
          longitude: parseFloat(propertyData.longitude),
        };
      }

      // Set up location object for the nested location field (if still needed for queries)
      propertyData.location = {
        city: propertyData.city,
        state: propertyData.state,
        locality: propertyData.locality,
        landmark: propertyData.landmark || "",
        zipcode: propertyData.zipcode || "",
        fullAddress: propertyData.fullAddress,
        coordinates,
      };

      // Remove the coordinate fields from the main propertyData since they're now in location.coordinates
      delete propertyData.latitude;
      delete propertyData.longitude;

      // Handle features and amenities arrays if they come as comma-separated strings
      if (propertyData.features) {
        if (typeof propertyData.features === 'string') {
          propertyData.features = propertyData.features.split(',').map(f => f.trim()).filter(f => f);
        }
        // Validate ObjectIds and filter out invalid ones
        propertyData.features = propertyData.features.filter(id => {
          if (typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/)) {
            return true;
          }
          return false;
        });
      }

      if (propertyData.amenities) {
        if (typeof propertyData.amenities === 'string') {
          propertyData.amenities = propertyData.amenities.split(',').map(a => a.trim()).filter(a => a);
        }
        // Validate ObjectIds and filter out invalid ones
        propertyData.amenities = propertyData.amenities.filter(id => {
          if (typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/)) {
            return true;
          }
          return false;
        });
      }

      // Handle nearbyPlaces if they come as comma-separated strings
      if (typeof propertyData.nearbyPlaces === 'string') {
        propertyData.nearbyPlaces = propertyData.nearbyPlaces.split(',').map(p => p.trim());
      }

      propertyData.owner = req.user._id;

      const imageUrls = [];
      const documentUrls = [];

      if (req.files) {
        if (req.files.images) {
          for (const file of req.files.images) {
            try {
              const result = await saveFile(file.buffer, "property_images", file.originalname);
              imageUrls.push(result.url);
            } catch (error) {
              console.error("Image upload failed:", error.message);
            }
          }
        }

        if (req.files.documents) {
          for (const file of req.files.documents) {
            try {
              const result = await saveFile(file.buffer, "property_documents", file.originalname);
              documentUrls.push(result.url);
            } catch (error) {
              console.error("Document upload failed:", error.message);
            }
          }
        }
      }

      propertyData.images = imageUrls;
      propertyData.documents = documentUrls;

      // Remove tenantCriteria from propertyData before creating property
      delete propertyData.tenantCriteria;

      const property = await Property.create(propertyData);

      // Populate the created property with features and amenities
      await property.populate([
        { path: 'features', select: 'name description icon' },
        { path: 'amenities', select: 'name description icon' },
        { path: 'owner', select: 'fullName emailId phonenumber profilePhoto' }
      ]);

      // Process property data to include full URLs
      const processedProperty = processPropertyData(property, req);

      res.status(201).json({
        success: true,
        message: "Property created successfully",
        data: processedProperty,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };


// Update Property
const updateProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const updateData = req.body;

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    updateData.updatedAt = new Date();

    const updatedProperty = await Property.findByIdAndUpdate(
      propertyId,
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'features', select: 'name description icon' },
      { path: 'amenities', select: 'name description icon' },
      { path: 'owner', select: 'fullName emailId phonenumber profilePhoto' }
    ]);

    // Process property data to include full URLs
    const processedProperty = processPropertyData(updatedProperty, req);

    res.json({
      success: true,
      message: 'Property updated successfully',
      data: processedProperty
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
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
        message: 'Property not found'
      });
    }

    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    property.status = status;
    property.updatedAt = new Date();
    await property.save();

    res.json({
      success: true,
      message: 'Property status updated successfully',
      data: { status: property.status }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
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
        message: 'Property not found'
      });
    }

    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    await Property.findByIdAndDelete(propertyId);

    res.json({
      success: true,
      message: 'Property deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Upload Property Images
const uploadPropertyImages = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images uploaded'
      });
    }

    const imageUrls = [];
    for (const file of req.files) {
      const result = await saveFile(
        file.buffer,
        'property_images',
        file.originalname
      );
      imageUrls.push(result.url);
    }

    property.images.push(...imageUrls);
    await property.save();

    // Process URLs to full URLs
    const fullImageUrls = imageUrls.map(url => getFullImageUrl(url, req));

    res.json({
      success: true,
      message: 'Images uploaded successfully',
      imageUrls: fullImageUrls
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete Property Image
const deletePropertyImage = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { imageUrl } = req.body;

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    property.images = property.images.filter(img => img !== imageUrl);
    await property.save();

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
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
        message: 'Property not found'
      });
    }

    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No documents uploaded'
      });
    }

    const documentUrls = [];
    for (const file of req.files) {
      const result = await saveFile(
        file.buffer,
        'property_documents',
        file.originalname
      );
      documentUrls.push(result.url);
    }

    property.documents.push(...documentUrls);
    await property.save();

    // Process URLs to full URLs
    const fullDocumentUrls = documentUrls.map(url => getFullImageUrl(url, req));

    res.json({
      success: true,
      message: 'Documents uploaded successfully',
      documentUrls: fullDocumentUrls
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
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
        message: 'Property not found'
      });
    }

    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    property.documents = property.documents.filter(doc => doc !== docUrl);
    await property.save();

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
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
  deletePropertyDocument
};