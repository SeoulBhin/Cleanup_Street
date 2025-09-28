# Stage 1: Build
FROM public.ecr.aws/docker/library/gradle:8.10.2-jdk17-alpine AS builder
WORKDIR /app
COPY build.gradle settings.gradle ./
COPY gradle gradle
COPY src ./src
RUN gradle bootJar --no-daemon

# Stage 2: Run
FROM public.ecr.aws/docker/library/openjdk:17-jdk-slim
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
