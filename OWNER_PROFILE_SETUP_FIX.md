# Owner Profile Setup API Testing Guide

## Issue Fixed: "Invalid setup session"

### Problem
The error occurred because:
1. The Owner model was missing `setupId` and `setupProgress` fields
2. Setup session validation was failing due to undefined schema fields
3. Postman wasn't properly extracting and using the setupId

### Solution Applied

#### 1. Updated Owner Model Schema
Added missing fields to `src/models/Owner.js`:
```javascript
setupId: String,
setupProgress: {
  currentStep: Number,
  totalSteps: Number,
  completedSteps: [String],
  isComplete: Boolean
},
// Plus enhanced profile and document fields
```

#### 2. Enhanced Controller Methods
- Added proper error handling and debugging
- Fixed setup session validation logic
- Added console logging for troubleshooting

#### 3. Improved Postman Collection
- Added automatic setupId extraction
- Enhanced error debugging
- Added pre-request validation scripts

## Testing Steps

### Step 1: Owner Authentication
1. Use the "Owner Login" endpoint to get authentication token
2. Token will be auto-saved as `{{ownerToken}}`

### Step 2: Initialize Profile Setup
1. Run "1. Initialize Profile Setup"
2. Verify `setupId` is extracted and saved
3. Check console logs for confirmation

### Step 3: Save Personal Details
1. Run "2. Save Personal Details"
2. Should now work without "Invalid setup session" error
3. Check response for progress tracking

### Step 4: Continue Setup Process
Follow the remaining steps in sequence:
- Select Avatar
- Upload Profile Photo
- Complete Profile Details
- Upload ID Document
- Finalize Profile Setup

## Debugging Tools

### Debug Current Owner State
Use the "🔧 Debug Current Owner" endpoint to check:
- Current setupId
- Setup progress
- Profile completion status

### Console Logging
The API now includes detailed console logs for:
- Setup initialization
- Session validation
- Progress tracking

## API Response Format

All upload endpoints now return proper URLs:

```json
{
  "success": true,
  "data": {
    "photoPath": "/uploads/profile_photos/uuid-filename.jpg",
    "photoUrl": "http://localhost:7000/uploads/profile_photos/uuid-filename.jpg",
    "filename": "uuid-generated-name.jpg",
    "originalName": "original-file.jpg",
    "progress": {
      "currentStep": 4,
      "totalSteps": 7,
      "completedSteps": ["personal-details", "avatar", "photo"],
      "isComplete": false
    }
  }
}
```

## Common Issues & Solutions

### Issue: setupId not found
**Solution**: Make sure to run "Initialize Profile Setup" first

### Issue: Authentication failed
**Solution**: Login using "Owner Login" endpoint first

### Issue: File upload failed
**Solution**: Ensure files are under size limits (5MB for photos, 10MB for documents)

The "Invalid setup session" error should now be resolved with proper schema fields and validation logic.