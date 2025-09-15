const Amenity = require('../models/Amenity');
const { saveFile } = require('../utils/fileUpload');

// Get All Amenities
const getAllAmenities = async (req, res) => {
  try {
    const amenities = await Amenity.find({ isActive: true })
      .sort({ name: 1 });

    res.json({
      success: true,
      data: amenities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create Amenity
const createAmenity = async (req, res) => {
  try {
    const { name, description } = req.body;

    let iconUrl = '';
    if (req.file) {
      const savedFile = await saveFile(
        req.file.buffer,
        'amenity_icons',
        req.file.originalname
      );
      iconUrl = savedFile.url;
    }

    const amenity = await Amenity.create({
      name,
      description,
      icon: iconUrl
    });

    res.status(201).json({
      success: true,
      message: 'Amenity created successfully',
      data: amenity
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update Amenity
const updateAmenity = async (req, res) => {
  try {
    const { amenityId } = req.params;
    const { name, description, isActive } = req.body;

    const updateData = { name, description, isActive };

    if (req.file) {
      const savedFile = await saveFile(
        req.file.buffer,
        'amenity_icons',
        req.file.originalname
      );
      updateData.icon = savedFile.url;
    }

    const amenity = await Amenity.findByIdAndUpdate(
      amenityId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!amenity) {
      return res.status(404).json({
        success: false,
        message: 'Amenity not found'
      });
    }

    res.json({
      success: true,
      message: 'Amenity updated successfully',
      data: amenity
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete Amenity
const deleteAmenity = async (req, res) => {
  try {
    const { amenityId } = req.params;

    const amenity = await Amenity.findByIdAndDelete(amenityId);
    if (!amenity) {
      return res.status(404).json({
        success: false,
        message: 'Amenity not found'
      });
    }

    res.json({
      success: true,
      message: 'Amenity deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllAmenities,
  createAmenity,
  updateAmenity,
  deleteAmenity
};