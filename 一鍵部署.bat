@echo off
chcp 65001 >nul
cd /d %~dp0

echo.
echo ==========================================
echo    LifeOS-Shop  一鍵部署
echo ==========================================
echo.

set /p msg="這次改了什麼? (例: 修 shop bug): "
if "%msg%"=="" set msg=update

echo.
echo [1/3] 加入變更檔案...
git add .

echo [2/3] 建立 commit...
git commit -m "%msg%"

echo [3/3] 推到 GitHub...
git push

echo.
echo ==========================================
echo    完成！雲端正在自動混淆 + 部署
echo    約 2-3 分鐘後網址會更新:
echo    https://emineokur221105-spec.github.io/lifeos-shop/
echo ==========================================
echo.
pause
