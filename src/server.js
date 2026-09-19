require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'infotechzone-backend' }));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/products', require('./routes/products.routes'));
app.use('/api/categories', require('./routes/categories.routes'));
app.use('/api/favourites', require('./routes/favourites.routes'));
app.use('/api/customers', require('./routes/customers.routes'));
app.use('/api/enquiries', require('./routes/enquiries.routes'));
app.use('/api/admins', require('./routes/admins.routes'));
app.use('/api/settings', require('./routes/settings.routes'));
app.use('/api/views', require('./routes/views.routes'));
app.use('/api/analytics', require('./routes/analytics.routes'));

// Centralised error handler — keeps stack traces out of API responses.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: 'Something went wrong on our end.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Infotechzone backend listening on http://localhost:${PORT}`));
