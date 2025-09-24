const mongoose = require('mongoose');
const Property = require('./src/models/Property');
const Owner = require('./src/models/Owner');
require('dotenv').config();

const testOwnerPopulation = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to database');

    // Check total properties
    const totalProperties = await Property.countDocuments();
    console.log(`Total properties in database: ${totalProperties}`);

    // Check properties with owner
    const propertiesWithOwner = await Property.countDocuments({ owner: { $exists: true, $ne: null } });
    console.log(`Properties with owner: ${propertiesWithOwner}`);

    // Check total owners
    const totalOwners = await Owner.countDocuments();
    console.log(`Total owners in database: ${totalOwners}`);

    // Try to get first few properties with owner population
    const properties = await Property.find()
      .populate('owner', 'fullName emailId phonenumber')
      .limit(3);

    console.log('\nFirst 3 properties with owner info:');
    properties.forEach((prop, index) => {
      console.log(`Property ${index + 1}:`);
      console.log(`  - Title: ${prop.title}`);
      console.log(`  - Owner ID: ${prop.owner ? prop.owner._id : 'null'}`);
      console.log(`  - Owner Name: ${prop.owner ? prop.owner.fullName : 'not populated'}`);
      console.log(`  - Owner Phone: ${prop.owner ? prop.owner.phonenumber : 'not populated'}`);
      console.log('---');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
};

testOwnerPopulation();