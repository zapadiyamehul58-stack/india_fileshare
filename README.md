# FlashShare Lite — Extremely Fast & Simple

A minimalist, high-speed file sharing platform focused on instant results.

## ✨ Features
- **Ultra-Simple UI**: Single-screen, no-scroll interface.
- **Parallel Chunking**: 5MB chunks upload simultaneously for maximum speed.
- **Instant Sharing**: Download link generated immediately after upload.

## 🚀 Running Locally

### 1. Start the Lite Backend
```bash
cd server
npm install
node lite-server.js
```

### 2. Start the Frontend
```bash
npm install
npm run dev
```

### 3. Environment Variables
Ensure your `.env` has:
- `S3_ENDPOINT`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_BUCKET_NAME`
- `VITE_API_URL=http://localhost:3001`
