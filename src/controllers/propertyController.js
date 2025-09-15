const Property = require('../models/Property');
const PropertyTenantCriteria = require('../models/PropertyTenantCriteria');
const Feature = require('../models/Feature');
const Amenity = require('../models/Amenity');
const { saveFile, deleteFile } = require('../utils/fileUpload');
const { generatePropertyId } = require('../utils/propertyIdGenerator');

// Get All Properties (Public)
const getAllProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      city,
      minBudget,
      maxBudget,
      bhk,
      furnishType,
      propertyType,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    const query = { status: 'published', isActive: true };

    // Apply filters
    if (city) {
      query['location.city'] = new RegExp(city, 'i');
    }
    if (minBudget || maxBudget) {
      query.monthlyRent = {};
      if (minBudget) query.monthlyRent.$gte = parseInt(minBudget);
      if (maxBudget) query.monthlyRent.$lte = parseInt(maxBudget);
    }
    if (bhk) {
      query.bhk = bhk;
    }
    if (furnishType) {
      query.furnishType = furnishType;
    }
    if (propertyType) {
      query.propertyType = propertyType;
    }

    const sortOrder = order === 'desc' ? -1 : 1;
    const sort = {};
    sort[sortBy] = sortOrder;

    const properties = await Property.find(query)
      .populate('owner', 'fullName emailId phonenumber profilePhoto')
      .populate('features', 'name icon')
      .populate('amenities', 'name icon')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Property.countDocuments(query);

    res.json({
      success: true,
      data: {
        properties,
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

// Get Property by ID
const getPropertyById = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const property = await Property.findById(propertyId)
      .populate('owner', 'fullName emailId phonenumber profilePhoto')
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

    res.json({
      success: true,
      data: {
        ...property.toObject(),
        tenantCriteria
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Similar Properties
const getSimilarProperties = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const similarProperties = await Property.find({
      _id: { $ne: propertyId },
      'location.city': property.location.city,
      bhk: property.bhk,
      monthlyRent: {
        $gte: property.monthlyRent * 0.8,
        $lte: property.monthlyRent * 1.2
      },
      status: 'published',
      isActive: true
    })
      .populate('owner', 'fullName')
      .limit(5);

    res.json({
      success: true,
      data: similarProperties
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
      .populate('features', 'name icon')
      .populate('amenities', 'name icon')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Property.countDocuments(query);

    res.json({
      success: true,
      data: {
        properties,
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

    // Generate unique property ID
    let uniqueId;
    let isUnique = false;
    while (!isUnique) {
      uniqueId = generatePropertyId();
      const existing = await Property.findOne({ uniqueId });
      if (!existing) {
        isUnique = true;
      }
    }

    propertyData.uniqueId = uniqueId;

    // Handle location coordinates
    if (propertyData.latitude && propertyData.longitude) {
      propertyData.location = {
        ...propertyData.location,
        coordinates: {
          latitude: parseFloat(propertyData.latitude),
          longitude: parseFloat(propertyData.longitude)
        }
      };
    }

    // Set location object
    propertyData.location = {
      city: propertyData.city,
      state: propertyData.state,
      locality: propertyData.locality,
      landmark: propertyData.landmark,
      zipcode: propertyData.zipcode,
      fullAddress: propertyData.fullAddress,
      coordinates: propertyData.location?.coordinates || {}
    };

    // Clean up individual location fields
    delete propertyData.city;
    delete propertyData.state;
    delete propertyData.locality;
    delete propertyData.landmark;
    delete propertyData.zipcode;
    delete propertyData.fullAddress;
    delete propertyData.latitude;
    delete propertyData.longitude;

    propertyData.owner = req.user._id;

    // Handle file uploads
    let imageUrls = [];
    let documentUrls = [];

    if (req.files) {
      if (req.files.images) {
        for (const file of req.files.images) {
          try {
            const result = await saveFile(
              file.buffer,
              'property_images',
              file.originalname
            );
            imageUrls.push(result.url);
          } catch (error) {
            console.error('Image upload failed:', error.message);
            // Continue without this image rather than failing the entire request
          }
        }
      }

      if (req.files.documents) {
        for (const file of req.files.documents) {
          try {
            const result = await saveFile(
              file.buffer,
              'property_documents',
              file.originalname
            );
            documentUrls.push(result.url);
          } catch (error) {
            console.error('Document upload failed:', error.message);
            // Continue without this document rather than failing the entire request
          }
        }
      }
    }

    propertyData.images = imageUrls;
    propertyData.documents = documentUrls;

    const property = await Property.create(propertyData);

    // Create tenant criteria if provided
    if (req.body.tenantCriteria) {
      await PropertyTenantCriteria.create({
        property: property._id,
        ...req.body.tenantCriteria
      });
    }

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      data: property
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
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
    );

    res.json({
      success: true,
      message: 'Property updated successfully',
      data: updatedProperty
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

    res.json({
      success: true,
      message: 'Images uploaded successfully',
      imageUrls
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

    res.json({
      success: true,
      message: 'Documents uploaded successfully',
      documentUrls
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