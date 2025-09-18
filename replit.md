# Overview

This is a Cloudflare Worker that provides secure HLS (HTTP Live Streaming) video streaming with Firebase authentication and signed R2 URLs. The worker acts as a secure proxy between authenticated users and HLS video files stored in Cloudflare R2, dynamically generating signed URLs for video segments and playlists while ensuring only authenticated users can access the content.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Authentication Strategy
The system uses Firebase Authentication for user verification, validating Firebase ID tokens through Google's public JWKS endpoint. This eliminates the need for storing private keys or service account credentials in the worker, simplifying security management while maintaining robust authentication.

## Video Storage and Access Pattern
Videos are stored in Cloudflare R2 object storage in HLS format with segmented files (.ts) and playlist files (.m3u8). The worker intercepts requests for these files and dynamically generates signed URLs for R2 access, ensuring content protection while maintaining streaming performance.

## Request Flow Architecture
The worker follows a proxy pattern where:
1. Client requests are authenticated using Firebase tokens
2. Valid requests are processed to generate signed R2 URLs
3. Playlist files are modified in-memory to replace segment URLs with signed versions
4. Video segments redirect to signed R2 URLs for direct streaming

## Security Model
The system implements defense-in-depth security:
- Firebase token validation at the application layer
- Signed URLs with configurable TTL (default 15 minutes) for time-bounded access
- CORS headers for controlled cross-origin access
- No persistent authentication state in the worker

## Performance Considerations
The architecture prioritizes streaming performance by:
- Using redirects for video segments to enable direct R2 streaming
- Implementing in-memory playlist modification to avoid storage overhead
- Leveraging Cloudflare's edge network for global content delivery

# External Dependencies

## Cloudflare Services
- **Cloudflare Workers**: Serverless runtime environment hosting the authentication and URL signing logic
- **Cloudflare R2**: Object storage service containing HLS video files and segments
- **Wrangler CLI**: Development and deployment tooling for worker management

## Authentication Services
- **Firebase Authentication**: Identity provider for user token validation
- **Google JWKS Endpoint**: Public key infrastructure for Firebase token verification

## Third-party Libraries
- **aws4fetch**: AWS Signature Version 4 signing library for generating authenticated R2 requests and signed URLs

## Video Processing Tools
- **FFmpeg**: External tool for converting videos to HLS format with multiple quality levels and proper segmentation (referenced in documentation but not directly integrated)

## Configuration Dependencies
- Environment variables for R2 credentials, Firebase project configuration, and signed URL TTL settings
- R2 bucket configuration with proper access permissions for the worker