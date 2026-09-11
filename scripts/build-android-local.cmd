@echo off
setlocal

set "PROJECT_ROOT=%~dp0.."
cd /d "%PROJECT_ROOT%"
set "BUILD_ROOT=%PROJECT_ROOT%"
if not exist "C:\m\android\gradlew.bat" (
  mklink /J "C:\m" "%PROJECT_ROOT%" >nul 2>nul
)
if exist "C:\m\android\gradlew.bat" set "BUILD_ROOT=C:\m"

set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
set "ANDROID_HOME=%PROJECT_ROOT%\.android-sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
set "GRADLE_USER_HOME=C:\mg2"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\cmdline-tools\latest\bin;%ANDROID_HOME%\platform-tools;%PATH%"

echo JAVA_HOME=%JAVA_HOME%
echo ANDROID_HOME=%ANDROID_HOME%
echo GRADLE_USER_HOME=%GRADLE_USER_HOME%
java -version

if not exist "%ANDROID_HOME%\licenses" mkdir "%ANDROID_HOME%\licenses"
> "%ANDROID_HOME%\licenses\android-sdk-license" echo 8933bad161af4178b1185d1a37fbf41ea5269c55
>> "%ANDROID_HOME%\licenses\android-sdk-license" echo d56f5187479451eabf01fb78af6dfcb131a6481e
>> "%ANDROID_HOME%\licenses\android-sdk-license" echo 24333f8a63b6825ea9c5514f83c2829b004d1fee
> "%ANDROID_HOME%\licenses\android-sdk-preview-license" echo 84831b9409646a918e30573bab4c9c91346d8abd

call "%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat" "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006"
if errorlevel 1 exit /b %errorlevel%

echo sdk.dir=%ANDROID_HOME:\=\\%> "%PROJECT_ROOT%\android\local.properties"

cd /d "%BUILD_ROOT%\android"
call gradlew.bat assembleRelease
exit /b %errorlevel%
