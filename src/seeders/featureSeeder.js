const mongoose = require('mongoose');
const Feature = require('../models/Feature');
require('dotenv').config();

const seedFeatures = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for Features seeding');

    // Clear existing features
    await Feature.deleteMany({});
    console.log('Cleared existing features');

    // Define features data
    const featuresData = [
      {
        name: 'Modular Kitchen',
        description: 'Modern modular kitchen with built-in appliances and storage',
        icon: '/uploads/feature_icons/modular-kitchen.svg',
        isActive: true
      },
      {
        name: 'Furnished',
        description: 'Fully furnished property with all necessary furniture',
        icon: '/uploads/feature_icons/furnished.svg',
        isActive: true
      },
      {
        name: 'Semi-Furnished',
        description: 'Property with basic furniture and fittings',
        icon: '/uploads/feature_icons/semi-furnished.svg',
        isActive: true
      },
      {
        name: 'Air Conditioned',
        description: 'Air conditioning in all rooms',
        icon: '/uploads/feature_icons/ac.svg',
        isActive: true
      },
      {
        name: 'Balcony',
        description: 'Private balcony with outdoor access',
        icon: '/uploads/feature_icons/balcony.svg',
        isActive: true
      },
      {
        name: 'Terrace',
        description: 'Rooftop terrace or open terrace area',
        icon: '/uploads/feature_icons/terrace.svg',
        isActive: true
      },
      {
        name: 'Garden',
        description: 'Private or shared garden area',
        icon: '/uploads/feature_icons/garden.svg',
        isActive: true
      },
      {
        name: 'Parking Space',
        description: 'Dedicated parking space for vehicles',
        icon: '/uploads/feature_icons/parking.svg',
        isActive: true
      },
      {
        name: 'Storage Room',
        description: 'Additional storage space or utility room',
        icon: '/uploads/feature_icons/storage.svg',
        isActive: true
      },
      {
        name: 'Servant Room',
        description: 'Separate room for domestic help',
        icon: '/uploads/feature_icons/servant-room.svg',
        isActive: true
      },
      {
        name: 'Study Room',
        description: 'Dedicated study or work area',
        icon: '/uploads/feature_icons/study-room.svg',
        isActive: true
      },
      {
        name: 'Prayer Room',
        description: 'Dedicated prayer or meditation room',
        icon: '/uploads/feature_icons/prayer-room.svg',
        isActive: true
      },
      {
        name: 'Walk-in Closet',
        description: 'Spacious walk-in wardrobe',
        icon: '/uploads/feature_icons/walk-in-closet.svg',
        isActive: true
      },
      {
        name: 'Attached Bathroom',
        description: 'En-suite bathroom attached to bedroom',
        icon: '/uploads/feature_icons/attached-bathroom.svg',
        isActive: true
      },
      {
        name: 'Powder Room',
        description: 'Additional guest toilet/powder room',
        icon: '/uploads/feature_icons/powder-room.svg',
        isActive: true
      },
      {
        name: 'Wash Area',
        description: 'Separate washing and drying area',
        icon: '/uploads/feature_icons/wash-area.svg',
        isActive: true
      },
      {
        name: 'Chimney',
        description: 'Kitchen chimney for smoke extraction',
        icon: '/uploads/feature_icons/chimney.svg',
        isActive: true
      },
      {
        name: 'Built-in Wardrobes',
        description: 'Built-in storage wardrobes in bedrooms',
        icon: '/uploads/feature_icons/built-in-wardrobes.svg',
        isActive: true
      },
      {
        name: 'False Ceiling',
        description: 'Decorative false ceiling with lighting',
        icon: '/uploads/feature_icons/false-ceiling.svg',
        isActive: true
      },
      {
        name: 'Wooden Flooring',
        description: 'Premium wooden or laminated flooring',
        icon: '/uploads/feature_icons/wooden-flooring.svg',
        isActive: true
      }
    ];

    // Insert features
    const createdFeatures = await Feature.insertMany(featuresData);
    console.log(`✅ Successfully created ${createdFeatures.length} features:`);
    
    createdFeatures.forEach((feature, index) => {
      console.log(`${index + 1}. ${feature.name} - ID: ${feature._id}`);
    });

    console.log('\nFeatures seeding completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Error seeding features:', error);
    process.exit(1);
  }
};

// Run the seeder
if (require.main === module) {
  seedFeatures();
}

module.exports = { seedFeatures };