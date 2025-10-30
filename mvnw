#!/bin/sh
set -e
BASE_DIR=$(cd "$(dirname "$0")" && pwd -P)
WRAPPER_JAR="$BASE_DIR/.mvn/wrapper/maven-wrapper.jar"
WRAPPER_MAIN_CLASS="org.apache.maven.wrapper.MavenWrapperMain"
JAVA_EXECUTABLE="java"
if [ -n "$JAVA_HOME" ]; then
  JAVA_EXECUTABLE="$JAVA_HOME/bin/java"
fi
if [ ! -f "$WRAPPER_JAR" ]; then
  echo "Wrapper JAR not found" >&2
  exit 1
fi
exec "$JAVA_EXECUTABLE" -Dmaven.multiModuleProjectDirectory="$BASE_DIR" -classpath "$WRAPPER_JAR" "$WRAPPER_MAIN_CLASS" "$@"

