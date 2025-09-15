const Feature = require('../models/Feature');
const { saveFile } = require('../utils/fileUpload');

// Get All Features
const getAllFeatures = async (req, res) => {
  try {
    const features = await Feature.find({ isActive: true })
      .sort({ name: 1 });

    res.json({
      success: true,
      data: features
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create Feature
const createFeature = async (req, res) => {
  try {
    const { name, description } = req.body;

    let iconUrl = '';
    if (req.file) {
      const savedFile = await saveFile(
        req.file.buffer,
        'feature_icons',
        req.file.originalname
      );
      iconUrl = savedFile.url;
    }

    const feature = await Feature.create({
      name,
      description,
      icon: iconUrl
    });

    res.status(201).json({
      success: true,
      message: 'Feature created successfully',
      data: feature
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update Feature
const updateFeature = async (req, res) => {
  try {
    const { featureId } = req.params;
    const { name, description, isActive } = req.body;

    const updateData = { name, description, isActive };

    if (req.file) {
      const savedFile = await saveFile(
        req.file.buffer,
        'feature_icons',
        req.file.originalname
      );
      updateData.icon = savedFile.url;
    }

    const feature = await Feature.findByIdAndUpdate(
      featureId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      });
    }

    res.json({
      success: true,
      message: 'Feature updated successfully',
      data: feature
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete Feature
const deleteFeature = async (req, res) => {
  try {
    const { featureId } = req.params;

    const feature = await Feature.findByIdAndDelete(featureId);
    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      });
    }

    res.json({
      success: true,
      message: 'Feature deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllFeatures,
  createFeature,
  updateFeature,
  deleteFeature
};