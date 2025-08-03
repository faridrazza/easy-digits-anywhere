# Gemini Vision API Setup for EasyRecord

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Gemini Vision API Setup for EasyRecord" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "This will set up Gemini Vision API for better table extraction." -ForegroundColor Yellow
Write-Host ""
Write-Host "You need a Gemini API key from Google AI Studio:" -ForegroundColor Yellow
Write-Host "1. Go to https://makersuite.google.com/app/apikey"
Write-Host "2. Click 'Create API Key'"
Write-Host "3. Copy the generated key"
Write-Host ""

$ready = Read-Host "Do you have your Gemini API key ready? (y/n)"

if ($ready -ne 'y' -and $ready -ne 'Y') {
    Write-Host "Please get your API key first and run this script again." -ForegroundColor Red
    exit
}

Write-Host ""
$apiKey = Read-Host "Enter your Gemini API key" -AsSecureString
$apiKeyPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($apiKey))

if ([string]::IsNullOrEmpty($apiKeyPlain)) {
    Write-Host "Error: API key cannot be empty" -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "Setting up Supabase secret..." -ForegroundColor Yellow

# Set the Gemini API key
& npx supabase secrets set GEMINI_API_KEY="$apiKeyPlain"

Write-Host ""
Write-Host "✓ Gemini API key configured successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Now deploy the Edge Function:" -ForegroundColor Yellow
Write-Host "  npx supabase functions deploy process-ocr" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your OCR should now work with high accuracy!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan