# Deployment Instructions for Secure HLS Streaming Worker

## Prerequisites

1. **Cloudflare Account** with Workers and R2 enabled
2. **Firebase Project** with Authentication enabled
3. **R2 Bucket** named "cupping-care" (or update BUCKET_NAME in config)
4. **Wrangler CLI** installed globally: `npm install -g wrangler@4`

## Step-by-Step Deployment

### 1. Authenticate with Cloudflare

```bash
npx wrangler login
```

### 2. Set Environment Variables/Secrets

You need to set the following secrets in your Cloudflare Worker:

#### Required Secrets:
```bash
# R2 Access Credentials
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_KEY

# Firebase Configuration
npx wrangler secret put FIREBASE_PROJECT_ID

# Cloudflare Account Info
npx wrangler secret put ACCOUNT_ID
npx wrangler secret put BUCKET_NAME

# Optional: Signed URL TTL (defaults to 900 seconds / 15 minutes)
npx wrangler secret put SIGNED_URL_TTL_SECONDS
```

#### How to Get These Values:

**R2 Credentials:**
1. Go to Cloudflare Dashboard → R2 Object Storage → Manage R2 API tokens
2. Create token with "Object Read & Write" permissions
3. Note down Access Key ID and Secret Access Key

**Firebase Credentials:**
1. Firebase Console → Project Settings → General
2. From the project overview, copy your Project ID → FIREBASE_PROJECT_ID

Note: The Worker now uses Google's public JWKS endpoint for Firebase token validation, so no private keys or service account credentials are needed.

**Cloudflare Account ID:**
1. Cloudflare Dashboard → Right sidebar shows "Account ID"

### 3. Update wrangler.toml

Edit the `wrangler.toml` file and replace placeholder values:

```toml
[env.production.vars]
FIREBASE_PROJECT_ID = "your-actual-firebase-project-id"
ACCOUNT_ID = "your-actual-cloudflare-account-id"
BUCKET_NAME = "cupping-care"
SIGNED_URL_TTL_SECONDS = "900"  # 15 minutes (adjust as needed)
```

### 4. Deploy to Production

```bash
# Deploy to production environment
npx wrangler deploy --env production

# Check deployment status
npx wrangler tail --env production
```

### 5. Set Custom Domain (Optional)

1. Go to Cloudflare Dashboard → Workers & Pages → Your Worker
2. Click "Triggers" tab → Add Custom Domain
3. Enter your domain (e.g., `video-api.yourdomain.com`)

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `R2_ACCESS_KEY_ID` | R2 API Access Key ID | `abc123...` |
| `R2_SECRET_KEY` | R2 API Secret Access Key | `xyz789...` |
| `FIREBASE_PROJECT_ID` | Firebase project identifier | `my-app-12345` |
| `ACCOUNT_ID` | Cloudflare Account ID | `def456...` |
| `BUCKET_NAME` | R2 bucket name | `cupping-care` |
| `SIGNED_URL_TTL_SECONDS` | Signed URL expiration time in seconds (optional) | `900` (15 min) |

## Testing the Deployment

1. **Get your Worker URL** from Cloudflare Dashboard
2. **Get a Firebase ID token** from your client app
3. **Test the API** (see TESTING.md for examples)

## Troubleshooting

### Common Issues:

1. **401 Unauthorized**: Check Firebase token is valid and not expired
2. **404 Not Found**: Verify file exists in R2 bucket with correct path
3. **500 Internal Server Error**: Check Worker logs with `npx wrangler tail`
4. **CORS Issues**: Ensure your client includes Authorization header

### Viewing Logs:

```bash
# Real-time logs
npx wrangler tail --env production

# Recent logs
npx wrangler tail --env production --since 10m
```