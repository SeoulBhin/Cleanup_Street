# Stage 1: Build
FROM gradle:jdk17-alpine AS builder
WORKDIR /app

# Gradle Wrapper 파일들 복사
COPY gradlew .
COPY gradle gradle

# build.gradle & settings.gradle 복사
COPY build.gradle settings.gradle ./

# 소스 복사
COPY src ./src

# Gradle Wrapper 실행 (캐시 문제 방지 위해 --no-daemon)
RUN chmod +x ./gradlew && ./gradlew bootJar --no-daemon --stacktrace

# Stage 2: Run
FROM openjdk:17-jdk-slim-buster
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar
ENTRYPOINT ["java","-jar","/app/app.jar"]
