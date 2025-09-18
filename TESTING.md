# Testing Guide for Secure HLS Streaming Worker

## Prerequisites for Testing

1. **Firebase ID Token**: Get a valid ID token from your client app
2. **Video Files**: Upload HLS files to your R2 bucket following the structure in FFMPEG_GUIDE.md
3. **Worker Deployed**: Deploy your worker to Cloudflare (see DEPLOYMENT.md)

## Example API Requests

### 1. Request HLS Playlist (.m3u8)

```bash
# Replace with your actual worker URL and Firebase token
curl -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
     "https://your-worker.your-subdomain.workers.dev/videos/movie1/playlist.m3u8"
```

**Expected Response:**
- Status: 200 OK
- Content-Type: application/vnd.apple.mpegurl
- Body: Modified .m3u8 playlist with signed URLs for segments

### 2. Request Video Segment (.ts)

```bash
# This should redirect to a signed R2 URL
curl -i -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
     "https://your-worker.your-subdomain.workers.dev/videos/movie1/segments/segment_000.ts"
```

**Expected Response:**
- Status: 302 Found
- Location: https://ACCOUNT_ID.r2.cloudflarestorage.com/cupping-care/videos/movie1/segments/segment_000.ts?X-Amz-Algorithm=...

### 3. Unauthorized Request (No Token)

```bash
curl -i "https://your-worker.your-subdomain.workers.dev/videos/movie1/playlist.m3u8"
```

**Expected Response:**
- Status: 401 Unauthorized
- Body: "Unauthorized: Missing or invalid token"

### 4. Invalid Token Request

```bash
curl -i -H "Authorization: Bearer invalid_token" \
     "https://your-worker.your-subdomain.workers.dev/videos/movie1/playlist.m3u8"
```

**Expected Response:**
- Status: 401 Unauthorized
- Body: "Unauthorized: Invalid Firebase token"

## JavaScript Client Example

### Basic HTML5 Video Player with HLS.js

```html
<!DOCTYPE html>
<html>
<head>
    <title>Secure HLS Player</title>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script>
</head>
<body>
    <video id="video" controls width="800" height="600"></video>
    
    <script>
        // Get Firebase ID token (implement based on your auth flow)
        async function getFirebaseToken() {
            // Your Firebase auth implementation
            // return firebase.auth().currentUser.getIdToken();
            return 'your-firebase-id-token'; // Replace with actual token
        }
        
        async function loadVideo() {
            const video = document.getElementById('video');
            const token = await getFirebaseToken();
            
            if (Hls.isSupported()) {
                const hls = new Hls({
                    xhrSetup: function(xhr, url) {
                        // Add authorization header to all requests
                        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                    }
                });
                
                const playlistUrl = 'https://your-worker.your-subdomain.workers.dev/videos/movie1/playlist.m3u8';
                hls.loadSource(playlistUrl);
                hls.attachMedia(video);
                
                hls.on(Hls.Events.ERROR, function(event, data) {
                    console.error('HLS error:', data);
                });
                
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                // Native HLS support (Safari)
                video.src = playlistUrl;
            }
        }
        
        loadVideo();
    </script>
</body>
</html>
```

### React Component Example

```jsx
import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { useAuthToken } from './firebase-auth'; // Your auth hook

function SecureVideoPlayer({ videoPath }) {
    const videoRef = useRef();
    const { token } = useAuthToken();
    
    useEffect(() => {
        if (!token || !videoPath) return;
        
        const video = videoRef.current;
        const workerUrl = 'https://your-worker.your-subdomain.workers.dev';
        const playlistUrl = `${workerUrl}/${videoPath}`;
        
        if (Hls.isSupported()) {
            const hls = new Hls({
                xhrSetup: (xhr, url) => {
                    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                }
            });
            
            hls.loadSource(playlistUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS Error:', data);
            });
            
            return () => hls.destroy();
        }
    }, [token, videoPath]);
    
    return (
        <video
            ref={videoRef}
            controls
            width="800"
            height="600"
            style={{ maxWidth: '100%' }}
        />
    );
}

export default SecureVideoPlayer;
```

## Testing with Postman

1. **Create a Collection** for your HLS API tests

2. **Set Authorization Header:**
   - Key: `Authorization`
   - Value: `Bearer {{firebase_token}}`

3. **Create Environment Variable:**
   - Variable: `firebase_token`
   - Value: Your actual Firebase ID token

4. **Test Requests:**
   
   **Request 1: Get Playlist**
   - Method: GET
   - URL: `https://your-worker.your-subdomain.workers.dev/videos/movie1/playlist.m3u8`
   - Headers: Authorization: `Bearer {{firebase_token}}`
   
   **Request 2: Get Segment (should redirect)**
   - Method: GET  
   - URL: `https://your-worker.your-subdomain.workers.dev/videos/movie1/segments/segment_000.ts`
   - Headers: Authorization: `Bearer {{firebase_token}}`

## Debugging Common Issues

### Issue: 401 Unauthorized

**Possible Causes:**
1. Missing Authorization header
2. Invalid Firebase token format
3. Expired Firebase token
4. Wrong Firebase project configuration

**Debug Steps:**
1. Check if token is properly formatted
2. Verify token hasn't expired (check `exp` claim)
3. Ensure Firebase project ID matches

### Issue: 404 Not Found

**Possible Causes:**
1. File doesn't exist in R2 bucket
2. Incorrect file path
3. Wrong bucket configuration

**Debug Steps:**
1. Check R2 bucket contents
2. Verify file paths match request URLs
3. Check bucket name in Worker environment variables

### Issue: 500 Internal Server Error

**Debug Steps:**
1. Check Worker logs: `npx wrangler tail --env production`
2. Verify all environment variables are set correctly
3. Check R2 credentials and permissions

### Issue: CORS Errors

**Possible Causes:**
1. Browser blocking cross-origin requests
2. Missing CORS headers in responses

**Debug Steps:**
1. Check if CORS headers are present in responses
2. Ensure client is sending proper Origin headers
3. Test with CORS disabled or server-to-server

## Performance Testing

### Load Testing with Apache Bench

```bash
# Test playlist requests (replace with your URLs)
ab -n 100 -c 10 -H "Authorization: Bearer YOUR_TOKEN" \
   "https://your-worker.your-subdomain.workers.dev/videos/movie1/playlist.m3u8"
```

### Monitor Response Times

```bash
# Time a single request
time curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://your-worker.your-subdomain.workers.dev/videos/movie1/playlist.m3u8"
```

## Expected Performance

- **Playlist Requests**: < 500ms (includes R2 fetch and URL signing)
- **Segment Redirects**: < 100ms (just URL signing and redirect)
- **Signed URL Validity**: Configurable (default 15 minutes)

## Security Testing

1. **Test without token**: Should return 401
2. **Test with expired token**: Should return 401  
3. **Test with malformed token**: Should return 401
4. **Test signed URL expiration**: URLs should expire after configured time
5. **Test direct R2 access**: Should be blocked (bucket not public)

Remember to replace all placeholder values (YOUR_TOKEN, your-worker.your-subdomain.workers.dev, etc.) with your actual deployment values.