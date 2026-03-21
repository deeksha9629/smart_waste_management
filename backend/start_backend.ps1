param(
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$localVenvPython = Join-Path $projectRoot ".venv\Scripts\python.exe"
$parentVenvPython = Join-Path (Split-Path -Parent $projectRoot) ".venv\Scripts\python.exe"

if (Test-Path $localVenvPython) {
    $pythonExe = $localVenvPython
} elseif (Test-Path $parentVenvPython) {
    $pythonExe = $parentVenvPython
} else {
    Write-Host "Virtual environment not found. Creating backend/.venv with Python 3.12..." -ForegroundColor Yellow
    & "C:/Users/Admin/AppData/Local/Programs/Python/Python312/python.exe" -m venv .venv
    $pythonExe = $localVenvPython
}

Write-Host "Installing dependencies..." -ForegroundColor Cyan
& $pythonExe -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Error "Dependency installation failed."
    exit $LASTEXITCODE
}

Write-Host "Starting backend on http://127.0.0.1:$Port" -ForegroundColor Green
& $pythonExe -m uvicorn app.main:app --host 127.0.0.1 --port $Port --reload
