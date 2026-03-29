package com.orcadive.controller

import com.orcadive.db.PrsTable
import com.orcadive.db.StatusesTable
import com.orcadive.db.UsersTable
import com.orcadive.dto.OkResponse
import com.orcadive.dto.PostStatusRequest
import com.orcadive.dto.TeamMember
import com.orcadive.dto.TeamStatusResponse
import com.orcadive.security.currentUser
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.http.ResponseEntity
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.web.bind.annotation.*
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset

@RestController
@RequestMapping("/api/status")
class StatusController(
    private val messagingTemplate: SimpMessagingTemplate,
) {
    @GetMapping("/team")
    fun getTeamStatus(): ResponseEntity<TeamStatusResponse> {
        val user = currentUser()
        val todayStart = LocalDate.now().atStartOfDay().atOffset(ZoneOffset.UTC)

        val members = transaction {
            // Sub-query: latest status per user via DISTINCT ON (Postgres-specific)
            val latestStatuses = StatusesTable
                .select(StatusesTable.userId, StatusesTable.text, StatusesTable.blockers, StatusesTable.createdAt)
                .where { StatusesTable.teamId eq user.teamId }
                .orderBy(StatusesTable.userId to SortOrder.ASC, StatusesTable.createdAt to SortOrder.DESC)

            // We'll do this with a raw approach for DISTINCT ON, or we can just group in Kotlin
            // Fetch all users in the team, then match latest status per user
            val users = UsersTable.selectAll()
                .where { UsersTable.teamId eq user.teamId }
                .toList()

            users.map { u ->
                val uid = u[UsersTable.id].value

                // Latest status for this user
                val latestStatus = StatusesTable.selectAll()
                    .where { StatusesTable.userId eq uid }
                    .orderBy(StatusesTable.createdAt to SortOrder.DESC)
                    .limit(1)
                    .singleOrNull()

                // Open PR count
                val openPrCount = PrsTable.selectAll()
                    .where { (PrsTable.authorId eq uid) and (PrsTable.status eq "open") }
                    .count().toInt()

                val statusTime = latestStatus?.get(StatusesTable.createdAt)

                TeamMember(
                    id = uid.toString(),
                    name = u[UsersTable.displayName],
                    avatar = u[UsersTable.avatarUrl],
                    status = latestStatus?.get(StatusesTable.text),
                    blockers = latestStatus?.get(StatusesTable.blockers),
                    updatedAt = statusTime?.toString(),
                    updatedToday = statusTime != null && statusTime >= todayStart,
                    openPRs = openPrCount,
                )
            }
        }

        return ResponseEntity.ok(TeamStatusResponse(members))
    }

    @PostMapping
    fun postStatus(@RequestBody body: PostStatusRequest): ResponseEntity<Any> {
        if (body.text.isBlank()) {
            return ResponseEntity.badRequest().body(mapOf("error" to "text is required"))
        }

        val user = currentUser()

        transaction {
            StatusesTable.insert {
                it[userId] = user.userId
                it[teamId] = user.teamId
                it[text] = body.text
                it[blockers] = body.blockers
                it[createdAt] = OffsetDateTime.now()
            }
        }

        messagingTemplate.convertAndSend(
            "/topic/team.${user.teamId}.status",
            mapOf(
                "memberId" to user.userId.toString(),
                "status" to body.text,
                "blockers" to body.blockers,
            ),
        )

        return ResponseEntity.ok(OkResponse())
    }
}
