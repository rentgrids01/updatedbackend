# Property API Test

## Test Property Creation

You can now create properties with the simplified structure. Here's an example:

### POST /api/properties

**Required Fields (directly in request body):**
- `city` - Property city
- `state` - Property state  
- `locality` - Property locality
- `fullAddress` - Complete address

**Optional Location Fields:**
- `landmark` - Nearby landmark
- `zipcode` - Postal code
- `latitude` - Latitude coordinate
- `longitude` - Longitude coordinate

**New Fields Added:**
- `visitingHours` - Array or comma-separated string
- `landlord` - Landlord name/description
- `nearbyPlaces` - Array or comma-separated string
- `maintenanceCharges` - Detailed maintenance info
- `floor` - Floor description
- `parking` - Parking details
- `balcony` - Balcony description
- `ageOfBuilding` - Building age
- `availabilityDate` - Availability description

## Key Changes Made:

1. **✅ Fixed Location Fields**: Now accepts `city`, `state`, `locality`, `fullAddress` directly in request body
2. **✅ Removed tenantCriteria**: No longer required for property creation
3. **✅ Full Image URLs**: All responses now return complete URLs
4. **✅ Smart Array Handling**: Accepts both arrays and comma-separated strings for:
   - `features`
   - `amenities` 
   - `visitingHours`
   - `nearbyPlaces`

## Updated API Endpoints:

- **GET** `/api/properties` - All properties (public)
- **GET** `/api/properties/:id` - Single property (public)  
- **GET** `/api/properties/owner` - Owner's properties (auth required)
- **POST** `/api/properties` - Create property (auth required)
- **PUT** `/api/properties/:id` - Update property (auth required)

## Example Request Body:

```json
{
  "title": "Luxury 2BHK Apartment",
  "description": "Beautiful apartment with modern amenities",
  "city": "Mumbai",
  "state": "Maharashtra", 
  "locality": "Andheri West",
  "fullAddress": "A-301, Skyline Apartments, Andheri West, Mumbai",
  "landmark": "Near Infinity Mall",
  "zipcode": "400058",
  "latitude": "19.1136",
  "longitude": "72.8697",
  "propertyType": "apartment",
  "listingType": "rent",
  "monthlyRent": 25000,
  "bhk": "2BHK",
  "bedroom": 2,
  "bathroom": 2,
  "area": 1200,
  "furnishType": "furnished",
  "visitingHours": "10:00 AM - 12:00 PM,2:00 PM - 6:00 PM",
  "landlord": "Mr. Rajesh Kumar",
  "nearbyPlaces": "Metro Station - 500m,Shopping Mall - 1km",
  "maintenanceCharges": "₹2000/month - All inclusive",
  "floor": "5th Floor out of 15",
  "parking": "2 Covered Parking Spaces",
  "balcony": "2 balconies with garden view",
  "ageOfBuilding": "5 years old",
  "availabilityDate": "Available from January 15, 2024"
}
```

The API is now ready for property creation without the tenantCriteria requirement!