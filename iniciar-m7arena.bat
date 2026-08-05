@echo off
title M7Arena - Subir local
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ========================================
echo   M7Arena - iniciando ambiente Docker
echo  ========================================
echo.

echo [1/3] Iniciando WSL e daemon do Docker...
wsl -d Ubuntu -- bash -c "docker info >/dev/null 2>&1 || service docker start; sleep 2"
if errorlevel 1 (
    echo  ERRO ao iniciar o Docker. Abra o PowerShell como admin e rode:
    echo  wsl -d Ubuntu -u root -- service docker start
    pause
    exit /b 1
)

echo [2/3] Subindo a stack (postgres + api + realtime + nginx)...
wsl -d Ubuntu -- bash -c "cd /mnt/d/Aplicativos/M7arenaSite && docker compose --env-file .env.local -f infra/docker-compose.local.yml up -d"
if errorlevel 1 (
    echo  ERRO ao subir os containers.
    pause
    exit /b 1
)

echo [3/3] Recriando nginx se necessario (rede)...
wsl -d Ubuntu -- bash -c "docker inspect m7arena_local_nginx --format '{{json .NetworkSettings.Networks}}' | grep -q infra_default || (docker compose -f /mnt/d/Aplicativos/M7arenaSite/infra/docker-compose.local.yml rm -sf nginx && docker compose -f /mnt/d/Aplicativos/M7arenaSite/infra/docker-compose.local.yml up -d nginx)"

echo.
echo  Verificando http://localhost:3000 ...
ping -n 6 127.0.0.1 >nul

wsl -d Ubuntu -- bash -c "curl -s -o /dev/null -w '%%{http_code}' --connect-timeout 5 http://localhost:3000/" > "%TEMP%\m7arena_check.txt"
set /p CHECK=<"%TEMP%\m7arena_check.txt"
echo  Resposta HTTP: %CHECK%
del "%TEMP%\m7arena_check.txt" >nul 2>&1

if "%CHECK%"=="200" (
    echo.
    echo  ========================================
    echo   Pronto! Abrindo http://localhost:3000
    echo  ========================================
    start "" http://localhost:3000
) else (
    echo.
    echo  Ainda nao respondeu. Confira os containers:
    echo  wsl -d Ubuntu -- docker compose -f /mnt/d/Aplicativos/M7arenaSite/infra/docker-compose.local.yml ps
    echo  wsl -d Ubuntu -- docker logs m7arena_local_nginx
)
echo.
pause
