FROM gradle:8.14-jdk17 AS build
WORKDIR /app
COPY build.gradle.kts settings.gradle.kts gradle.properties ./
COPY gradle gradle
COPY src src
RUN gradle bootJar --no-daemon -Dorg.gradle.java.home=/opt/java/openjdk

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 3000
ENTRYPOINT ["java", "-jar", "app.jar"]
