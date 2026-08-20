@echo off
REM Backend startup script for Windows

echo Starting Python Backend for IntouchPay...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/
    pause
    exit /b 1
)

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install/update dependencies
echo Installing dependencies...
pip install -r requirements.txt

REM Create .env if it doesn't exist
if not exist ".env" (
    echo Creating .env file from example...
    copy .env.example .env
    echo Please update .env with your credentials!
)

REM Start the server
echo.
echo Starting server on http://localhost:8000
echo API docs available at http://localhost:8000/docs
echo.
python main.py

pause
