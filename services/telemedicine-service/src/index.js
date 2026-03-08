const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'telemedicine-service' });
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => console.log(`telemedicine-service running on port ${PORT}`));
