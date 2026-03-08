const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'doctor-service' });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`doctor-service running on port ${PORT}`));
