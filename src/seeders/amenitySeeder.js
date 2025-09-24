const mongoose = require('mongoose');
const Amenity = require('../models/Amenity');
require('dotenv').config();

const seedAmenities = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for Amenities seeding');

    // Clear existing amenities
    await Amenity.deleteMany({});
    console.log('Cleared existing amenities');

    // Define amenities data
    const amenitiesData = [
      {
        name: 'Swimming Pool',
        description: 'Community swimming pool with pool deck',
        icon: '/uploads/amenity_icons/swimming-pool.svg',
        isActive: true
      },
      {
        name: 'Gymnasium',
        description: 'Fully equipped fitness center and gym',
        icon: '/uploads/amenity_icons/gymnasium.svg',
        isActive: true
      },
      {
        name: 'Club House',
        description: 'Community club house for events and gatherings',
        icon: '/uploads/amenity_icons/club-house.svg',
        isActive: true
      },
      {
        name: 'Children Play Area',
        description: 'Dedicated play area for children',
        icon: '/uploads/amenity_icons/play-area.svg',
        isActive: true
      },
      {
        name: '24/7 Security',
        description: 'Round-the-clock security with guards',
        icon: '/uploads/amenity_icons/security.svg',
        isActive: true
      },
      {
        name: 'CCTV Surveillance',
        description: 'Complete CCTV coverage for safety',
        icon: '/uploads/amenity_icons/cctv.svg',
        isActive: true
      },
      {
        name: 'Intercom Facility',
        description: 'Video door phone and intercom system',
        icon: '/uploads/amenity_icons/intercom.svg',
        isActive: true
      },
      {
        name: 'Power Backup',
        description: '24/7 power backup with generator',
        icon: '/uploads/amenity_icons/power-backup.svg',
        isActive: true
      },
      {
        name: 'Lift/Elevator',
        description: 'High-speed elevators for all floors',
        icon: '/uploads/amenity_icons/elevator.svg',
        isActive: true
      },
      {
        name: 'Reserved Parking',
        description: 'Covered reserved parking spaces',
        icon: '/uploads/amenity_icons/reserved-parking.svg',
        isActive: true
      },
      {
        name: 'Visitor Parking',
        description: 'Separate parking area for guests',
        icon: '/uploads/amenity_icons/visitor-parking.svg',
        isActive: true
      },
      {
        name: 'Landscaped Garden',
        description: 'Beautiful landscaped garden and green spaces',
        icon: '/uploads/amenity_icons/landscaped-garden.svg',
        isActive: true
      },
      {
        name: 'Jogging Track',
        description: 'Dedicated jogging and walking track',
        icon: '/uploads/amenity_icons/jogging-track.svg',
        isActive: true
      },
      {
        name: 'Tennis Court',
        description: 'Professional tennis court facility',
        icon: '/uploads/amenity_icons/tennis-court.svg',
        isActive: true
      },
      {
        name: 'Badminton Court',
        description: 'Indoor badminton court',
        icon: '/uploads/amenity_icons/badminton-court.svg',
        isActive: true
      },
      {
        name: 'Basketball Court',
        description: 'Full-size basketball court',
        icon: '/uploads/amenity_icons/basketball-court.svg',
        isActive: true
      },
      {
        name: 'Multipurpose Hall',
        description: 'Community hall for events and functions',
        icon: '/uploads/amenity_icons/multipurpose-hall.svg',
        isActive: true
      },
      {
        name: 'Library',
        description: 'Community library with reading area',
        icon: '/uploads/amenity_icons/library.svg',
        isActive: true
      },
      {
        name: 'Spa & Wellness Center',
        description: 'Spa and wellness facilities',
        icon: '/uploads/amenity_icons/spa.svg',
        isActive: true
      },
      {
        name: 'Business Center',
        description: 'Co-working space and business facilities',
        icon: '/uploads/amenity_icons/business-center.svg',
        isActive: true
      },
      {
        name: 'Cafeteria',
        description: 'On-site cafeteria and dining area',
        icon: '/uploads/amenity_icons/cafeteria.svg',
        isActive: true
      },
      {
        name: 'Shopping Center',
        description: 'In-complex shopping and retail outlets',
        icon: '/uploads/amenity_icons/shopping-center.svg',
        isActive: true
      },
      {
        name: 'Medical Center',
        description: 'On-site medical facility and pharmacy',
        icon: '/uploads/amenity_icons/medical-center.svg',
        isActive: true
      },
      {
        name: 'Waste Management',
        description: 'Organized waste disposal and recycling',
        icon: '/uploads/amenity_icons/waste-management.svg',
        isActive: true
      },
      {
        name: 'Water Treatment Plant',
        description: 'In-house water treatment and purification',
        icon: '/uploads/amenity_icons/water-treatment.svg',
        isActive: true
      },
      {
        name: 'Rainwater Harvesting',
        description: 'Eco-friendly rainwater collection system',
        icon: '/uploads/amenity_icons/rainwater-harvesting.svg',
        isActive: true
      },
      {
        name: 'Solar Panels',
        description: 'Solar power generation for common areas',
        icon: '/uploads/amenity_icons/solar-panels.svg',
        isActive: true
      },
      {
        name: 'EV Charging Station',
        description: 'Electric vehicle charging points',
        icon: '/uploads/amenity_icons/ev-charging.svg',
        isActive: true
      },
      {
        name: 'Fire Safety System',
        description: 'Complete fire detection and sprinkler system',
        icon: '/uploads/amenity_icons/fire-safety.svg',
        isActive: true
      },
      {
        name: 'Maintenance Service',
        description: '24/7 maintenance and housekeeping service',
        icon: '/uploads/amenity_icons/maintenance-service.svg',
        isActive: true
      }
    ];

    // Insert amenities
    const createdAmenities = await Amenity.insertMany(amenitiesData);
    console.log(`✅ Successfully created ${createdAmenities.length} amenities:`);
    
    createdAmenities.forEach((amenity, index) => {
      console.log(`${index + 1}. ${amenity.name} - ID: ${amenity._id}`);
    });

    console.log('\nAmenities seeding completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Error seeding amenities:', error);
    process.exit(1);
  }
};

// Run the seeder
if (require.main === module) {
  seedAmenities();
}

module.exports = { seedAmenities };