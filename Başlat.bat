@echo off
chcp 65001 > nul
title Pratik Hub - Başlatılıyor...
color 0A

echo.
echo  ██████╗ ██████╗  █████╗ ████████╗██╗██╗  ██╗    ██╗  ██╗██╗   ██╗██████╗ 
echo  ██╔══██╗██╔══██╗██╔══██╗╚══██╔══╝██║██║ ██╔╝    ██║  ██║██║   ██║██╔══██╗
echo  ██████╔╝██████╔╝███████║   ██║   ██║█████╔╝     ███████║██║   ██║██████╔╝
echo  ██╔═══╝ ██╔══██╗██╔══██║   ██║   ██║██╔═██╗     ██╔══██║██║   ██║██╔══██╗
echo  ██║     ██║  ██║██║  ██║   ██║   ██║██║  ██╗    ██║  ██║╚██████╔╝██████╔╝
echo  ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝╚═╝  ╚═╝    ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ 
echo.
echo  Minimalist Calisma Istasyonu
echo ═══════════════════════════════════════════════════════════════════
echo.

:: Proje klasörüne git
cd /d "%~dp0"

:: Node.js kontrolü
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [HATA] Node.js bulunamadi! Lutfen nodejs.org adresinden yukleyin.
    pause
    exit /b 1
)

:: node_modules kontrolü
if not exist "node_modules" (
    echo  [BILGI] Ilk kurulum yapiliyor, lutfen bekleyin...
    echo.
    call npm install
    echo.
)

echo  [OK] Sunucu baslatiliyor ve tarayici aciliyor...
echo.
echo  Kapatmak icin bu pencereyi kapatin.
echo ═══════════════════════════════════════════════════════════════════

:: Sunucuyu başlat + tarayıcıyı otomatik aç
npx vite --open
