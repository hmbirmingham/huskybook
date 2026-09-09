import express from 'express';
import cors from 'cors';
import { providersRouter } from './routes/providers.js';
import { requestsRouter } from './routes/requests.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api/providers', providersRouter);
app.use('/api/requests', requestsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`HuskyBook API listening on http://localhost:${PORT}`);
});
