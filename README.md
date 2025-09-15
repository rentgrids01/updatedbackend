# RentGrid Backend API

A comprehensive property rental platform backend built with Node.js, Express.js, and MongoDB.

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