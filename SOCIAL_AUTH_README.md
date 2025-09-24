# Social Authentication API

Complete Google and Facebook OAuth2 integration for the RentGrid backend application.

## 🚀 Features

- **Google OAuth2 Login**: Complete Google Sign-In integration
- **Facebook OAuth2 Login**: Complete Facebook Login integration
- **Account Linking**: Users can link multiple social accounts to one profile
- **JWT Authentication**: Secure token-based authentication
- **User Management**: Get user info, unlink accounts, manage sessions
- **CORS Support**: Configured for frontend integration on localhost:5173
- **Error Handling**: Comprehensive error handling and user feedback
- **Development Tools**: Testing endpoints and OAuth URL generators

## 📚 API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/status` | Get social login service status |
| GET | `/auth/health` | Health check for the service |
| GET | `/auth/test` | Test endpoint to verify routes |
| GET | `/auth/google` | Initiate Google OAuth login |
| GET | `/auth/facebook` | Initiate Facebook OAuth login |
| GET | `/auth/success` | OAuth success callback |
| GET | `/auth/failure` | OAuth failure callback |
| GET | `/auth/failure-json` | JSON format failure response |
| POST | `/auth/logout` | Logout and clear session |
| GET | `/auth/limits` | Get rate limiting information |

### Development Endpoints (NODE_ENV=development only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/test-google` | Get Google OAuth URL for manual testing |
| GET | `/auth/test-facebook` | Get Facebook OAuth URL for manual testing |

### Protected Endpoints (Require JWT Token)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/me` | Get current authenticated user info |
| DELETE | `/auth/unlink/:provider` | Unlink social account (google/facebook) |

## 🔧 Setup Instructions

### 1. Environment Configuration

Copy the environment variables from `SOCIAL_AUTH_ENV_TEMPLATE.txt` to your `.env` file:

```bash
# Required environment variables
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:7000/auth/google/callback

FACEBOOK_CLIENT_ID=your_facebook_app_id
FACEBOOK_CLIENT_SECRET=your_facebook_app_secret
FACEBOOK_CALLBACK_URL=http://localhost:7000/auth/facebook/callback

CLIENT_URL=http://localhost:5173
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret
```

### 2. OAuth App Configuration

#### Google OAuth Setup:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:7000/auth/google/callback`
6. Copy Client ID and Client Secret to your `.env` file

#### Facebook OAuth Setup:
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app
3. Add Facebook Login product
4. Configure Valid OAuth Redirect URIs: `http://localhost:7000/auth/facebook/callback`
5. Copy App ID and App Secret to your `.env` file

### 3. Start the Server

```bash
npm install
npm run dev
```

Server will start on port 7000 with social authentication endpoints active.

## 🧪 Testing with Postman

Import the `Social_Authentication_Postman_Collection.json` file into Postman for comprehensive testing.

### Collection Features:
- ✅ Automated test scripts for all endpoints
- ✅ Token extraction and storage
- ✅ Error handling validation
- ✅ Environment variable management
- ✅ Response validation

### Testing Flow:

1. **Service Health Check**: Test `/auth/status` and `/auth/health`
2. **Get OAuth URLs**: Use `/auth/test-google` and `/auth/test-facebook` (development)
3. **Manual OAuth Flow**: Visit the generated URLs in browser
4. **Token Extraction**: Tokens are automatically extracted from success callbacks
5. **Protected Routes**: Test `/auth/me` and unlink endpoints with tokens
6. **User Management**: Test account unlinking and user info retrieval

## 📊 Database Models

### SocialAuth Model
Tracks social authentication providers linked to users:

```javascript
{
  userId: ObjectId,           // Reference to Owner or Tenant
  userType: String,           // 'Owner' or 'Tenant'
  provider: String,           // 'google' or 'facebook'
  providerId: String,         // Social provider user ID
  providerEmail: String,      // Email from social provider
  providerName: String,       // Full name from social provider
  providerPicture: String,    // Profile picture URL
  accessToken: String,        // OAuth access token
  refreshToken: String,       // OAuth refresh token (optional)
  tokenExpiry: Date,          // Token expiration time
  isActive: Boolean,          // Active status
  lastUsed: Date,            // Last login time
  linkedAt: Date             // When account was linked
}
```

