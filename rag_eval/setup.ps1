# Windows setup for rag_eval (Python via py launcher)
$ErrorActionPreference = "Stop"

$PythonRoot = "$env:LOCALAPPDATA\Python\pythoncore-3.14-64"
$ScriptsDir = Join-Path $PythonRoot "Scripts"
$RagEvalDir = $PSScriptRoot

Write-Host "=== Python / pip checks ===" -ForegroundColor Cyan

function Test-CommandVersion {
    param([string]$Label, [scriptblock]$Command)
    Write-Host "`n[$Label]"
    try {
        & $Command
    } catch {
        Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Test-CommandVersion "python --version" { python --version }
Test-CommandVersion "py --version" { py --version }
Test-CommandVersion "py -m pip --version" { py -m pip --version }
Test-CommandVersion "pip --version" { pip --version }

# Use real Python for this PowerShell session (fixes python if Store alias is disabled later)
if (Test-Path $PythonRoot) {
    $env:Path = "$PythonRoot;$ScriptsDir;" + $env:Path
    Write-Host "`nSession PATH updated to prefer: $PythonRoot" -ForegroundColor Green
}

Write-Host "`n=== Recommended commands (this machine) ===" -ForegroundColor Cyan
Write-Host "cd `"$RagEvalDir`""
Write-Host "py -m pip install -r requirements.txt"
Write-Host "py evaluator.py"

Write-Host "`n=== Optional: make python/pip work in every new terminal ===" -ForegroundColor Cyan
Write-Host "1. Settings -> Apps -> Advanced app settings -> App execution aliases"
Write-Host "   Turn OFF: python.exe and python3.exe (Store stubs)"
Write-Host "2. Add to User PATH (first):"
Write-Host "   $PythonRoot"
Write-Host "   $ScriptsDir"

$install = Read-Host "`nInstall rag_eval requirements now? (y/N)"
if ($install -eq "y" -or $install -eq "Y") {
    Set-Location $RagEvalDir
    py -m pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nInstall failed. Python 3.14 may lack wheels for some RAGAS deps." -ForegroundColor Yellow
        Write-Host "Try Python 3.12, then:"
        Write-Host "  winget install Python.Python.3.12"
        Write-Host "  py -3.12 -m pip install -r requirements.txt"
        exit $LASTEXITCODE
    }
    Write-Host "`nDone. Run evaluation with: py evaluator.py" -ForegroundColor Green
}
