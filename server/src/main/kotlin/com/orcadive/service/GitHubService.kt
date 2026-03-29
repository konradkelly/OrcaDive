package com.orcadive.service

import com.fasterxml.jackson.databind.JsonNode
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.web.reactive.function.client.WebClient

@Service
class GitHubService(
    @Value("\${app.github.client-id}") private val clientId: String,
    @Value("\${app.github.client-secret}") private val clientSecret: String,
) {
    private val webClient = WebClient.builder()
        .baseUrl("https://api.github.com")
        .defaultHeader("Accept", "application/json")
        .build()

    /** Exchange an OAuth code for an access token. */
    fun exchangeCode(code: String): String? {
        val response = WebClient.create("https://github.com")
            .post()
            .uri("/login/oauth/access_token")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(
                mapOf(
                    "client_id" to clientId,
                    "client_secret" to clientSecret,
                    "code" to code,
                ),
            )
            .accept(MediaType.APPLICATION_JSON)
            .retrieve()
            .bodyToMono(JsonNode::class.java)
            .block() ?: return null

        return response.path("access_token").asText(null)
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
