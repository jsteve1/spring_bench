package com.springbench.insurance.legacy;

import io.restassured.RestAssured;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.notNullValue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("benchmark")
class ContractIntegrationTest {

    private static Path dbFile;

    @DynamicPropertySource
    static void configureDb(DynamicPropertyRegistry registry) throws IOException {
        dbFile = Files.createTempFile("contract-legacy-", ".db");
        registry.add("DB_PATH", () -> dbFile.toAbsolutePath().toString().replace('\\', '/'));
    }

    @LocalServerPort
    int port;

    @BeforeEach
    void configureRestAssured() {
        RestAssured.reset();
        RestAssured.baseURI = "http://127.0.0.1";
        RestAssured.port = port;
        RestAssured.enableLoggingOfRequestAndResponseIfValidationFails();
    }

    @Test
    void healthReturnsUpWithRequestId() {
        given()
                .when().get("/health")
                .then()
                .statusCode(200)
                .body("status", equalTo("UP"))
                .header("X-Request-Id", notNullValue());
    }

    @Test
    void createAndGetMember() {
        String memberId =
                given()
                        .contentType("application/json")
                        .body("{\n"
                                + "  \"demographics\": {\n"
                                + "    \"fname\": \"Jane\",\n"
                                + "    \"lname\": \"Doe\",\n"
                                + "    \"email\": \"jane.doe@example.com\",\n"
                                + "    \"phoneNumber\": \"+1-555-0100\",\n"
                                + "    \"status\": \"ALIVE\"\n"
                                + "  },\n"
                                + "  \"agreementId\": null\n"
                                + "}")
                        .when().post("/members")
                        .then()
                        .statusCode(201)
                        .header("Location", notNullValue())
                        .header("X-Request-Id", notNullValue())
                        .body("id", notNullValue())
                        .body("status", equalTo("ACTIVE"))
                        .body("demographics.email", equalTo("jane.doe@example.com"))
                        .extract().path("id");

        given()
                .when().get("/members/" + memberId)
                .then()
                .statusCode(200)
                .body("id", equalTo(memberId))
                .body("demographics.fname", equalTo("Jane"));
    }

    @Test
    void listMembersReturnsPaginationEnvelope() {
        given().contentType("application/json").body(validMemberBody("list-a@example.com")).when().post("/members");
        given().contentType("application/json").body(validMemberBody("list-b@example.com")).when().post("/members");

        given()
                .queryParam("page", 0)
                .queryParam("size", 1)
                .queryParam("sort", "created,desc")
                .when().get("/members")
                .then()
                .statusCode(200)
                .body("page", equalTo(0))
                .body("size", equalTo(1))
                .body("totalElements", greaterThanOrEqualTo(2))
                .body("totalPages", greaterThanOrEqualTo(2))
                .body("sort", equalTo("created,desc"))
                .body("content.size()", equalTo(1));
    }

    @Test
    void validationFailureReturns400ProblemDetails() {
        given()
                .contentType("application/json")
                .body("{\n"
                        + "  \"demographics\": {\n"
                        + "    \"fname\": \"\",\n"
                        + "    \"lname\": \"Doe\",\n"
                        + "    \"email\": \"not-an-email\",\n"
                        + "    \"phoneNumber\": \"+1-555-0100\",\n"
                        + "    \"status\": \"ALIVE\"\n"
                        + "  }\n"
                        + "}")
                .when().post("/members")
                .then()
                .statusCode(400)
                .contentType("application/problem+json")
                .body("status", equalTo(400))
                .body("title", equalTo("Validation failed"))
                .body("requestId", notNullValue())
                .body("errors", notNullValue());
    }

    @Test
    void unknownMemberReturns404() {
        given()
                .when().get("/members/00000000-0000-4000-8000-000000000099")
                .then()
                .statusCode(404)
                .contentType("application/problem+json")
                .body("status", equalTo(404))
                .body("title", equalTo("Not found"));
    }

    @Test
    void archivedMemberCannotBeReactivated() {
        String memberId =
                given()
                        .contentType("application/json")
                        .body(validMemberBody("archive@example.com"))
                        .when().post("/members")
                        .then()
                        .statusCode(201)
                        .extract().path("id");

        given().when().delete("/members/" + memberId).then().statusCode(200);

        given()
                .contentType("application/json")
                .body("{\"status\":\"ACTIVE\"}")
                .when().put("/members/" + memberId)
                .then()
                .statusCode(409)
                .contentType("application/problem+json")
                .body("status", equalTo(409))
                .body("title", equalTo("Conflict"));
    }

    @Test
    void openApiDocumentIsAvailable() {
        given()
                .when().get("/v3/api-docs")
                .then()
                .statusCode(200)
                .body("openapi", notNullValue())
                .body("paths.'/members'.post", notNullValue())
                .body("paths.'/health'.get", notNullValue());
    }

    private static String validMemberBody(String email) {
        return "{\n"
                + "  \"demographics\": {\n"
                + "    \"fname\": \"Jane\",\n"
                + "    \"lname\": \"Doe\",\n"
                + "    \"email\": \"" + email + "\",\n"
                + "    \"phoneNumber\": \"+1-555-0100\",\n"
                + "    \"status\": \"ALIVE\"\n"
                + "  }\n"
                + "}";
    }
}
