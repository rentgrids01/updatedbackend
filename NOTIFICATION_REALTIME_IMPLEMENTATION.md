# Real-Time Notification System Implementation

## Overview
Enhanced the notification system to support real-time Socket.IO emissions when notifications are fetched, marked as read, and created.

## Changes Made

### 1. Enhanced Notification Controller (`src/controllers/notificationController.js`)

#### Modified `getMyNotifications` Function
- Added real-time Socket.IO emission when notifications are fetched
- Emits to user's personal room: `notifications-fetched` event
- Emits to notification room: `notifications-updated` event
- Includes notification counts (total and unread)

#### Modified `markNotificationRead` Function
- Added real-time Socket.IO emission when notification is marked as read
- Emits to user's personal room: `notification-marked-read` event
- Emits to notification room: `notification-read-update` event

#### Added `getNotificationCount` Function
- New endpoint to get notification counts (total, unread, read)
- Emits real-time count updates via Socket.IO
- Emits to user's personal room: `notification-count-updated` event
- Emits to notification room: `notification-counts` event

### 2. Enhanced Notification Service (`src/services/notificationService.js`)

#### Modified `createNotification` Function
- Added optional Socket.IO parameter for real-time emissions
- Emits `new-notification` to user's personal room
- Emits `notification-created` to user's notification room
- Logs real-time emission events

### 3. Enhanced Socket Handler (`src/socket/socketHandler.js`)

#### Added `join-notifications` Event
- Allows users to join their general notification room
- Room format: `notifications-{userId}`
- Provides success/error callbacks

### 4. Enhanced Notification Routes (`src/routes/notificationRoutes.js`)

#### Added New Route
- `GET /api/notifications/count` - Get notification counts with real-time updates

## Socket.IO Events

### Client-to-Server Events
- `join-notifications` - Join general notification room

### Server-to-Client Events
- `notifications-fetched` - Sent when notifications are retrieved
- `notifications-updated` - Sent to notification room when notifications change
- `notification-marked-read` - Sent when notification is marked as read
- `notification-read-update` - Sent to notification room for read updates
- `notification-count-updated` - Sent when notification counts are fetched
- `notification-counts` - Sent to notification room for count updates
- `new-notification` - Sent when new notification is created
- `notification-created` - Sent to notification room for new notifications

## Room Structure

### Personal Rooms
- Format: `{userId}` (user's ObjectId as string)
- Used for direct user-specific notifications

### Notification Rooms
- Format: `notifications-{userId}`
- Used for notification-specific events
- Must be explicitly joined by client using `join-notifications` event

## Usage Example

### Client-Side Implementation
```javascript
// Connect to Socket.IO
const socket = io('http://localhost:7000', {
  auth: { token: 'your-jwt-token' }
});

// Join notification room
socket.emit('join-notifications', (response) => {
  console.log('Joined notifications:', response);
});

// Listen for real-time notifications
socket.on('notifications-fetched', (data) => {
  console.log('Notifications updated:', data);
  updateNotificationUI(data.data);
});

socket.on('new-notification', (data) => {
  console.log('New notification:', data.notification);
  showNotificationAlert(data.notification);
});

socket.on('notification-marked-read', (data) => {
  console.log('Notification read:', data.notificationId);
  updateNotificationStatus(data.notificationId, true);
});

// Fetch notifications (triggers real-time events)
fetch('/api/notifications', {
  headers: { Authorization: 'Bearer ' + token }
});
```

### Server-Side Usage
```javascript
// In your controller/service
const io = req.app.get("io");

// Create notification with real-time emission
await notificationService.createNotification({
  recipient: userId,
  recipientModel: 'Tenant',
  type: 'property_inquiry',
  title: 'New Property Inquiry',
  message: 'You have a new inquiry',
  io: io // Pass Socket.IO instance for real-time emission
});
```

## Testing

A test server (`test-notification-socket.js`) has been created to verify the implementation:

```bash
node test-notification-socket.js
```

Then open `http://localhost:8000` to test the real-time notification system.

## Benefits

1. **Real-Time Updates**: Users receive instant notifications without polling
2. **Multiple Device Support**: Notifications sync across all user's connected devices
3. **Room-Based Targeting**: Efficient message delivery to specific user groups
4. **Backwards Compatible**: Existing API endpoints work unchanged
5. **Comprehensive Coverage**: Covers fetching, reading, counting, and creating notifications
6. **Debugging Support**: Extensive logging for troubleshooting

## Integration Notes

- Socket.IO instance is accessible via `req.app.get("io")` in controllers
- Personal rooms are auto-joined on connection
- Notification rooms require explicit joining via `join-notifications` event
- All events include timestamps for synchronization
- Error handling included for all Socket.IO operations