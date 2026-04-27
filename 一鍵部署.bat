@echo off
cd /d %~dp0

echo.
echo ==========================================
echo    LifeOS-Shop  Deploy
echo ==========================================
echo.

set /p msg="Commit message (default: update): "
if "%msg%"=="" set msg=update

echo.
echo [1/3] git add ...
git add .

echo [2/3] git commit ...
git commit -m "%msg%"

echo [3/3] git push ...
git push

echo.
echo ==========================================
echo    Done. GitHub Actions is building now.
echo    Site: https://emineokur221105-spec.github.io/lifeos-shop/
echo ==========================================
echo.
pause
