const mongoose = require('mongoose');
const logger = require('./logger');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set');

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected. Attempting to reconnect...');
  });
}

module.exports = { connectDB };
