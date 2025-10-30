FROM maven:3.9.9-eclipse-temurin-21 AS builder

WORKDIR /workspace

COPY pom.xml ./
RUN mvn -ntp dependency:go-offline

COPY src ./src
RUN mvn -ntp clean package

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY --from=builder /workspace/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]

