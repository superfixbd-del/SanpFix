import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import multer from 'multer';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Image Processing Endpoints
const upload = multer({ storage: multer.memoryStorage() });

// Optional server-side enhancement
app.post('/api/process-image', upload.single('image'), async (req, res) => {
  try {
    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const { brightness = 1, blur = 0 } = req.body;

    let image = sharp(file.buffer);

    if (brightness && parseFloat(brightness) !== 1) {
      image = image.modulate({ brightness: parseFloat(brightness) });
    }
    
    if (blur && parseFloat(blur) > 0) {
      image = image.blur(parseFloat(blur));
    }

    const buffer = await image.toBuffer();
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error: any) {
    console.error('Sharp processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling for entire app
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message,
    status: 'INTERNAL'
  });
});

async function startServer() {
  console.log('Initializing server with Environment:', process.env.NODE_ENV || 'development');

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    console.log('Configuring Vite middleware...');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: '0.0.0.0',
        port: 3000
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Serving production build from dist/');
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Only start listening if this file is run directly (not as a exported module in Vercel)
  if (process.env.NODE_ENV !== 'production' || process.env.AI_STUDIO) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`>>> DocAI Pro Server ready at http://0.0.0.0:${PORT}`);
    });
  }
}

startServer().catch(err => {
  console.error('FATAL Startup Error:', err);
  if (!process.env.VERCEL) process.exit(1);
});

export default app;
