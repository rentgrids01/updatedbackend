# RentGrid Backend API

# RentGrid Backend

A comprehensive rental property management system backend with advanced global property APIs, built with Node.js and Express.

## 🚀 New Features

### Global Property APIs with Advanced Filtering
- **Public Property APIs** with owner data masking for security
- **Advanced filtering** by location, budget, tenant preferences, property features
- **Intelligent search** with multiple parameter combinations
- **Comprehensive pagination** and sorting options
- **Similar property suggestions** based on location and specifications

### Enhanced Property Management
- **Complete property data model** with all missing fields added
- **Full file upload support** for images and documents with automatic URL generation
- **Owner-specific endpoints** with proper authentication
- **Database seeding** with 20 features and 30 amenities
- **Comprehensive Postman collection** with all endpoints and examples

## Features

- **Authentication System**
  - Separate auth for tenants and landlords
  - JWT token-based authentication
  - Email verification with OTP
  - Password reset functionality

- **User Management**
  - Complete profile management for tenants and landlords
  - Document and media upload capabilities
  - Preference and history tracking

- **Property Management**
  - CRUD operations for properties
  - Advanced filtering and search
  - Image and document uploads
  - Status management

- **Communication**
  - Real-time chat system with Socket.IO
  - Text, image, and location messages
  - Group chat support

- **Scheduling**
  - Property visit scheduling
  - Status tracking and updates

- **AI Integration**
  - OpenAI-powered property description generation

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file with your environment variables (see .env.example)

3. Start the development server:
```bash
npm run dev
```

4. The API will be available at `http://localhost:7000`

## 📋 API Documentation

### Global Property APIs (Public Access)

#### Get All Properties with Advanced Filtering
```http
GET /api/properties
```

**Query Parameters:**
- `page` (number): Page number for pagination
- `limit` (number): Results per page (max 20)
- `location` (string): City/locality name
- `localities[]` (array): Multiple localities filter
- `minBudget` (number): Minimum rent amount
- `maxBudget` (number): Maximum rent amount
- `availability` (string): immediate | within_15_days | after_30_days
- `preferredTenants` (string): family | bachelor_male | bachelor_female | company | student
- `propertyType` (string): apartment | villa | studio | independent_house
- `furnishing` (string): full | semi | none
- `parking` (string): 2wheeler | 4wheeler
- `bhk` (number): Number of bedrooms
- `minArea` (number): Minimum built-up area (sq ft)
- `maxArea` (number): Maximum built-up area (sq ft)
- `propertyAge` (string): lt1 | lt5 | lt10
- `bathrooms` (number): Minimum number of bathrooms
- `floors` (string): ground | 1st | custom
- `showVerified` (boolean): Show only verified properties
- `sortBy` (string): createdAt | monthlyRent | views | area
- `order` (string): asc | desc

**Example:**
```http
GET /api/properties?location=Mumbai&minBudget=20000&maxBudget=50000&preferredTenants=family&bhk=2&furnishing=full&limit=10
```

#### Get Property by ID
```http
GET /api/properties/:id
```
Returns detailed property information with masked owner data for security.

#### Get Similar Properties
```http
GET /api/properties/:id/similar?limit=5
```
Returns properties similar to the specified property based on location, type, and budget.

### Owner Property Management (Authenticated)

#### Get Owner Properties
```http
GET /api/properties/owner
Authorization: Bearer <token>
```

#### Create Property
```http
POST /api/properties
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Required Fields:**
- `title`: Property title
- `description`: Property description
- `city`: City name
- `state`: State name
- `locality`: Locality/area name
- `fullAddress`: Complete address
- `propertyType`: apartment | villa | studio | independent_house
- `listingType`: rent | sale
- `monthlyRent`: Monthly rent amount
- `area`: Property area
- `bedroom`: Number of bedrooms
- `bathroom`: Number of bathrooms

**New Fields Added:**
- `visitingHours`: Available visiting hours (comma-separated)
- `landlord`: Landlord information
- `nearbyPlaces`: Nearby places and distances (comma-separated)
- `maintenanceCharges`: Maintenance charge details
- `floor`: Floor information with details
- `parking`: Parking space details
- `balcony`: Balcony information
- `ageOfBuilding`: Building age details
- `availabilityDate`: Availability information

### Helper APIs

#### Get All Features
```http
GET /api/features
```
Returns all available property features with icons.

#### Get All Amenities
```http
GET /api/amenities
```
Returns all available amenities with icons.

### Security Features

- **Owner Data Masking**: Public APIs mask sensitive owner information
- **JWT Authentication**: Secure access to owner-specific endpoints
- **Role-based Access Control**: Different access levels for different user types
- **Input Validation**: Comprehensive validation for all endpoints

## API Documentation

Import the `RentGrid_API_Collection.postman_collection.json` file into Postman to access all API endpoints with example requests.

### Main Endpoints

- **Authentication**: `/api/auth/*`
- **Tenant Management**: `/api/tenant/*`
- **Landlord Management**: `/api/landlord/*`
- **Properties**: `/api/properties/*`
- **Chat & Messaging**: `/api/chat/*`, `/api/messages/*`
- **Scheduling**: `/api/schedules/*`
- **Features & Amenities**: `/api/features/*`, `/api/amenities/*`
- **AI Services**: `/api/ai/*`

## Environment Variables

Required environment variables:

```
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=7000
EMAIL_USER=your_email
EMAIL_PASS=your_email_password
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
OPENAI_API_KEY=your_openai_api_key
CLIENT_URL=http://localhost:5173
```

## Architecture

```
src/
├── controllers/     # Request handlers
├── middleware/      # Authentication, validation, etc.
├── models/         # MongoDB/Mongoose models
├── routes/         # Express route definitions
├── socket/         # Socket.IO event handlers
└── utils/          # Utility functions
```

## Technologies Used

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens, bcryptjs
- **File Storage**: Cloudinary
- **Email**: Nodemailer
- **Real-time**: Socket.IO
- **AI**: OpenAI API
- **Validation**: Express-validator
- **Security**: Helmet, CORS, Rate limiting