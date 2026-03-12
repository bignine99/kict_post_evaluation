@echo off
chcp 65001 >nul
title PostEval AI - Frontend 서버
cd %~dp0\frontend

:loop
echo ========================================================
echo 🚀 Next.js 프론트엔드 서버를 시작합니다... (터보팩 모드)
echo.
call npm run dev -- --turbo
echo.
echo ========================================================
echo ⚠️ 서버가 모종의 이유(메모리 부족, 파일 시스템 오류 등)로 종료되었습니다.
echo 🔄 3초 뒤에 자동으로 다시 시작합니다...
echo (서버를 완전히 종료하려면 지금 창을 닫아주세요)
echo ========================================================
timeout /t 3
goto loop
