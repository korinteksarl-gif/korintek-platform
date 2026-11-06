require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const authRoutes = require('./routes/auth.routes');
const contactsRoutes = require('./routes/contacts.routes');
const usersRoutes = require('./routes/users.routes');
const publicRoutes = require('./routes/public.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
// Routes publiques (site korintek.com) : CORS propre, montées AVANT le CORS de l'app
app.use('/api/v1/public', express.json({ limit: '20kb' }), publicRoutes);
app.use(cors({ origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map((o) => o.trim()) : process.env.NODE_ENV === 'production' ? false : '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'korintek-crm-api' }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/contacts', contactsRoutes);
app.use('/api/v1/users', usersRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route introuvable.' }));
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`KORINTEK CRM API démarrée sur le port ${PORT}`);
});
