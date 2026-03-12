@echo off
echo Installing required modules for Python 3.13...
C:\Users\cho\AppData\Local\Programs\Python\Python313\python.exe -m pip install aiomysql pymysql
echo Install complete! Starting uvicorn server...
cd "c:\Users\cho\Desktop\Temp\05 Code\260310_post_evaluation\backend"
C:\Users\cho\AppData\Local\Programs\Python\Python313\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pause
