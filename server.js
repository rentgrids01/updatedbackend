const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit"); // DISABLED
const session = require("express-session");
const MongoStore = require("connect-mongo");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
require("dotenv").config();

// Import Passport configuration
const passport = require("./src/config/passport");

const authRoutes = require('./src/routes/authRoutes');
const socialAuthRoutes = require('./src/routes/socialAuthRoutes');
const tenantRoutes = require('./src/routes/tenantRoutes');
const ownerRoutes = require('./src/routes/ownerRoutes');
const propertyRoutes = require('./src/routes/propertyRoutes');
const visitRoutes = require('./src/routes/visitRoutes');
const subscriptionRoutes = require('./src/routes/subscriptionRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const userRoutes = require('./src/routes/userRoutes');
const scheduleRoutes = require('./src/routes/scheduleRoutes');
const featureRoutes = require('./src/routes/featureRoutes');
const amenityRoutes = require('./src/routes/amenityRoutes');
const aiRoutes = require('./src/routes/aiRoutes');
const adminSubscriptionRoutes = require('./src/routes/adminSubscriptionRoutes');
const subscriptionCatalogRoutes = require('./src/routes/subscriptionCatalogRoutes');
const userSubscriptionRoutes = require('./src/routes/userSubscriptionRoutes');
const subscriptionPaymentRoutes = require('./src/routes/subscriptionPaymentRoutes');
const webhookRoutes = require('./src/routes/webhookRoutes');
const contactRoutes = require('./src/routes/contactRoutes');
const notificationRoutes = require("./src/routes/notificationRoutes");
const propertyInquiryRoutes = require('./src/routes/propertyInquiryRoutes');
const tenancyInviteRoutes = require('./src/routes/tenancyInviteRoutes');
const tenantInviteRoutes = require('./src/routes/tenantInviteRoutes');

const errorHandler = require("./src/middleware/errorHandler");
const socketHandler = require("./src/socket/socketHandler");

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL,
      "http://localhost:5173",
      "http://localhost:3000",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:3000",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 10000, // 15 minutes
  max: 1000, // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
  })
);
// app.use(limiter); // COMPLETELY DISABLED - NO RATE LIMITING
app.use(morgan("combined"));

// Enhanced CORS configuration
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        process.env.CLIENT_URL,
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
      ];

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log("Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "Cache-Control",
      "X-Access-Token",
    ],
    exposedHeaders: ["set-cookie"],
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  })
);

// Handle preflight requests
app.options("*", cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Session configuration for Passport (only used during OAuth flow)
app.use(
  session({
    secret:
      process.env.SESSION_SECRET || "your-super-secure-session-secret-key-here",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 10 * 60 * 1000, // 10 minutes (short-lived for OAuth flow only)
    },
  })
);

// Initialize Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Socket.IO setup
socketHandler(io);
app.set("io", io);

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "RentGrid API is running",
    timestamp: new Date().toISOString(),
    storage:
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_CLOUD_NAME !== "your_cloudinary_cloud_name"
        ? "Cloudinary"
        : "Local Storage",
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/auth', socialAuthRoutes); // Social auth routes (no /api prefix for OAuth callbacks)
app.use('/api/tenant', tenantRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/features', featureRoutes);
app.use('/api/amenities', amenityRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminSubscriptionRoutes);
app.use('/api/catalog', subscriptionCatalogRoutes);
app.use('/api/me', userSubscriptionRoutes);
app.use('/api/me', subscriptionPaymentRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/contact', contactRoutes);
app.use("/api/notifications", notificationRoutes);
app.use('/api/property-inquiries', propertyInquiryRoutes);
app.use('/api/tenancy-invites', tenancyInviteRoutes);
app.use('/api/tenant-invites', tenantInviteRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

// Database connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
    server.listen(process.env.PORT || 7000, () => {
      console.log(`Server running on port ${process.env.PORT || 7000}`);
    });
  })
  .catch((err) => {
    console.error("Database connection error:", err);
    process.exit(1);
  });
