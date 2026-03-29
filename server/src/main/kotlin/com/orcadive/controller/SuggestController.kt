package com.orcadive.controller

import com.orcadive.db.UsersTable
import com.orcadive.dto.SuggestResponse
import com.orcadive.security.currentUser
import com.orcadive.service.ClaudeService
import com.orcadive.service.GitHubService
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.time.Duration
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

@RestController
@RequestMapping("/api/ai")
class SuggestController(
    private val gitHubService: GitHubService,
    private val claudeService: ClaudeService,
) {
    @PostMapping("/suggest")
    fun suggest(): ResponseEntity<SuggestResponse> {
        val user = currentUser()

        val (username, githubToken) = transaction {
            val row = UsersTable.selectAll()
                .where { UsersTable.id eq user.userId }
                .single()
            row[UsersTable.username] to row[UsersTable.githubToken]
        }

        if (githubToken == null) {
            return ResponseEntity.ok(SuggestResponse(null))
        }

        val events = try {
            gitHubService.fetchUserEvents(username, githubToken)
        } catch (_: Exception) {
            return ResponseEntity.ok(SuggestResponse(null))
        }

        val cutoff = ZonedDateTime.now().minus(Duration.ofHours(24))

        val activityLines = events.mapNotNull { event ->
            val createdAt = try {
                ZonedDateTime.parse(event.path("created_at").asText(), DateTimeFormatter.ISO_DATE_TIME)
            } catch (_: Exception) {
                return@mapNotNull null
            }
            if (createdAt.isBefore(cutoff)) return@mapNotNull null

            val type = event.path("type").asText()
            val repo = event.path("repo").path("name").asText()
            val payload = event.path("payload")

            when (type) {
                "PushEvent" -> {
                    val commits = payload.path("commits")
                    val count = commits.size()
                    val msg = commits.lastOrNull()?.path("message")?.asText() ?: ""
                    "Pushed $count commits to $repo: $msg"
                }

                "PullRequestEvent" -> {
                    val action = payload.path("action").asText()
                    "Opened/closed PR in $repo ($action)"
                }

                "PullRequestReviewEvent" -> "Reviewed PR in $repo"

                "IssuesEvent" -> {
                    val action = payload.path("action").asText()
                    "Opened/closed issue in $repo ($action)"
                }

                "CreateEvent" -> {
                    val refType = payload.path("ref_type").asText()
                    "Created $refType in $repo"
                }

                else -> null
            }
        }

        val suggestion = claudeService.suggestStatus(activityLines)
        return ResponseEntity.ok(SuggestResponse(suggestion))
    }
}
