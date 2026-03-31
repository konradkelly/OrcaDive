package com.orcadive.service

import com.fasterxml.jackson.databind.JsonNode
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.WebClientResponseException

@Service
class GitHubService(
    @Value("\${app.github.client-id}") private val clientId: String,
    @Value("\${app.github.client-secret}") private val clientSecret: String,
) {
    private val log = LoggerFactory.getLogger(GitHubService::class.java)
    private val webClient = WebClient.builder()
        .baseUrl("https://api.github.com")
        .defaultHeader("Accept", "application/json")
        .build()

    /** Exchange an OAuth code for an access token. */
    fun exchangeCode(code: String, redirectUri: String? = null, codeVerifier: String? = null): String? {
        log.info("Exchanging code (len={}), redirectUri={}, hasCodeVerifier={}", code.length, redirectUri, codeVerifier != null)

        val formData = LinkedMultiValueMap<String, String>()
        formData.add("client_id", clientId)
        formData.add("client_secret", clientSecret)
        formData.add("code", code)
        if (redirectUri != null) formData.add("redirect_uri", redirectUri)
        if (codeVerifier != null) formData.add("code_verifier", codeVerifier)

        return try {
            val response = WebClient.create("https://github.com")
                .post()
                .uri("/login/oauth/access_token")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .bodyValue(formData)
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .bodyToMono(JsonNode::class.java)
                .block()

            if (response == null) {
                log.error("GitHub token exchange returned null")
                return null
            }

            log.info("GitHub token response keys: {}", response.fieldNames().asSequence().toList())
            val error = response.path("error").asText(null)
            if (error != null) {
                log.error("GitHub token error: {} - {}", error, response.path("error_description").asText(""))
                return null
            }

            response.path("access_token").asText(null)
        } catch (e: WebClientResponseException) {
            log.error("GitHub token exchange failed: {} - {}", e.statusCode, e.responseBodyAsString)
            null
        }
    }

    /** Fetch the authenticated user's profile. */
    fun fetchUser(accessToken: String): GitHubUser? {
        val node = webClient.get()
            .uri("/user")
            .header("Authorization", "Bearer $accessToken")
            .retrieve()
            .bodyToMono(JsonNode::class.java)
            .block() ?: return null

        return GitHubUser(
            id = node.path("id").asLong(),
            login = node.path("login").asText(),
            name = node.path("name").asText(node.path("login").asText()),
            avatarUrl = node.path("avatar_url").asText(null),
        )
    }

    /** Fetch open pull requests for a repo. */
    fun fetchOpenPRs(repo: String, accessToken: String): List<JsonNode> {
        val node = webClient.get()
            .uri("/repos/$repo/pulls?state=open&per_page=20")
            .header("Authorization", "Bearer $accessToken")
            .retrieve()
            .bodyToMono(Array<JsonNode>::class.java)
            .block() ?: return emptyList()

        return node.toList()
    }

    /** Fetch recent events for a user (for AI status suggestion). */
    fun fetchUserEvents(username: String, accessToken: String): List<JsonNode> {
        val node = webClient.get()
            .uri("/users/$username/events?per_page=30")
            .header("Authorization", "Bearer $accessToken")
            .retrieve()
            .bodyToMono(Array<JsonNode>::class.java)
            .block() ?: return emptyList()

        return node.toList()
    }

    data class GitHubUser(
        val id: Long,
        val login: String,
        val name: String,
        val avatarUrl: String?,
    )
}
