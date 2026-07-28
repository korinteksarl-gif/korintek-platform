require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.routes');
const candidatesRoutes = require('./routes/candidates.routes');
const queueRoutes = require('./routes/queue.routes');
const importRoutes = require('./routes/import.routes');
const auditRoutes = require('./routes/audit.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'korintek-queue-manager-api' }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/candidates', candidatesRoutes);
app.use('/api/v1/queue', queueRoutes);
app.use('/api/v1/import', importRoutes);
app.use('/api/v1/audit', auditRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route introuvable.' }));
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`KORINTEK Queue Manager API démarrée sur le port ${PORT}`);
});
