package com.springbench.insurance.modern;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("benchmark")
class ContractIntegrationTest {

    private static Path dbFile;

    @DynamicPropertySource
    static void configureDb(DynamicPropertyRegistry registry) throws IOException {
        dbFile = Files.createTempFile("contract-modern-", ".db");
        registry.add("DB_PATH", () -> dbFile.toAbsolutePath().toString().replace('\\', '/'));
    }

    @Autowired
    RestTestClient client;

    @Test
    void healthReturnsUpWithRequestId() {
        client.get()
                .uri("/health")
                .exchange()
                .expectStatus().isOk()
                .expectHeader().exists("X-Request-Id")
                .expectBody(Map.class)
                .value(body -> {
                    org.junit.jupiter.api.Assertions.assertEquals("UP", body.get("status"));
                });
    }

    @Test
    void createAndGetMember() {
        String memberId = client.post()
                .uri("/members")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                          "demographics": {
                            "fname": "Jane",
                            "lname": "Doe",
                            "email": "jane.doe@example.com",
                            "phoneNumber": "+1-555-0100",
                            "status": "ALIVE"
                          },
                          "agreementId": null
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectHeader().exists("Location")
                .expectHeader().exists("X-Request-Id")
                .expectBody(Map.class)
                .returnResult()
                .getResponseBody()
                .get("id")
                .toString();

        client.get()
                .uri("/members/" + memberId)
                .exchange()
                .expectStatus().isOk()
                .expectBody(Map.class)
                .value(body -> {
                    org.junit.jupiter.api.Assertions.assertEquals(memberId, body.get("id"));
                    org.junit.jupiter.api.Assertions.assertEquals("Jane",
                            ((Map) body.get("demographics")).get("fname"));
                });
    }

    @Test
    void listMembersReturnsPaginationEnvelope() {
        client.post().uri("/members").contentType(MediaType.APPLICATION_JSON)
                .body(validMemberBody("list-a@example.com")).exchange().expectStatus().isCreated();
        client.post().uri("/members").contentType(MediaType.APPLICATION_JSON)
                .body(validMemberBody("list-b@example.com")).exchange().expectStatus().isCreated();

        client.get()
                .uri("/members?page=0&size=1&sort=created,desc")
                .exchange()
                .expectStatus().isOk()
                .expectBody(Map.class)
                .value(body -> {
                    org.junit.jupiter.api.Assertions.assertEquals(0, body.get("page"));
                    org.junit.jupiter.api.Assertions.assertEquals(1, body.get("size"));
                    org.junit.jupiter.api.Assertions.assertTrue(
                            ((Number) body.get("totalElements")).intValue() >= 2);
                    org.junit.jupiter.api.Assertions.assertEquals("created,desc", body.get("sort"));
                    org.junit.jupiter.api.Assertions.assertEquals(1, ((List) body.get("content")).size());
                });
    }

    @Test
    void validationFailureReturns400ProblemDetails() {
        client.post()
                .uri("/members")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                          "demographics": {
                            "fname": "",
                            "lname": "Doe",
                            "email": "not-an-email",
                            "phoneNumber": "+1-555-0100",
                            "status": "ALIVE"
                          }
                        }
                        """)
                .exchange()
                .expectStatus().isBadRequest()
                .expectHeader().contentType("application/problem+json")
                .expectBody(Map.class)
                .value(body -> {
                    org.junit.jupiter.api.Assertions.assertEquals(400, body.get("status"));
                    org.junit.jupiter.api.Assertions.assertEquals("Validation failed", body.get("title"));
                    org.junit.jupiter.api.Assertions.assertNotNull(body.get("requestId"));
                    org.junit.jupiter.api.Assertions.assertNotNull(body.get("errors"));
                });
    }

    @Test
    void unknownMemberReturns404() {
        client.get()
                .uri("/members/00000000-0000-4000-8000-000000000099")
                .exchange()
                .expectStatus().isNotFound()
                .expectHeader().contentType("application/problem+json")
                .expectBody(Map.class)
                .value(body -> {
                    org.junit.jupiter.api.Assertions.assertEquals(404, body.get("status"));
                    org.junit.jupiter.api.Assertions.assertEquals("Not found", body.get("title"));
                });
    }

    @Test
    void archivedMemberCannotBeReactivated() {
        String memberId = client.post()
                .uri("/members")
                .contentType(MediaType.APPLICATION_JSON)
                .body(validMemberBody("archive@example.com"))
                .exchange()
                .expectStatus().isCreated()
                .expectBody(Map.class)
                .returnResult()
                .getResponseBody()
                .get("id")
                .toString();

        client.delete()
                .uri("/members/" + memberId)
                .exchange()
                .expectStatus().isOk();

        client.put()
                .uri("/members/" + memberId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"status\":\"ACTIVE\"}")
                .exchange()
                .expectStatus().isEqualTo(409)
                .expectHeader().contentType("application/problem+json")
                .expectBody(Map.class)
                .value(body -> org.junit.jupiter.api.Assertions.assertEquals("Conflict", body.get("title")));
    }

    @Test
    void openApiDocumentIsAvailable() {
        client.get()
                .uri("/v3/api-docs")
                .exchange()
                .expectStatus().isOk()
                .expectBody(Map.class)
                .value(body -> {
                    org.junit.jupiter.api.Assertions.assertNotNull(body.get("openapi"));
                    org.junit.jupiter.api.Assertions.assertNotNull(((Map) body.get("paths")).get("/members"));
                    org.junit.jupiter.api.Assertions.assertNotNull(((Map) body.get("paths")).get("/health"));
                });
    }

    private static String validMemberBody(String email) {
        return """
                {
                  "demographics": {
                    "fname": "Jane",
                    "lname": "Doe",
                    "email": "%s",
                    "phoneNumber": "+1-555-0100",
                    "status": "ALIVE"
                  }
                }
                """.formatted(email);
    }
}
