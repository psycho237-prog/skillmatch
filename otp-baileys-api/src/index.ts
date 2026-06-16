import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import cors from 'cors';
import { initBaileys, connectionState, currentQR } from './baileys/client';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/status', (req, res) => {
  res.json({
    status: connectionState,
    qr: currentQR
  });
});

app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  try {
    await initBaileys();
  } catch (err) {
    console.error('Failed to init Baileys', err);
  }
});
