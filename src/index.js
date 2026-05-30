require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocket } = require('./socket');
const { connectDB } = require('./utils/db');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await connectDB();
    logger.info('MongoDB connected successfully');

    const server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, () => {
      logger.info(`SyncMusic server running on port ${PORT} [${process.env.NODE_ENV}]`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        logger.info('Server closed.');
        process.exit(0);
      });
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
