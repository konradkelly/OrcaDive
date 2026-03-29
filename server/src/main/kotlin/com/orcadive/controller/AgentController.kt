package com.orcadive.controller

import com.orcadive.db.AgentRunsTable
import com.orcadive.db.AgentsTable
import com.orcadive.dto.*
import com.orcadive.security.currentUser
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.http.ResponseEntity
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.web.bind.annotation.*
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.OffsetDateTime

@RestController
@RequestMapping("/api/agents")
class AgentController(
    private val messagingTemplate: SimpMessagingTemplate,
) {
    private val validTypes = setOf("custom", "copilot", "ci")

    @GetMapping
    fun listAgents(): ResponseEntity<AgentsResponse> {
        val user = currentUser()

        val agents = transaction {
            AgentsTable.selectAll()
                .where { AgentsTable.teamId eq user.teamId }
                .map { it.toAgentDto() }
        }

        return ResponseEntity.ok(AgentsResponse(agents))
    }

    @PostMapping
    fun createAgent(@RequestBody body: CreateAgentRequest): ResponseEntity<Any> {
        val user = currentUser()
        val type = body.type?.takeIf { it in validTypes } ?: "custom"

        // Generate a random 32-byte hex API key
        val rawKey = ByteArray(32).also { SecureRandom().nextBytes(it) }
            .joinToString("") { "%02x".format(it) }
        val apiKey = "agent:$rawKey"
        val hash = sha256(rawKey)

        val agent = transaction {
            AgentsTable.insert {
                it[teamId] = user.teamId
                it[name] = body.name
                it[AgentsTable.type] = type
                it[avatarUrl] = body.avatarUrl
                it[apiKeyHash] = hash
                it[status] = "idle"
                it[createdAt] = OffsetDateTime.now()
            }.resultedValues!!.single().toAgentDto()
        }

        return ResponseEntity.ok(CreateAgentResponse(agent = agent, apiKey = apiKey))
    }

    @DeleteMapping("/{id}")
    fun deleteAgent(@PathVariable id: String): ResponseEntity<OkResponse> {
        val user = currentUser()
        val agentId = java.util.UUID.fromString(id)

        transaction {
            AgentRunsTable.deleteWhere { AgentRunsTable.agentId eq agentId }
            AgentsTable.deleteWhere { (AgentsTable.id eq agentId) and (AgentsTable.teamId eq user.teamId) }
        }

        return ResponseEntity.ok(OkResponse())
    }

    @GetMapping("/{id}/runs")
    fun listRuns(@PathVariable id: String): ResponseEntity<RunsResponse> {
        val agentId = java.util.UUID.fromString(id)

        val runs = transaction {
            AgentRunsTable.selectAll()
                .where { AgentRunsTable.agentId eq agentId }
                .orderBy(AgentRunsTable.createdAt to SortOrder.DESC)
                .limit(50)
                .map { it.toRunDto() }
        }

        return ResponseEntity.ok(RunsResponse(runs))
    }

    @PostMapping("/{id}/runs")
    fun assignTask(@PathVariable id: String, @RequestBody body: AssignTaskRequest): ResponseEntity<Any> {
        if (body.task.isBlank()) {
            return ResponseEntity.badRequest().body(mapOf("error" to "task is required"))
        }

        val user = currentUser()
        val agentId = java.util.UUID.fromString(id)

        val run = transaction {
            AgentRunsTable.insert {
                it[AgentRunsTable.agentId] = agentId
                it[teamId] = user.teamId
                it[task] = body.task
                it[status] = "pending"
                it[createdAt] = OffsetDateTime.now()
            }.resultedValues!!.single().toRunDto()
        }

        messagingTemplate.convertAndSend(
            "/topic/team.${user.teamId}.agent.run.created",
            mapOf("agentId" to id, "run" to run),
        )

        return ResponseEntity.ok(RunResponse(run))
    }

    @PostMapping("/{agentId}/runs/{runId}/cancel")
    fun cancelRun(@PathVariable agentId: String, @PathVariable runId: String): ResponseEntity<Any> {
        val user = currentUser()
        val runUuid = java.util.UUID.fromString(runId)

        val run = transaction {
            val existing = AgentRunsTable.selectAll()
                .where { AgentRunsTable.id eq runUuid }
                .singleOrNull() ?: return@transaction null

            val currentStatus = existing[AgentRunsTable.status]
            if (currentStatus != "pending" && currentStatus != "running") {
                return@transaction null
            }

            AgentRunsTable.update({ AgentRunsTable.id eq runUuid }) {
                it[status] = "cancelled"
                it[completedAt] = OffsetDateTime.now()
            }

            AgentRunsTable.selectAll()
                .where { AgentRunsTable.id eq runUuid }
                .single().toRunDto()
        } ?: return ResponseEntity.badRequest().body(mapOf("error" to "Run not found or cannot be cancelled"))

        messagingTemplate.convertAndSend(
            "/topic/team.${user.teamId}.agent.run.updated",
            mapOf("agentId" to agentId, "run" to run),
        )

        return ResponseEntity.ok(RunResponse(run))
    }

    private fun sha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(input.toByteArray()).joinToString("") { "%02x".format(it) }
    }
}

internal fun ResultRow.toAgentDto() = AgentDto(
    id = this[AgentsTable.id].toString(),
    name = this[AgentsTable.name],
    type = this[AgentsTable.type],
    avatarUrl = this[AgentsTable.avatarUrl],
    status = this[AgentsTable.status],
    lastSeen = this[AgentsTable.lastSeen]?.toString(),
    createdAt = this[AgentsTable.createdAt]?.toString(),
)

internal fun ResultRow.toRunDto() = RunDto(
    id = this[AgentRunsTable.id].toString(),
    task = this[AgentRunsTable.task],
    status = this[AgentRunsTable.status],
    output = this[AgentRunsTable.output],
    startedAt = this[AgentRunsTable.startedAt]?.toString(),
    completedAt = this[AgentRunsTable.completedAt]?.toString(),
    createdAt = this[AgentRunsTable.createdAt]?.toString(),
)
