package com.orcadive.controller

import com.orcadive.db.TeamReposTable
import com.orcadive.db.UsersTable
import com.orcadive.dto.*
import com.orcadive.security.currentUser
import com.orcadive.service.GitHubService
import com.fasterxml.jackson.databind.JsonNode
import org.jetbrains.exposed.sql.insertIgnore
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.time.Duration
import java.time.OffsetDateTime
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

@RestController
@RequestMapping("/api/team")
class PrController(
    private val gitHubService: GitHubService,
) {
    @GetMapping("/prs")
    fun getTeamPrs(): ResponseEntity<PrsResponse> {
        val user = currentUser()

        val (repos, githubToken) = transaction {
            val repos = TeamReposTable.selectAll()
                .where { TeamReposTable.teamId eq user.teamId }
                .map { it[TeamReposTable.repoFullName] }

            val token = UsersTable.selectAll()
                .where { UsersTable.id eq user.userId }
                .single()[UsersTable.githubToken]

            repos to token
        }

        if (githubToken == null || repos.isEmpty()) {
            return ResponseEntity.ok(PrsResponse(emptyList()))
        }

        val statusPriority = mapOf("review_requested" to 0, "open" to 1, "draft" to 2)

        val allPrs = repos.flatMap { repo ->
            try {
                gitHubService.fetchOpenPRs(repo, githubToken).map { pr -> mapPr(pr, repo) }
            } catch (_: Exception) {
                emptyList()
            }
        }.sortedBy { statusPriority[it.status] ?: 3 }

        return ResponseEntity.ok(PrsResponse(allPrs))
    }

    @PostMapping("/repos")
    fun addRepo(@RequestBody body: AddRepoRequest): ResponseEntity<OkResponse> {
        val user = currentUser()

        transaction {
            TeamReposTable.insertIgnore {
                it[teamId] = user.teamId
                it[repoFullName] = body.repoFullName
                it[addedAt] = OffsetDateTime.now()
            }
        }

        return ResponseEntity.ok(OkResponse())
    }

    private fun mapPr(pr: JsonNode, repo: String): PrItem {
        val isDraft = pr.path("draft").asBoolean(false)
        val reviewers = pr.path("requested_reviewers")
        val mergedAt = pr.path("merged_at").asText(null)

        val status = when {
            isDraft -> "draft"
            reviewers.isArray && reviewers.size() > 0 -> "review_requested"
            mergedAt != null -> "merged"
            else -> "open"
        }

        val createdAt = pr.path("created_at").asText()
        val age = try {
            val created = ZonedDateTime.parse(createdAt, DateTimeFormatter.ISO_DATE_TIME)
            val hours = Duration.between(created, ZonedDateTime.now()).toHours()
            if (hours < 24) "${hours}h ago" else "${hours / 24}d ago"
        } catch (_: Exception) {
            ""
        }

        return PrItem(
            id = pr.path("id").asText(),
            title = pr.path("title").asText(),
            repo = repo,
            author = pr.path("user").path("login").asText(),
            status = status,
            url = pr.path("html_url").asText(),
            ageLabel = age,
        )
    }
}
