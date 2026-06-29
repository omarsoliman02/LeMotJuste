# --- Étape 1 : build ---
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
# Cache des dépendances : on copie d'abord le pom seul.
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q clean package -DskipTests

# --- Étape 2 : runtime ---
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
