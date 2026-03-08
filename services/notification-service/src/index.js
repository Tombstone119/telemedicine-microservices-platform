const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => console.log(`notification-service running on port ${PORT}`));
