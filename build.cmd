@echo off
chcp 65001 >nul
rem KIS 사이트 빌드 — 더블클릭 한 번으로 cards/*.md → index.html 재생성.
rem 포터블 Node 환경을 먼저 로드한다.
call C:\ai-dev\scripts\env.cmd >nul 2>&1
cd /d "%~dp0"
echo [KIS] 빌드 중... (cards/ -> index.html)
node build.js
echo.
echo [KIS] 완료. 로컬 확인: index.html 열기  /  공개 반영: git push (GitHub Pages)
pause
