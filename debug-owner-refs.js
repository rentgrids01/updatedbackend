const mongoose = require('mongoose');
const Property = require('./src/models/Property');
const Owner = require('./src/models/Owner');
require('dotenv').config();

const debugOwnerReferences = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to database');

    // Get all properties without population first
    const properties = await Property.find().limit(3);
    console.log('\nRaw property owner fields:');
    
    for (let i = 0; i < properties.length; i++) {
      const prop = properties[i];
      console.log(`Property ${i + 1}:`);
      console.log(`  - Title: ${prop.title}`);
      console.log(`  - Owner field: ${prop.owner}`);
      console.log(`  - Owner type: ${typeof prop.owner}`);
      
      // Check if this owner ID exists in Owner collection
      if (prop.owner) {
        try {
          const ownerExists = await Owner.findById(prop.owner);
          console.log(`  - Owner exists in DB: ${ownerExists ? 'YES' : 'NO'}`);
          if (ownerExists) {
            console.log(`  - Owner name: ${ownerExists.fullName}`);
            console.log(`  - Owner phone: ${ownerExists.phonenumber}`);
          }
        } catch (error) {
          console.log(`  - Error checking owner: ${error.message}`);
        }
      }
      console.log('---');
    }

    // List all owners
    console.log('\nAll owners in database:');
    const owners = await Owner.find({}, 'fullName emailId phonenumber');
    owners.forEach((owner, index) => {
      console.log(`Owner ${index + 1}:`);
      console.log(`  - ID: ${owner._id}`);
      console.log(`  - Name: ${owner.fullName}`);
      console.log(`  - Email: ${owner.emailId}`);
      console.log(`  - Phone: ${owner.phonenumber}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from database');
  }
};

debugOwnerReferences();