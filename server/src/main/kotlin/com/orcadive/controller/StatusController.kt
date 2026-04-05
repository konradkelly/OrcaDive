package com.orcadive.controller

import com.orcadive.db.AgentsTable
import com.orcadive.db.PrsTable
import com.orcadive.db.StatusesTable
import com.orcadive.db.UsersTable
import com.orcadive.dto.OkResponse
import com.orcadive.dto.PostStatusRequest
import com.orcadive.dto.TeamMember
import com.orcadive.dto.TeamStatusResponse
import com.orcadive.security.currentUser
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.http.ResponseEntity
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.web.bind.annotation.*
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.Locale

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
            val users = UsersTable.selectAll()
                .where { UsersTable.teamId eq user.teamId }
                .toList()

            val userMembers = users.map { u ->
                val uid = u[UsersTable.id].value

                val latestStatus = StatusesTable.selectAll()
                    .where {
                        (StatusesTable.userId eq EntityID(uid, UsersTable)) and StatusesTable.agentId.isNull()
                    }
                    .orderBy(StatusesTable.createdAt to SortOrder.DESC)
                    .limit(1)
                    .singleOrNull()

                val openPrCount = PrsTable.selectAll()
                    .where { (PrsTable.authorId eq uid) and (PrsTable.status eq "open") }
                    .count().toInt()

                val statusTime = latestStatus?.get(StatusesTable.createdAt)

                TeamMember(
                    id = uid.toString(),
                    kind = "user",
                    name = u[UsersTable.displayName],
                    avatar = u[UsersTable.avatarUrl],
                    status = latestStatus?.get(StatusesTable.text),
                    blockers = latestStatus?.get(StatusesTable.blockers),
                    updatedAt = statusTime?.toString(),
                    updatedToday = statusTime != null && statusTime >= todayStart,
                    openPRs = openPrCount,
                )
            }

            val agents = AgentsTable.selectAll()
                .where { AgentsTable.teamId eq user.teamId }
                .toList()

            val agentMembers = agents.map { row ->
                val aid = row[AgentsTable.id].value

                val latestStatus = StatusesTable.selectAll()
                    .where {
                        (StatusesTable.agentId eq EntityID(aid, AgentsTable)) and StatusesTable.userId.isNull()
                    }
                    .orderBy(StatusesTable.createdAt to SortOrder.DESC)
                    .limit(1)
                    .singleOrNull()

                val statusTime = latestStatus?.get(StatusesTable.createdAt)

                TeamMember(
                    id = aid.toString(),
                    kind = "agent",
                    name = row[AgentsTable.name],
                    avatar = row[AgentsTable.avatarUrl],
                    status = latestStatus?.get(StatusesTable.text),
                    blockers = latestStatus?.get(StatusesTable.blockers),
                    updatedAt = statusTime?.toString(),
                    updatedToday = statusTime != null && statusTime >= todayStart,
                    openPRs = 0,
                )
            }

            (userMembers + agentMembers).sortedWith(
                compareBy { it.name.lowercase(Locale.ROOT) },
            )
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
                it[userId] = EntityID(user.userId, UsersTable)
                it[agentId] = null
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
