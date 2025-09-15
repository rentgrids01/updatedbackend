const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./src/routes/authRoutes');
const tenantRoutes = require('./src/routes/tenantRoutes');
const ownerRoutes = require('./src/routes/ownerRoutes');
const propertyRoutes = require('./src/routes/propertyRoutes');
const visitRoutes = require('./src/routes/visitRoutes');
const subscriptionRoutes = require('./src/routes/subscriptionRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const scheduleRoutes = require('./src/routes/scheduleRoutes');
const featureRoutes = require('./src/routes/featureRoutes');
const amenityRoutes = require('./src/routes/amenityRoutes');
const aiRoutes = require('./src/routes/aiRoutes');
const adminSubscriptionRoutes = require('./src/routes/adminSubscriptionRoutes');
const subscriptionCatalogRoutes = require('./src/routes/subscriptionCatalogRoutes');
const userSubscriptionRoutes = require('./src/routes/userSubscriptionRoutes');
const subscriptionPaymentRoutes = require('./src/routes/subscriptionPaymentRoutes');
const webhookRoutes = require('./src/routes/webhookRoutes');

const errorHandler = require('./src/middleware/errorHandler');
const socketHandler = require('./src/socket/socketHandler');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"]
  }
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(helmet());
app.use(limiter);
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.IO setup
socketHandler(io);
app.set('io', io);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'RentGrid API is running',
    timestamp: new Date().toISOString(),
    storage: process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloudinary_cloud_name'
      ? 'Cloudinary' : 'Local Storage'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/features', featureRoutes);
app.use('/api/amenities', amenityRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminSubscriptionRoutes);
app.use('/api/catalog', subscriptionCatalogRoutes);
app.use('/api/me', userSubscriptionRoutes);
app.use('/api/me', subscriptionPaymentRoutes);
app.use('/api/webhooks', webhookRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

// Database connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(process.env.PORT || 7000, () => {
      console.log(`Server running on port ${process.env.PORT || 7000}`);
    });
  })
  .catch(err => {
    console.error('Database connection error:', err);
    process.exit(1);
  });