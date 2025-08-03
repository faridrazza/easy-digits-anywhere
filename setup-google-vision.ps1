# Google Vision API Setup for EasyRecord

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Google Vision API Setup for EasyRecord" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if user has the service account JSON file
Write-Host "Before proceeding, make sure you have:" -ForegroundColor Yellow
Write-Host "1. Your Google Cloud service account JSON file"
Write-Host "2. Vision API enabled in your Google Cloud project"
Write-Host ""
$ready = Read-Host "Do you have your service account JSON file ready? (y/n)"

if ($ready -ne 'y' -and $ready -ne 'Y') {
    Write-Host ""
    Write-Host "Please follow these steps to get your service account JSON:" -ForegroundColor Yellow
    Write-Host "1. Go to https://console.cloud.google.com"
    Write-Host "2. Select your project"
    Write-Host "3. Go to 'IAM & Admin' > 'Service Accounts'"
    Write-Host "4. Create a new service account or use existing one"
    Write-Host "5. Add role: 'Cloud Vision API User'"
    Write-Host "6. Create a new JSON key and download it"
    Write-Host ""
    Write-Host "Also make sure Vision API is enabled:" -ForegroundColor Yellow
    Write-Host "1. Go to 'APIs & Services' > 'Enabled APIs'"
    Write-Host "2. Search for 'Cloud Vision API'"
    Write-Host "3. Click 'Enable' if not already enabled"
    Write-Host ""
    exit
}

Write-Host ""
$jsonPath = Read-Host "Please provide the path to your service account JSON file"

# Remove quotes if present
$jsonPath = $jsonPath.Trim('"')

# Check if file exists
if (-not (Test-Path $jsonPath)) {
    Write-Host "Error: File not found at $jsonPath" -ForegroundColor Red
    exit
}

# Extract values from JSON
Write-Host ""
Write-Host "Extracting credentials from JSON file..." -ForegroundColor Yellow

try {
    $json = Get-Content $jsonPath | ConvertFrom-Json
    $clientEmail = $json.client_email
    $privateKey = $json.private_key
    
    if (-not $clientEmail -or -not $privateKey) {
        throw "Missing required fields"
    }
    
    Write-Host "✓ Successfully extracted credentials" -ForegroundColor Green
    Write-Host ""
    Write-Host "Client Email: $clientEmail" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host "Error: Could not extract credentials from JSON file" -ForegroundColor Red
    Write-Host "Make sure the file is a valid service account JSON" -ForegroundColor Red
    exit
}

# Set up Supabase secrets
Write-Host "Setting up Supabase Edge Function secrets..." -ForegroundColor Yellow
Write-Host ""

# Check if npm/npx is available
try {
    $null = Get-Command npx -ErrorAction Stop
} catch {
    Write-Host "Error: npx not found. Please install Node.js first:" -ForegroundColor Red
    Write-Host "https://nodejs.org/" -ForegroundColor Red
    exit
}

# Set the secrets
Write-Host "Setting GOOGLE_CLIENT_EMAIL..." -ForegroundColor Yellow
& npx supabase secrets set GOOGLE_CLIENT_EMAIL="$clientEmail"

Write-Host ""
Write-Host "Setting GOOGLE_PRIVATE_KEY..." -ForegroundColor Yellow
& npx supabase secrets set GOOGLE_PRIVATE_KEY="$privateKey"

Write-Host ""
Write-Host "✓ Secrets configured successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Deploy the Edge Function:"
Write-Host "   npx supabase functions deploy process-ocr" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Test your setup by uploading an image in the dashboard"
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Setup completed successfully!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan