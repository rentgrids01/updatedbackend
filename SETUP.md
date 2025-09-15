# RentGrid Backend Setup Guide

## Prerequisites

1. **Node.js** (v16 or higher)
2. **MongoDB** (local installation or MongoDB Atlas)
3. **Cloudinary Account** (for file uploads)
4. **Gmail Account** (for email services)
5. **OpenAI API Key** (for AI features)

## Environment Setup

1. **Copy the environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Update the `.env` file with your credentials:**

   ### Database Configuration
   - For local MongoDB: `MONGO_URI=mongodb://localhost:27017/rentgrid`
   - For MongoDB Atlas: `MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/rentgrid`

   ### Email Configuration (Gmail)
   - Enable 2-factor authentication on your Gmail account
   - Generate an App Password: Google Account → Security → App passwords
   - Use your Gmail and the generated app password

   ### Cloudinary Setup
   - Sign up at [cloudinary.com](https://cloudinary.com)
   - Get your Cloud Name, API Key, and API Secret from the dashboard

   ### OpenAI Setup
   - Sign up at [openai.com](https://openai.com)
   - Generate an API key from the API section

## Installation & Running

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **For production:**
   ```bash
   npm start
   ```

## API Testing

1. **Import the Postman collection:**
   - Import `RentGrid_API_Collection_Updated.postman_collection.json` into Postman
   - The collection includes all endpoints with example requests

2. **Set up Postman variables:**
   - `base_url`: `http://localhost:7000/api`
   - `auth_token`: Will be automatically set after login

## Quick Test Flow

1. **Register a user:**
   - Use "Register Tenant" or "Register Landlord" endpoint

2. **Verify email:**
   - Use "Send OTP" and "Verify OTP" endpoints

3. **Login:**
   - Use "Login Tenant" or "Login Landlord" endpoint
   - Token will be automatically saved in Postman

4. **Test other endpoints:**
   - All authenticated endpoints will use the saved token

## Database Models

The API includes the following main models:
- **User**: Base user model for both tenants and landlords
- **TenantProfile**: Extended profile for tenants
- **LandlordProfile**: Extended profile for landlords
- **Property**: Property listings
- **Chat & Message**: Real-time messaging system
- **Schedule**: Property visit scheduling
- **Application**: Rental applications
- **Feature & Amenity**: Property features and amenities

## Socket.IO Events

The API supports real-time messaging with these events:
- `join-chats`: Join user's chats
- `join-chat`: Join specific chat
- `typing` / `stop-typing`: Typing indicators
- `newMessage`: New message received
- `messageDeleted`: Message deleted

## API Features

- ✅ JWT Authentication
- ✅ Email verification with OTP
- ✅ File uploads (Cloudinary)
- ✅ Real-time chat (Socket.IO)
- ✅ Property search & filtering
- ✅ AI-powered property descriptions
- ✅ Visit scheduling
- ✅ Application management
- ✅ Comprehensive error handling
- ✅ Input validation
- ✅ Rate limiting
- ✅ Security headers

## Troubleshooting

1. **MongoDB Connection Issues:**
   - Ensure MongoDB is running locally or check Atlas connection string
   - Verify network access in MongoDB Atlas

2. **Email Not Sending:**
   - Check Gmail credentials and app password
   - Ensure 2FA is enabled on Gmail account

3. **File Upload Issues:**
   - Verify Cloudinary credentials
   - Check file size limits (10MB default)

4. **Port Already in Use:**
   - Change PORT in .env file or kill the process using port 7000

## Support

For issues or questions, check the API documentation in the Postman collection or refer to the code comments in the controllers and models.