## 🔐 Authentication Flow

### Google OAuth Flow:
1. User clicks "Login with Google"
2. Frontend redirects to `/auth/google`
3. Server redirects to Google OAuth
4. User authenticates with Google
5. Google redirects to `/auth/google/callback`
6. Server processes OAuth response
7. Server creates/links user account
8. Server generates JWT token
9. Server redirects to frontend with token
10. Frontend stores token and authenticates user

### Facebook OAuth Flow:
1. User clicks "Login with Facebook"
2. Frontend redirects to `/auth/facebook`
3. Server redirects to Facebook OAuth
4. User authenticates with Facebook
5. Facebook redirects to `/auth/facebook/callback`
6. Server processes OAuth response
7. Server creates/links user account
8. Server generates JWT token
9. Server redirects to frontend with token
10. Frontend stores token and authenticates user

## 🛡️ Security Features

- **JWT Tokens**: Secure, stateless authentication
- **Token Expiration**: 7-day token expiry with refresh capability
- **Session Management**: MongoDB-based session storage
- **CORS Configuration**: Restricted to allowed origins
- **Input Validation**: Comprehensive request validation
- **Error Handling**: Secure error messages without sensitive data exposure
- **Rate Limiting**: Built-in rate limiting for OAuth endpoints

## 🔄 Account Linking Logic

- **Email-based Linking**: Accounts are linked based on email address
- **Multiple Providers**: Users can link both Google and Facebook to one account
- **Account Creation**: New accounts are automatically created if email doesn't exist
- **User Type Detection**: Supports both Owner and Tenant user types
- **Duplicate Prevention**: Prevents linking the same provider twice

## 🎯 Frontend Integration

### CORS Configuration
The server is configured to accept requests from `http://localhost:5173` (typical Vite dev server).

### Token Usage
```javascript
// Store token from OAuth callback
const token = new URLSearchParams(window.location.search).get('token');
localStorage.setItem('authToken', token);

// Use token for API requests
const response = await fetch('/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### OAuth Initiation
```html
<!-- Simple OAuth login buttons -->
<a href="http://localhost:7000/auth/google">Login with Google</a>
<a href="http://localhost:7000/auth/facebook">Login with Facebook</a>
```

## 🚨 Error Handling

The API provides comprehensive error responses:

```json
{
  "success": false,
  "message": "User-friendly error message",
  "error": "error_code"
}
```

Common error codes:
- `authentication_failed`: OAuth authentication failed
- `token_generation_failed`: JWT token creation failed
- `email_required`: Social provider didn't provide email
- `account_creation_failed`: Failed to create user account
- `invalid_provider`: Unsupported OAuth provider
- `user_cancelled`: User cancelled authentication

## 📈 Monitoring and Logs

- **Request Logging**: All OAuth requests are logged
- **Error Tracking**: Comprehensive error logging
- **Performance Metrics**: Response time tracking
- **Health Checks**: Built-in health check endpoints
- **Rate Limit Monitoring**: Request rate monitoring

## 🔧 Troubleshooting

### Common Issues:

1. **OAuth Redirect URI Mismatch**: Ensure callback URLs match exactly in OAuth app settings
2. **CORS Errors**: Check CLIENT_URL environment variable matches your frontend URL
3. **Token Errors**: Verify JWT_SECRET is set and consistent
4. **Database Connection**: Ensure MongoDB is running and MONGO_URI is correct
5. **Environment Variables**: Double-check all required variables are set

### Debug Mode:
Set `NODE_ENV=development` to enable:
- OAuth URL generation endpoints
- Detailed error logging  
- Additional debug information

## 📝 API Response Examples

### Successful Authentication:
```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "fullName": "John Doe",
      "emailId": "john@example.com",
      "userType": "owner"
    },
    "socialAccounts": [
      {
        "provider": "google",
        "providerEmail": "john@example.com",
        "lastUsed": "2023-09-24T10:00:00.000Z"
      }
    ]
  }
}
```

### Error Response:
```json
{
  "success": false,
  "message": "Access denied. No token provided.",
  "error": "unauthorized"
}
```

## 🎉 Ready to Use!

Your social authentication system is now fully configured and ready for production use. Import the Postman collection to start testing all endpoints immediately.