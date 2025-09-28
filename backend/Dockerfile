FROM gradle:jdk17-alpine AS builder

WORKDIR /app

# gradlew & gradle 폴더 & build.gradle & settings.gradle & 소스 복사
COPY gradlew .
COPY gradle ./gradle
COPY build.gradle settings.gradle ./
COPY src ./src

# gradlew 실행 권한 부여
RUN chmod +x ./gradlew

# JAR 빌드
RUN ./gradlew --no-daemon clean bootJar

# 실행 스테이지
FROM openjdk:17-jdk-slim-buster

WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar

ENTRYPOINT ["java", "-jar", "app.jar"]
