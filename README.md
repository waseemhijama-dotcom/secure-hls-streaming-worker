# Secure HLS Video Streaming with Cloudflare Workers

A robust, secure solution for streaming HLS (HTTP Live Streaming) videos from Cloudflare R2 storage with Firebase authentication and AWS S3-compatible signed URLs.

## 🚀 Features

- **🔐 Firebase Authentication**: Secure JWT token validation using Google's public certificates
- **🎬 HLS Video Streaming**: Support for .m3u8 playlists and video segments (.ts, .mp4)
- **🔗 Signed URLs**: AWS S3-compatible signed URLs with configurable expiration (default: 15 minutes)
- **☁️ Cloudflare R2**: Private bucket storage - no public access required
- **🌐 CORS Support**: Cross-origin resource sharing for web applications
- **⚡ High Performance**: Direct R2 streaming with edge caching

## 📋 Requirements

- Cloudflare account with Workers and R2 enabled
- Firebase project with Authentication
- R2 bucket for video storage
- Node.js and Wrangler CLI

## 🛠️ Quick Start

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   npx wrangler secret put R2_ACCESS_KEY_ID
   npx wrangler secret put R2_SECRET_KEY
   npx wrangler secret put FIREBASE_PROJECT_ID
   npx wrangler secret put ACCOUNT_ID
   npx wrangler secret put BUCKET_NAME
   ```

3. **Deploy to Cloudflare:**
   ```bash
   npx wrangler deploy --env production
   ```

## 📖 Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide with environment setup
- **[FFMPEG_GUIDE.md](FFMPEG_GUIDE.md)** - Video conversion and R2 upload instructions  
- **[TESTING.md](TESTING.md)** - API examples and client implementation guides

## 🎯 Usage

### Request HLS Playlist

```bash
curl -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
     "https://your-worker.workers.dev/videos/movie1/playlist.m3u8"
```

### HTML5 Video Player

```html
<video controls>
  <source src="https://your-worker.workers.dev/videos/movie1/playlist.m3u8" 
          type="application/vnd.apple.mpegurl">
</video>
```

### React Component

```jsx
import { useAuthToken } from './firebase-auth';

function VideoPlayer({ videoPath }) {
  const { token } = useAuthToken();
  const videoUrl = `https://your-worker.workers.dev/${videoPath}`;
  
  return (
    <video controls>
      <source src={videoUrl} type="application/vnd.apple.mpegurl" />
    </video>
  );
}
```

## 🔧 Development

```bash
# Start development server
npm run dev

# View logs
npm run tail

# Deploy
npm run deploy
```

## 📁 Project Structure

```
├── src/
│   └── worker.js          # Main Cloudflare Worker code
├── DEPLOYMENT.md          # Deployment instructions
├── FFMPEG_GUIDE.md        # Video conversion guide
├── TESTING.md             # API testing examples
├── package.json           # Dependencies
├── wrangler.toml          # Cloudflare Worker configuration
└── README.md              # This file
```

## 🔒 Security

- JWT tokens validated against Google's public certificates
- Signed URLs with configurable expiration
- No public bucket access required
- CORS headers for controlled access

## 📝 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `R2_ACCESS_KEY_ID` | R2 API Access Key ID | `abc123...` |
| `R2_SECRET_KEY` | R2 API Secret Access Key | `xyz789...` |
| `FIREBASE_PROJECT_ID` | Firebase project identifier | `my-app-12345` |
| `ACCOUNT_ID` | Cloudflare Account ID | `def456...` |
| `BUCKET_NAME` | R2 bucket name | `cupping-care` |
| `SIGNED_URL_TTL_SECONDS` | URL expiration (optional) | `900` |

## 📄 License

MIT License - See LICENSE file for details