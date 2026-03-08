const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`auth-service running on port ${PORT}`));
