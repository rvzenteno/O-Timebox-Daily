@echo off
REM TimeBox Daily - Automated GitHub Push Script (Windows)
REM This script will push your plugin to: https://github.com/rvzenteno/O-Timebox-Daily.git

setlocal enabledelayedexpansion

echo ========================================
echo  TimeBox Daily - GitHub Push Script
echo ========================================
echo.

REM Configuration
set REPO_URL=https://github.com/rvzenteno/O-Timebox-Daily.git
set BRANCH=main
set COMMIT_MESSAGE=Initial commit: TimeBox Daily v1.2.0 with multi-day carry forward

REM Check if we're in the right directory
if not exist "manifest.json" (
    echo [ERROR] manifest.json not found!
    echo Please run this script from the timebox-plugin directory
    pause
    exit /b 1
)

echo [OK] Found manifest.json - in correct directory
echo.

REM Check if Git is installed
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Git is not installed!
    echo Please install Git from: https://git-scm.com/downloads
    pause
    exit /b 1
)

echo [OK] Git is installed
echo.

REM Step 1: Initialize Git repository
echo Step 1: Initializing Git repository...
if exist ".git" (
    echo [WARN] Git repository already initialized
) else (
    git init
    echo [OK] Git repository initialized
)
echo.

REM Step 2: Set up README
echo Step 2: Setting up README...
if exist "README-GITHUB.md" (
    echo Found README-GITHUB.md - using it as main README
    copy /Y README-GITHUB.md README.md >nul
    echo [OK] README.md updated with GitHub-ready version
) else (
    echo [WARN] README-GITHUB.md not found, using existing README.md
)
echo.

REM Step 3: Add all files
echo Step 3: Adding files to Git...
git add .
echo [OK] All files staged for commit
echo.

REM Step 4: Show what will be committed
echo Files to be committed:
git status --short
echo.

REM Step 5: Create commit
echo Step 4: Creating commit...
git rev-parse --verify HEAD >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [WARN] Commits already exist in repository
    set /p custom_message="Enter commit message (or press Enter to skip): "
    if not "!custom_message!"=="" (
        git add .
        git commit -m "!custom_message!"
        echo [OK] New commit created
    ) else (
        echo [INFO] Skipping new commit
    )
) else (
    git commit -m "%COMMIT_MESSAGE%"
    echo [OK] Initial commit created
)
echo.

REM Step 6: Check and add remote
echo Step 5: Setting up GitHub remote...
git remote | findstr /C:"origin" >nul
if %ERRORLEVEL% equ 0 (
    for /f "delims=" %%i in ('git remote get-url origin') do set EXISTING_REMOTE=%%i
    if not "!EXISTING_REMOTE!"=="%REPO_URL%" (
        echo [WARN] Remote 'origin' exists but points to different URL
        echo Existing: !EXISTING_REMOTE!
        echo Expected: %REPO_URL%
        set /p update_remote="Update remote URL? (y/n): "
        if /i "!update_remote!"=="y" (
            git remote set-url origin %REPO_URL%
            echo [OK] Remote URL updated
        )
    ) else (
        echo [OK] Remote 'origin' already configured correctly
    )
) else (
    git remote add origin %REPO_URL%
    echo [OK] Remote 'origin' added
)
echo.

REM Step 7: Check current branch name
echo Step 6: Checking branch name...
for /f "delims=" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i
if not "!CURRENT_BRANCH!"=="%BRANCH%" (
    echo Current branch: !CURRENT_BRANCH!
    echo Renaming to: %BRANCH%
    git branch -M %BRANCH%
    echo [OK] Branch renamed to %BRANCH%
) else (
    echo [OK] Already on branch: %BRANCH%
)
echo.

REM Step 8: Push to GitHub
echo Step 7: Pushing to GitHub...
echo.
echo [WARN] You may be asked for your GitHub credentials:
echo   Username: rvzenteno
echo   Password: Use a Personal Access Token (NOT your GitHub password)
echo   Token can be created at: https://github.com/settings/tokens
echo.

set /p confirm_push="Ready to push? (y/n): "
if /i "%confirm_push%"=="y" (
    git push -u origin %BRANCH%
    if %ERRORLEVEL% equ 0 (
        echo.
        echo [OK] Successfully pushed to GitHub!
        echo.
        echo Your repository is now live at:
        echo   %REPO_URL%
        echo.
        echo Next steps:
        echo   1. Visit: https://github.com/rvzenteno/O-Timebox-Daily
        echo   2. Verify all files are there
        echo   3. Create a release (see HOW-TO-PUSH-TO-GITHUB.md^)
        echo   4. Share your plugin with others!
    ) else (
        echo.
        echo [ERROR] Push failed!
        echo.
        echo Common issues:
        echo   - Authentication failed: Make sure you're using a Personal Access Token
        echo   - Remote rejected: Repository might not be empty (pull first^)
        echo.
        echo Try these commands manually:
        echo   git pull origin main --allow-unrelated-histories
        echo   git push -u origin main
        pause
        exit /b 1
    )
) else (
    echo [INFO] Push cancelled
    echo You can push manually later with: git push -u origin main
)

echo.
echo [OK] Script complete!
echo.
pause
