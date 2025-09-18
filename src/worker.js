/**
 * Secure HLS Video Streaming Cloudflare Worker
 * Provides Firebase-authenticated access to HLS videos stored in R2 with signed URLs
 */

import { AwsClient } from 'aws4fetch';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Extract Firebase ID token from Authorization header
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response('Unauthorized: Missing or invalid token', {
          status: 401,
          headers: corsHeaders
        });
      }

      const idToken = authHeader.substring(7);
      
      // Validate Firebase ID token
      const isValidToken = await validateFirebaseToken(idToken, env);
      if (!isValidToken) {
        return new Response('Unauthorized: Invalid Firebase token', {
          status: 401,
          headers: corsHeaders
        });
      }

      // Parse the requested path
      const pathname = url.pathname;
      
      // Remove leading slash and decode
      const objectKey = decodeURIComponent(pathname.substring(1));
      
      if (!objectKey) {
        return new Response('Bad Request: No file specified', {
          status: 400,
          headers: corsHeaders
        });
      }

      // Check if this is an HLS playlist request
      if (objectKey.endsWith('.m3u8')) {
        return await handlePlaylistRequest(objectKey, env, corsHeaders);
      }
      
      // Check if this is a segment request
      if (objectKey.endsWith('.ts') || objectKey.endsWith('.mp4')) {
        return await handleSegmentRequest(objectKey, env, corsHeaders);
      }

      return new Response('Not Found: Unsupported file type', {
        status: 404,
        headers: corsHeaders
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

// Cache for Firebase public keys
const firebasePublicKeys = new Map();
const KEYS_CACHE_TTL = 3600000; // 1 hour in milliseconds

/**
 * Validates Firebase ID token with proper signature verification
 */
async function validateFirebaseToken(idToken, env) {
  try {
    const [headerB64, payloadB64, signatureB64] = idToken.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) {
      console.log('Invalid token format');
      return false;
    }

    // Decode JWT header and payload
    const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    
    const now = Math.floor(Date.now() / 1000);
    
    // Basic payload validation
    if (!payload.exp || payload.exp < now) {
      console.log('Token expired');
      return false;
    }
    
    if (!payload.iat || payload.iat > now) {
      console.log('Token issued in the future');
      return false;
    }
    
    if (payload.aud !== env.FIREBASE_PROJECT_ID) {
      console.log('Invalid audience');
      return false;
    }
    
    if (payload.iss !== `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`) {
      console.log('Invalid issuer');
      return false;
    }
    
    if (!payload.sub || payload.sub.length === 0 || payload.sub.length > 128) {
      console.log('Invalid subject');
      return false;
    }
    
    // Get Firebase public key for signature verification
    const publicKey = await getFirebasePublicKey(header.kid, env);
    if (!publicKey) {
      console.log('Could not get public key for kid:', header.kid);
      return false;
    }
    
    // Verify JWT signature
    const isValidSignature = await verifyJWTSignature(
      `${headerB64}.${payloadB64}`,
      signatureB64,
      publicKey
    );
    
    if (!isValidSignature) {
      console.log('Invalid token signature');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

/**
 * Gets Firebase public key from Google's JWKS endpoint with caching
 */
async function getFirebasePublicKey(kid, env) {
  try {
    const cacheKey = `firebase_key_${kid}`;
    const cached = firebasePublicKeys.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < KEYS_CACHE_TTL) {
      return cached.key;
    }
    
    // Fetch public keys from Google
    const response = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    
    if (!response.ok) {
      console.error('Failed to fetch Firebase public keys');
      return null;
    }
    
    const keys = await response.json();
    const publicKeyPem = keys[kid];
    
    if (!publicKeyPem) {
      console.error('Public key not found for kid:', kid);
      return null;
    }
    
    // Import the public key
    const publicKey = await crypto.subtle.importKey(
      'spki',
      pemToArrayBuffer(publicKeyPem),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    // Cache the key
    firebasePublicKeys.set(cacheKey, {
      key: publicKey,
      timestamp: Date.now()
    });
    
    return publicKey;
  } catch (error) {
    console.error('Error getting Firebase public key:', error);
    return null;
  }
}

/**
 * Converts PEM format key to ArrayBuffer
 */
function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/-{5}[^-]+-{5}/g, '').replace(/\s/g, '');
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

/**
 * Verifies JWT signature using Web Crypto API
 */
async function verifyJWTSignature(data, signature, publicKey) {
  try {
    const signatureBuffer = base64UrlToArrayBuffer(signature);
    const dataBuffer = new TextEncoder().encode(data);
    
    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signatureBuffer,
      dataBuffer
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Converts base64url to ArrayBuffer
 */
function base64UrlToArrayBuffer(base64Url) {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

/**
 * Handles HLS playlist requests - fetches .m3u8 and modifies segment URLs
 */
async function handlePlaylistRequest(objectKey, env, corsHeaders) {
  try {
    // Create AWS client for R2
    const r2Client = new AwsClient({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_KEY,
      region: 'auto'
    });

    // Construct R2 URL
    const r2Url = `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com/${env.BUCKET_NAME}/${objectKey}`;
    
    // Fetch the playlist from R2
    const response = await r2Client.fetch(r2Url);
    
    if (!response.ok) {
      return new Response('Not Found: Playlist not found', {
        status: 404,
        headers: corsHeaders
      });
    }

    let playlistContent = await response.text();
    
    // Parse and modify the playlist
    const lines = playlistContent.split('\n');
    const modifiedLines = [];

    for (let line of lines) {
      line = line.trim();
      
      // Check if line contains a segment reference
      if (line && !line.startsWith('#') && (line.endsWith('.ts') || line.endsWith('.mp4'))) {
        // Generate signed URL for the segment
        const segmentKey = line.includes('/') ? line : `${objectKey.split('/').slice(0, -1).join('/')}/${line}`;
        const signedUrl = await generateSignedUrl(segmentKey, env);
        modifiedLines.push(signedUrl);
      } else {
        modifiedLines.push(line);
      }
    }

    const modifiedPlaylist = modifiedLines.join('\n');

    return new Response(modifiedPlaylist, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('Playlist handling error:', error);
    return new Response('Internal Server Error', {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * Handles segment requests - redirects to signed URL
 */
async function handleSegmentRequest(objectKey, env, corsHeaders) {
  try {
    const signedUrl = await generateSignedUrl(objectKey, env);
    
    return Response.redirect(signedUrl, 302);
    
  } catch (error) {
    console.error('Segment handling error:', error);
    return new Response('Internal Server Error', {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * Generates AWS S3-style signed URL for R2 objects with configurable expiration
 */
async function generateSignedUrl(objectKey, env) {
  try {
    // Get configurable TTL from environment (default 15 minutes, max 12 hours)
    const defaultTtl = 900; // 15 minutes
    const maxTtl = 43200;   // 12 hours
    let ttlSeconds = parseInt(env.SIGNED_URL_TTL_SECONDS) || defaultTtl;
    
    if (ttlSeconds > maxTtl) {
      ttlSeconds = maxTtl;
    }
    if (ttlSeconds < 60) {
      ttlSeconds = 60; // minimum 1 minute
    }

    const r2Client = new AwsClient({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_KEY,
      region: 'auto',
      service: 's3'
    });

    const url = `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com/${env.BUCKET_NAME}/${objectKey}`;
    
    // Create presigned URL with proper expiration
    const signedRequest = await r2Client.sign(
      new Request(url, { method: 'GET' }),
      {
        aws: { 
          signQuery: true,
          allHeaders: false
        },
        headers: {
          'presigned-expires': ttlSeconds.toString()
        }
      }
    );

    return signedRequest.url;
    
  } catch (error) {
    console.error('Signed URL generation error:', error);
    throw error;
  }
}