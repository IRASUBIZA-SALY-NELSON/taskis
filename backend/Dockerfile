FROM eclipse-temurin:17-jdk-jammy AS build
WORKDIR /app
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -q -DskipTests dependency:go-offline
COPY src ./src
RUN ./mvnw -q -DskipTests package

FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
RUN mkdir -p /app/data /app/uploads
COPY --from=build /app/target/taskis.jar /app/taskis.jar
EXPOSE 8080
ENV JAVA_OPTS="-Xmx384m"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/taskis.jar"]
