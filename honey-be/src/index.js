import express from 'express';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import speechRoutes from './routes/speech.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure directories exist
const tempDir = path.join(__dirname, '../temp');
const publicAudioDir = path.join(__dirname, '../public/audio');

[tempDir, publicAudioDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Cleanup old audio files (older than 1 hour)
const cleanupOldAudioFiles = () => {
  const maxAge = 60 * 60 * 1000; // 1 hour in ms
  const now = Date.now();
  
  try {
    const files = fs.readdirSync(publicAudioDir);
    let cleaned = 0;
    
    files.forEach(file => {
      const filePath = path.join(publicAudioDir, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    });
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old audio files`);
    }
  } catch (err) {
    console.error('Audio cleanup error:', err.message);
  }
};

// Run cleanup on startup and every 30 minutes
cleanupOldAudioFiles();
setInterval(cleanupOldAudioFiles, 30 * 60 * 1000);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  useTempFiles: true,
  tempFileDir: tempDir, // Use absolute path for Windows compatibility
  createParentPath: true
}));

// Static files for generated audio
app.use('/audio', express.static(publicAudioDir));

// Routes
app.use('/api/speech', speechRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    services: {
      gemini: !!process.env.GEMINI_API_KEY,
      elevenlabs: !!process.env.ELEVENLABS_API_KEY
    },
    directories: {
      temp: fs.existsSync(tempDir),
      audio: fs.existsSync(publicAudioDir)
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.listen(PORT, () => {
  console.log(`
🍯 Honey Backend Server (miku AI)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 HTTP: http://localhost:${PORT}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Endpoints:
   POST /api/speech/chat/smart   - Smart chat (classify + respond)
   DELETE /api/speech/audio/:id  - Delete audio file
   GET  /api/health              - Health check
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 Environment:
   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing'}
   ELEVENLABS_API_KEY: ${process.env.ELEVENLABS_API_KEY ? '✅ Set' : '❌ Missing'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

export default app;
