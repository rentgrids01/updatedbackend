const mongoose = require('mongoose');
const Property = require('./src/models/Property');
const Owner = require('./src/models/Owner');
require('dotenv').config();

const fixOwnerReferences = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to database');

    // Get all owners
    const owners = await Owner.find();
    console.log(`Found ${owners.length} owners`);

    // Get all properties
    const properties = await Property.find();
    console.log(`Found ${properties.length} properties`);

    if (owners.length === 0) {
      console.log('No owners found. Cannot fix references.');
      return;
    }

    // Fix each property by assigning a valid owner
    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];
      const ownerIndex = i % owners.length; // Distribute properties among available owners
      const assignedOwner = owners[ownerIndex];

      console.log(`Fixing property: ${property.title}`);
      console.log(`  Old owner ID: ${property.owner}`);
      console.log(`  New owner ID: ${assignedOwner._id}`);
      console.log(`  Owner name: ${assignedOwner.fullName}`);

      // Update the property with valid owner reference
      await Property.findByIdAndUpdate(property._id, {
        owner: assignedOwner._id
      });

      console.log(`  ✓ Updated successfully`);
      console.log('---');
    }

    // Verify the fix
    console.log('\nVerifying fixes...');
    const updatedProperties = await Property.find()
      .populate('owner', 'fullName emailId phonenumber')
      .limit(3);

    updatedProperties.forEach((prop, index) => {
      console.log(`Property ${index + 1}:`);
      console.log(`  - Title: ${prop.title}`);
      console.log(`  - Owner Name: ${prop.owner ? prop.owner.fullName : 'still null'}`);
      console.log(`  - Owner Phone: ${prop.owner ? prop.owner.phonenumber : 'still null'}`);
    });

    console.log('\n✅ Owner references fixed successfully!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
};

fixOwnerReferences();