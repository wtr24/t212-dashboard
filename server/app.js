require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./models/db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/pies', require('./routes/pies'));
app.use('/api/community', require('./routes/community'));
app.use('/api/analysis', require('./routes/analysis'));
app.use('/api/market', require('./routes/market'));
app.use('/api/refresh', require('./routes/refresh'));

const PORT = process.env.PORT || 5002;

initDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('DB init failed:', err.message);
  app.listen(PORT, () => console.log(`Server running on port ${PORT} (no DB)`));
});

module.exports = app;
