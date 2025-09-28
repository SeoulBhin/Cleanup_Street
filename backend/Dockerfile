FROM gradle:jdk17-alpine AS builder

WORKDIR /app

#  Gradle 설정 파일과 소스 코드를 복사
COPY build.gradle settings.gradle ./
COPY src ./src

# Gradle을 사용하여 실행 가능한 JAR 파일을 빌드
RUN gradle bootJar

#  최적화된 OpenJDK 런타임 이미지를 사용
FROM openjdk:17-jdk-slim-buster

WORKDIR /app

# 빌드 스테이지에서 생성된 JAR 파일을 최종 이미지로 복사
COPY --from=builder /app/build/libs/*.jar app.jar 

# 스프링부트 기본 포트 8080
EXPOSE 8080

CMD ["java", "-jar", "app.jar"]