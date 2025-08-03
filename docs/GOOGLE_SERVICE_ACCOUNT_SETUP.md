# Google Service Account Setup for Vision API

## Overview

This guide shows how to use Google Service Account credentials (private key and client email) to authenticate with Google Vision API in the EasyRecord OCR system.

## Why Service Account?

Service accounts are more secure than API keys because:
- ✅ Fine-grained permissions control
- ✅ Can be scoped to specific APIs
- ✅ Better audit trail
- ✅ Key rotation capability
- ✅ No quotas on API key usage

## Setup Steps

### 1. Get Your Service Account Credentials

From your Google Cloud Console, you should have a JSON file that looks like this:

```json
{
  "type": "service_account",
  "project_id": "your-project",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

### 2. Set Supabase Edge Function Secrets

You need to set two environment variables in Supabase:

```bash
# Set the client email
npx supabase secrets set GOOGLE_CLIENT_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"

# Set the private key (copy the entire private key including BEGIN/END lines)
npx supabase secrets set GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
```

**Important**: When setting the private key:
- Include the full key with `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Keep the `\n` characters as they are
- Wrap the entire key in quotes

### 3. Verify Vision API is Enabled

Make sure Vision API is enabled in your Google Cloud project:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Go to "APIs & Services" → "Enabled APIs"
4. Search for "Cloud Vision API"
5. If not enabled, click "Enable"

### 4. Deploy the Edge Function

Deploy the updated Edge Function with service account support:

```bash
cd supabase
npx supabase functions deploy process-ocr
```

### 5. Test the Setup

The Edge Function will now:
1. Use your service account credentials to get an access token
2. Use the access token to call Vision API
3. Process images with high accuracy

## How It Works

```mermaid
graph TD
    A[Edge Function Starts] --> B[Read Service Account Credentials]
    B --> C[Create JWT Token]
    C --> D[Sign JWT with Private Key]
    D --> E[Exchange JWT for Access Token]
    E --> F[Call Vision API with Bearer Token]
    F --> G[Process OCR Results]
```

## Troubleshooting

### "Failed to get access token"
- Check that both `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` are set correctly
- Verify the private key includes the BEGIN/END lines
- Ensure the service account has Vision API permissions

### "Vision API error"
- Verify Vision API is enabled in your Google Cloud project
- Check service account has the necessary roles (Cloud Vision API User)

### Viewing Logs
```bash
npx supabase functions logs process-ocr
```

## Security Best Practices

1. **Never commit credentials**: Keep them in environment variables only
2. **Use least privilege**: Give service account only Vision API access
3. **Rotate keys regularly**: Generate new private keys periodically
4. **Monitor usage**: Check Google Cloud Console for unusual activity

## Alternative: Using API Key

If you prefer to use an API key instead of service account:

1. Comment out the service account code
2. Set the API key:
   ```bash
   npx supabase secrets set GOOGLE_VISION_API_KEY="your-api-key"
   ```
3. The function will automatically fall back to API key authentication

## Cost

- Same pricing as API key usage: $1.50 per 1000 images
- No additional cost for using service account authentication