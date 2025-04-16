const dotenv = require('dotenv');
const path = require('path');

// Load environment variables - must be done before other imports
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Print all environment variables for debugging
console.log('Environment variables loaded:');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Set (value hidden)' : 'Not Set');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set (value hidden)' : 'Not Set');
console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'Set (value hidden)' : 'Not Set');
console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'Set (value hidden)' : 'Not Set');
console.log('AWS_REGION:', process.env.AWS_REGION);
console.log('AWS_S3_BUCKET_NAME:', process.env.AWS_S3_BUCKET_NAME);

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const passport = require('passport');
const fileUpload = require('express-fileupload');

// Routes
const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/project.routes');
const versionRoutes = require('./routes/version.routes');
const userRoutes = require('./routes/user.routes');
const notificationRoutes = require('./routes/notification.routes');
const activityRoutes = require('./routes/activity.routes');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Set up socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
  }
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use(cors({
  origin: [process.env.CLIENT_URL || 'http://localhost:5173', 'http://localhost:8080'],
  credentials: true
}));

// File upload middleware
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  useTempFiles: false,
  abortOnLimit: true,
  responseOnLimit: 'File size limit exceeded (max 50MB)'
}));

// Initialize Passport
app.use(passport.initialize());
require('./config/passport');

// Socket.io middleware
io.use((socket, next) => {
  console.log('[SOCKET] Connection attempt with token:', socket.handshake.auth.token ? 'Present' : 'Missing');
  
  const token = socket.handshake.auth.token;
  if (!token) {
    console.log('[SOCKET] Authentication failed: No token provided');
    return next(new Error('Authentication error - No token provided'));
  }
  
  // Verify JWT token (implement this in middleware)
  const { verifySocketToken } = require('./middleware/auth');
  const user = verifySocketToken(token);
  
  if (!user) {
    console.log('[SOCKET] Authentication failed: Invalid token');
    return next(new Error('Authentication error - Invalid token'));
  }
  
  console.log('[SOCKET] Authentication successful for user:', user.id);
  socket.user = user;
  next();
});

// Socket connection handler
io.on('connection', socket => {
  console.log('[SOCKET] User connected:', socket.user.id);
  
  // Store connection status in a variable to prevent multiple disconnect handlers
  let isDisconnecting = false;
  
  // Join personal room for notifications
  socket.join(`user:${socket.user.id}`);
  console.log('[SOCKET] User joined personal room:', `user:${socket.user.id}`);
  
  // Acknowledge successful connection to client
  socket.emit('connect_success', { userId: socket.user.id });
  
  // Handle disconnect
  socket.on('disconnect', (reason) => {
    if (isDisconnecting) return; // Prevent multiple disconnection handling
    isDisconnecting = true;
    
    console.log('[SOCKET] User disconnected:', socket.user.id, 'Reason:', reason);
    
    // If client disconnected due to error, let them know they should reconnect
    if (reason === 'transport error' || reason === 'transport close') {
      // Can't emit to disconnected socket, but log it
      console.log('[SOCKET] Transport error disconnection for user', socket.user.id);
    }
  });
  
  // Handle reconnection attempt
  socket.on('reconnect_attempt', () => {
    console.log('[SOCKET] User attempting to reconnect:', socket.user.id);
  });
  
  // Handle error events
  socket.on('error', (error) => {
    console.error('[SOCKET] Error for user', socket.user.id, ':', error);
    // Send error to client
    socket.emit('socket_error', { message: 'Socket error occurred', details: error.message });
  });
  
  // Handle connection error events
  socket.on('connect_error', (error) => {
    console.error('[SOCKET] Connection error for user', socket.user.id, ':', error);
  });
  
  // Special method to report frontend errors
  socket.on('report_error', (error) => {
    console.error('[FRONTEND-ERROR] Reported by user', socket.user.id, ':', error);
  });
  
  // Ping/pong to keep connection alive
  socket.on('ping', () => {
    socket.emit('pong');
  });
  
  // Join project room with error handling
  socket.on('join-project', async (projectId) => {
    try {
      console.log('[SOCKET] User', socket.user.id, 'joining project room:', projectId);
      socket.join(`project:${projectId}`);
      
      // Let's validate if the user actually has access to this project
      const Project = require('./models/project.model');
      const project = await Project.findById(projectId);
      
      if (!project) {
        console.log('[SOCKET] Project not found:', projectId);
        // Emit an error to the client
        socket.emit('project-error', { message: 'Project not found' });
        return;
      }
      
      if (!project.hasAccess(socket.user.id, 'view')) {
        console.log('[SOCKET] User', socket.user.id, 'does not have access to project:', projectId);
        // Emit an error to the client
        socket.emit('project-error', { message: 'You do not have access to this project' });
        return;
      }
      
      console.log('[SOCKET] User', socket.user.id, 'successfully joined project room:', projectId);
      socket.emit('joined-project', { projectId });
    } catch (error) {
      console.error('[SOCKET] Error joining project room:', error);
      socket.emit('project-error', { message: 'Error joining project room', details: error.message });
    }
  });
  
  // Leave project room
  socket.on('leave-project', projectId => {
    console.log('[SOCKET] User', socket.user.id, 'leaving project room:', projectId);
    socket.leave(`project:${projectId}`);
    socket.emit('left-project', { projectId });
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects', versionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activities', activityRoutes);

// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[ERROR] Server error:', err);
  console.error('[ERROR] Stack trace:', err.stack);
  console.error('[ERROR] Request URL:', req.originalUrl);
  console.error('[ERROR] Request method:', req.method);
  console.error('[ERROR] Request IP:', req.ip);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  // Send the response with detailed error in development
  return res.status(statusCode).json({ 
    success: false, 
    message,
    error: process.env.NODE_ENV !== 'production' ? {
      stack: err.stack,
      details: err
    } : undefined
  });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;
console.log('Attempting to start server on port:', PORT);
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });

// Export io for use in other files
module.exports = { io }; 