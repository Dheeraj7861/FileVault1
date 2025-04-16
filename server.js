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