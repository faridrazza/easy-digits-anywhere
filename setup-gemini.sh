#!/bin/bash

echo "========================================"
echo "Gemini Vision API Setup for EasyRecord"
echo "========================================"
echo ""

echo "This will set up Gemini Vision API for better table extraction."
echo ""
echo "You need a Gemini API key from Google AI Studio:"
echo "1. Go to https://makersuite.google.com/app/apikey"
echo "2. Click 'Create API Key'"
echo "3. Copy the generated key"
echo ""

read -p "Do you have your Gemini API key ready? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Please get your API key first and run this script again."
    exit 1
fi

echo ""
read -p "Enter your Gemini API key: " api_key

if [ -z "$api_key" ]; then
    echo "Error: API key cannot be empty"
    exit 1
fi

echo ""
echo "Setting up Supabase secret..."

# Set the Gemini API key
npx supabase secrets set GEMINI_API_KEY="$api_key"

echo ""
echo "✓ Gemini API key configured successfully!"
echo ""
echo "Now deploy the Edge Function:"
echo "  npx supabase functions deploy process-ocr"
echo ""
echo "Your OCR should now work with high accuracy!"
echo "========================================"