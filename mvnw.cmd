@echo off
setlocal
set BASE_DIR=%~dp0
if "%BASE_DIR%"=="" set BASE_DIR=.
if "%BASE_DIR:~-1%"=="\" set BASE_DIR=%BASE_DIR:~0,-1%
set WRAPPER_JAR=%BASE_DIR%\.mvn\wrapper\maven-wrapper.jar
set WRAPPER_MAIN_CLASS=org.apache.maven.wrapper.MavenWrapperMain
set JAVA_EXECUTABLE=java
if not "%JAVA_HOME%"=="" set JAVA_EXECUTABLE=%JAVA_HOME%\bin\java.exe
if not exist "%WRAPPER_JAR%" (
  echo Wrapper JAR not found 1>&2
  exit /b 1
)
"%JAVA_EXECUTABLE%" -Dmaven.multiModuleProjectDirectory="%BASE_DIR%" -classpath "%WRAPPER_JAR%" %WRAPPER_MAIN_CLASS% %*

