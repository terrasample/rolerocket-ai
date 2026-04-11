
# PowerShell script to load .env and trigger Render deployment
# Loads RENDER_API_KEY from backend/.env and triggers deployment

# Load .env file (assumes script is in project root or adjust path as needed)
$envPath = "backend/.env"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match "^(RENDER_API_KEY)=(.*)$") {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
}

if (-not $env:RENDER_API_KEY) {
    Write-Host "RENDER_API_KEY not found in .env. Please check your .env file."
    exit 1
}

$headers = @{ "Authorization" = "Bearer $env:RENDER_API_KEY" }
Invoke-RestMethod -Uri "https://api.render.com/deploy/srv-d76sljoule4c7395cphg/deploys" -Headers $headers -Method Post
Write-Host "Deployment triggered. Check your Render dashboard for status."
