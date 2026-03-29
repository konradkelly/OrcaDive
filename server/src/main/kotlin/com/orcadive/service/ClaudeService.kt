package com.orcadive.service

import com.fasterxml.jackson.databind.JsonNode
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.web.reactive.function.client.WebClient

@Service
class ClaudeService(
    @Value("\${app.anthropic.api-key}") private val apiKey: String,
) {
    private val log = LoggerFactory.getLogger(ClaudeService::class.java)

    private val webClient = WebClient.builder()
        .baseUrl("https://api.anthropic.com")
        .build()

    fun suggestStatus(activityLines: List<String>): String? {
        if (activityLines.isEmpty()) return null

        val prompt = activityLines.joinToString("\n")

        return try {
            val body = mapOf(
                "model" to "claude-sonnet-4-20250514",
                "max_tokens" to 80,
                "messages" to listOf(
                    mapOf(
                        "role" to "user",
                        "content" to "Based on this developer's recent GitHub activity, " +
                            "summarize in one casual sentence (max 20 words) what they worked on. " +
                            "Activity:\n$prompt",
                    ),
                ),
            )

            val response = webClient.post()
                .uri("/v1/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(JsonNode::class.java)
                .block() ?: return null

            response.path("content").firstOrNull()?.path("text")?.asText()
        } catch (e: Exception) {
            log.warn("Claude API call failed", e)
            null
        }
    }
}
