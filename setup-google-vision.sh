#!/bin/bash

echo "========================================="
echo "Google Vision API Setup for EasyRecord"
echo "========================================="
echo ""

# Check if user has the service account JSON file
echo "Before proceeding, make sure you have:"
echo "1. Your Google Cloud service account JSON file"
echo "2. Vision API enabled in your Google Cloud project"
echo ""
read -p "Do you have your service account JSON file ready? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo ""
    echo "Please follow these steps to get your service account JSON:"
    echo "1. Go to https://console.cloud.google.com"
    echo "2. Select your project"
    echo "3. Go to 'IAM & Admin' > 'Service Accounts'"
    echo "4. Create a new service account or use existing one"
    echo "5. Add role: 'Cloud Vision API User'"
    echo "6. Create a new JSON key and download it"
    echo ""
    echo "Also make sure Vision API is enabled:"
    echo "1. Go to 'APIs & Services' > 'Enabled APIs'"
    echo "2. Search for 'Cloud Vision API'"
    echo "3. Click 'Enable' if not already enabled"
    echo ""
    exit 1
fi

echo ""
echo "Please provide the path to your service account JSON file:"
read -p "Path to JSON file: " json_path

# Check if file exists
if [ ! -f "$json_path" ]; then
    echo "Error: File not found at $json_path"
    exit 1
fi

# Extract values from JSON
echo ""
echo "Extracting credentials from JSON file..."

# Check if jq is installed
if ! command -v jq &> /dev/null
then
    echo "Installing jq for JSON parsing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install jq
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y jq
    else
        echo "Please install jq manually: https://stedolan.github.io/jq/download/"
        exit 1
    fi
fi

# Extract client_email and private_key
CLIENT_EMAIL=$(jq -r '.client_email' "$json_path")
PRIVATE_KEY=$(jq -r '.private_key' "$json_path")

if [ -z "$CLIENT_EMAIL" ] || [ -z "$PRIVATE_KEY" ]; then
    echo "Error: Could not extract credentials from JSON file"
    echo "Make sure the file is a valid service account JSON"
    exit 1
fi

echo "✓ Successfully extracted credentials"
echo ""
echo "Client Email: $CLIENT_EMAIL"
echo ""

# Set up Supabase secrets
echo "Setting up Supabase Edge Function secrets..."
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null
then
    echo "Error: Supabase CLI not found. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Set the secrets
echo "Setting GOOGLE_CLIENT_EMAIL..."
npx supabase secrets set GOOGLE_CLIENT_EMAIL="$CLIENT_EMAIL"

echo ""
echo "Setting GOOGLE_PRIVATE_KEY..."
npx supabase secrets set GOOGLE_PRIVATE_KEY="$PRIVATE_KEY"

echo ""
echo "✓ Secrets configured successfully!"
echo ""
echo "Next steps:"
echo "1. Deploy the Edge Function:"
echo "   npx supabase functions deploy process-ocr"
echo ""
echo "2. Test your setup by uploading an image in the dashboard"
echo ""
echo "========================================="
echo "Setup completed successfully!"
echo "========================================="