@echo off
:: Check for Admin permissions
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Admin permissions confirmed.
    echo [OK] Starting RDP Ultimate Automation...
    PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0RDP_Ultimate.ps1" -AutoStart
) else (
    echo [!] Requesting Admin privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit
)
