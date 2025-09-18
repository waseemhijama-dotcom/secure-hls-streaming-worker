# FFmpeg HLS Conversion and R2 Upload Guide

## FFmpeg HLS Conversion

### Basic HLS Conversion Command

```bash
ffmpeg -i input_video.mp4 \
  -c copy \
  -start_number 0 \
  -hls_time 10 \
  -hls_list_size 0 \
  -f hls \
  output.m3u8
```

### Advanced HLS with Multiple Quality Levels

```bash
# Create adaptive bitrate streaming with multiple qualities
ffmpeg -i input_video.mp4 \
  -filter_complex \
  "[0:v]split=3[v1][v2][v3]; \
   [v1]copy[v1out]; \
   [v2]scale=w=1280:h=720[v2out]; \
   [v3]scale=w=854:h=480[v3out]" \
  -map "[v1out]" -c:v:0 libx264 -x264-params "nal-hrd=cbr:force-cfr=1" -b:v:0 5M -maxrate:v:0 5M -minrate:v:0 5M -bufsize:v:0 10M -preset slow -g 48 -sc_threshold 0 -keyint_min 48 \
  -map "[v2out]" -c:v:1 libx264 -x264-params "nal-hrd=cbr:force-cfr=1" -b:v:1 3M -maxrate:v:1 3M -minrate:v:1 3M -bufsize:v:1 6M -preset slow -g 48 -sc_threshold 0 -keyint_min 48 \
  -map "[v3out]" -c:v:2 libx264 -x264-params "nal-hrd=cbr:force-cfr=1" -b:v:2 1M -maxrate:v:2 1M -minrate:v:2 1M -bufsize:v:2 2M -preset slow -g 48 -sc_threshold 0 -keyint_min 48 \
  -map a:0 -c:a:0 aac -b:a:0 96k -ac 2 \
  -map a:0 -c:a:1 aac -b:a:1 96k -ac 2 \
  -map a:0 -c:a:2 aac -b:a:2 48k -ac 2 \
  -f hls \
  -hls_time 4 \
  -hls_playlist_type vod \
  -hls_flags independent_segments \
  -hls_segment_type mpegts \
  -hls_segment_filename "stream_%v/data%02d.ts" \
  -master_pl_name "master.m3u8" \
  -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2" \
  stream_%v.m3u8
```

### Simple High-Quality HLS Command

```bash
# Recommended for most use cases
ffmpeg -i input_video.mp4 \
  -c:v libx264 \
  -c:a aac \
  -hls_time 10 \
  -hls_playlist_type vod \
  -hls_flags independent_segments \
  -hls_segment_type mpegts \
  -hls_segment_filename "segments/segment_%03d.ts" \
  playlist.m3u8
```

## R2 Folder Structure

### Recommended Directory Structure

```
cupping-care/                    # R2 Bucket
├── videos/
│   ├── movie1/
│   │   ├── playlist.m3u8        # Main playlist
│   │   └── segments/
│   │       ├── segment_000.ts   # Video segments
│   │       ├── segment_001.ts
│   │       ├── segment_002.ts
│   │       └── ...
│   ├── movie2/
│   │   ├── playlist.m3u8
│   │   └── segments/
│   │       └── ...
│   └── series1/
│       ├── episode1/
│       │   ├── playlist.m3u8
│       │   └── segments/
│       └── episode2/
│           ├── playlist.m3u8
│           └── segments/
└── thumbnails/                  # Optional: Video thumbnails
    ├── movie1.jpg
    ├── movie2.jpg
    └── ...
```

### Alternative Flat Structure (simpler)

```
cupping-care/
├── movie1_playlist.m3u8
├── movie1_segment_000.ts
├── movie1_segment_001.ts
├── movie1_segment_002.ts
├── movie2_playlist.m3u8
├── movie2_segment_000.ts
└── ...
```

## Uploading to R2

### Method 1: Using Wrangler CLI

```bash
# Upload single file
npx wrangler r2 object put cupping-care/videos/movie1/playlist.m3u8 --file playlist.m3u8

# Upload directory recursively
npx wrangler r2 object put cupping-care/videos/movie1/ --file . --recursive
```

### Method 2: Using R2 API with curl

```bash
# First, get your R2 endpoint and credentials
ACCOUNT_ID="your-account-id"
ACCESS_KEY="your-access-key"
SECRET_KEY="your-secret-key"

# Upload playlist
curl -X PUT "https://${ACCOUNT_ID}.r2.cloudflarestorage.com/cupping-care/videos/movie1/playlist.m3u8" \
  -H "Authorization: AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/..." \
  --data-binary "@playlist.m3u8"
```

### Method 3: Using AWS CLI (S3-compatible)

```bash
# Configure AWS CLI with R2 credentials
aws configure set aws_access_key_id YOUR_R2_ACCESS_KEY
aws configure set aws_secret_access_key YOUR_R2_SECRET_KEY

# Upload files
aws s3 cp playlist.m3u8 s3://cupping-care/videos/movie1/playlist.m3u8 --endpoint-url https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
aws s3 sync ./segments s3://cupping-care/videos/movie1/segments --endpoint-url https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
```

## Complete Workflow Example

1. **Convert video to HLS:**
```bash
ffmpeg -i my_movie.mp4 \
  -c:v libx264 \
  -c:a aac \
  -hls_time 10 \
  -hls_playlist_type vod \
  -hls_flags independent_segments \
  -hls_segment_type mpegts \
  -hls_segment_filename "segments/segment_%03d.ts" \
  playlist.m3u8
```

2. **Upload to R2:**
```bash
# Create the directory structure and upload
npx wrangler r2 object put cupping-care/videos/my_movie/playlist.m3u8 --file playlist.m3u8
npx wrangler r2 object put cupping-care/videos/my_movie/segments/ --file segments/ --recursive
```

3. **Test with Worker:**
```bash
# Your video will be accessible via:
# https://your-worker.your-subdomain.workers.dev/videos/my_movie/playlist.m3u8
```

## FFmpeg Options Explained

- `-hls_time 10`: Each segment is 10 seconds long
- `-hls_playlist_type vod`: Video on Demand (complete playlist)
- `-hls_flags independent_segments`: Each segment can be decoded independently
- `-hls_segment_type mpegts`: Use MPEG-TS format for segments
- `-hls_segment_filename`: Template for segment file names
- `-c:v libx264`: Use H.264 video codec
- `-c:a aac`: Use AAC audio codec

## Best Practices

1. **Segment Length**: 10 seconds is a good balance between quality and loading speed
2. **File Organization**: Use clear directory structures for easy management
3. **Naming Convention**: Use consistent naming for playlists and segments
4. **Video Quality**: Choose appropriate bitrates for your target audience
5. **Security**: Never make your R2 bucket public - always use signed URLs