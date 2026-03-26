const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initializeSchema } = require('./schema');
const routes = require('./routes');

const app = express();
app.use(express.json());
app.use(cors());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'telemedicine-service' });
});

// API routes
app.use('/api', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database schema and start server
const PORT = process.env.PORT || 3004;

async function startServer() {
  try {
    await initializeSchema();
    console.log('✓ Telemedicine database schema initialized');

    app.listen(PORT, () => {
      console.log(`✓ telemedicine-service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start telemedicine service:', error);
    process.exit(1);
  }
}

startServer();
