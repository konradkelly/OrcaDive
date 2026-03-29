package com.orcadive.controller

import com.orcadive.db.TeamsTable
import com.orcadive.db.UsersTable
import com.orcadive.dto.AuthResponse
import com.orcadive.dto.GitHubAuthRequest
import com.orcadive.security.JwtUtil
import com.orcadive.service.GitHubService
import org.jetbrains.exposed.sql.insertAndGetId
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.update
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.time.OffsetDateTime
import java.util.UUID

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val gitHubService: GitHubService,
    private val jwtUtil: JwtUtil,
) {
    @PostMapping("/github")
    fun githubAuth(@RequestBody body: GitHubAuthRequest): ResponseEntity<Any> {
        val accessToken = gitHubService.exchangeCode(body.code)
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Failed to exchange code"))

        val ghUser = gitHubService.fetchUser(accessToken)
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Failed to fetch GitHub user"))

        val (userId, teamId) = transaction {
            // Find or create user
            val existing = UsersTable.selectAll()
                .where { UsersTable.githubId eq ghUser.id }
                .singleOrNull()

            if (existing != null) {
                // Update token & profile
                UsersTable.update({ UsersTable.githubId eq ghUser.id }) {
                    it[username] = ghUser.login
                    it[displayName] = ghUser.name
                    it[avatarUrl] = ghUser.avatarUrl
                    it[githubToken] = accessToken
                }
                existing[UsersTable.id].value to existing[UsersTable.teamId]!!
            } else {
                // Create a default team for the user
                val newTeamId = TeamsTable.insertAndGetId {
                    it[name] = "${ghUser.login}'s team"
                    it[createdAt] = OffsetDateTime.now()
                }.value

                val newUserId = UsersTable.insertAndGetId {
                    it[githubId] = ghUser.id
                    it[username] = ghUser.login
                    it[displayName] = ghUser.name
                    it[avatarUrl] = ghUser.avatarUrl
                    it[githubToken] = accessToken
                    it[UsersTable.teamId] = newTeamId
                    it[createdAt] = OffsetDateTime.now()
                }.value

                newUserId to newTeamId
            }
        }

        val token = jwtUtil.generateToken(userId, teamId, ghUser.login)
        return ResponseEntity.ok(AuthResponse(token = token, userId = userId.toString(), username = ghUser.login))
    }
}
