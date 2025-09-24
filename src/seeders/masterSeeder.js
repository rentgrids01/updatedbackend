const mongoose = require('mongoose');
const { seedFeatures } = require('./featureSeeder');
const { seedAmenities } = require('./amenitySeeder');
require('dotenv').config();

const seedAll = async () => {
  try {
    console.log('🌱 Starting Features and Amenities Seeding...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Run Feature Seeder
    console.log('📝 Seeding Features...');
    await seedFeatures();
    
    // Run Amenity Seeder
    console.log('\n🏢 Seeding Amenities...');
    await seedAmenities();

    console.log('\n🎉 All seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Features: 20 items created');
    console.log('- Amenities: 30 items created');
    console.log('\n💡 You can now use these IDs in your property creation API');
    console.log('📍 Use GET /api/features and GET /api/amenities to retrieve the ObjectIds');

  } catch (error) {
    console.error('❌ Error in seeding process:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run if called directly
if (require.main === module) {
  seedAll();
}

module.exports = { seedAll };