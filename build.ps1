$env:BUILD_DATE = Get-Date -Format 'yyyy-MM-dd'
Write-Host "BUILD_DATE set to: $env:BUILD_DATE"
npx electron-builder --win nsis