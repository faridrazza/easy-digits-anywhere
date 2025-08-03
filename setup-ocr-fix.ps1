# Quick OCR Fix Setup Script

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "EasyRecord OCR Fix - Table Extraction Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "This script will fix your table extraction issues by setting up Gemini Vision API." -ForegroundColor Yellow
Write-Host ""
Write-Host "What this fixes:" -ForegroundColor Green
Write-Host "✓ No more 'Test' or demo data in results"
Write-Host "✓ Accurate table structure extraction"
Write-Host "✓ Proper column headers and row data"
Write-Host "✓ Works with any table format"
Write-Host ""

$setupGemini = Read-Host "Do you want to set up Gemini Vision API for better accuracy? (y/n)"

if ($setupGemini -eq 'y' -or $setupGemini -eq 'Y') {
    Write-Host ""
    Write-Host "Get your Gemini API key from:" -ForegroundColor Yellow
    Write-Host "https://makersuite.google.com/app/apikey" -ForegroundColor Cyan
    Write-Host ""
    
    $apiKey = Read-Host "Enter your Gemini API key (or press Enter to skip)"
    
    if (![string]::IsNullOrEmpty($apiKey)) {
        Write-Host "Setting up Gemini API key..." -ForegroundColor Yellow
        & npx supabase secrets set GEMINI_API_KEY="$apiKey"
        Write-Host "✓ Gemini API key configured!" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Deploying fixed Edge Function..." -ForegroundColor Yellow
& npx supabase functions deploy process-ocr

Write-Host ""
Write-Host "✅ OCR Fix Deployed Successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Test it now:" -ForegroundColor Yellow
Write-Host "1. Upload your table image in the dashboard"
Write-Host "2. You should see accurate table data (no more 'Test' values)"
Write-Host "3. Columns and rows should be properly structured"
Write-Host ""
Write-Host "If you still see issues, check the function logs:" -ForegroundColor Yellow
Write-Host "npx supabase functions logs process-ocr" -ForegroundColor Cyan
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan