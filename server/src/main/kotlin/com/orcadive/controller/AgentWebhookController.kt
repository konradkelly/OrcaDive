package com.orcadive.controller

import com.orcadive.db.AgentRunsTable
import com.orcadive.db.AgentsTable
import com.orcadive.db.StatusesTable
import com.orcadive.dto.*
import com.orcadive.security.currentAgent
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.update
import org.springframework.http.ResponseEntity
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.web.bind.annotation.*
import java.time.OffsetDateTime
import java.util.UUID

@RestController
@RequestMapping("/api/agents/webhook")
class AgentWebhookController(
    private val messagingTemplate: SimpMessagingTemplate,
) {
    private val validStatuses = setOf("idle", "running", "error", "offline")
    private val validRunStatuses = setOf("running", "success", "failure")
    private val listableRunStatuses = setOf("pending", "running", "success", "failure", "cancelled")

    @GetMapping("/runs")
    fun listRuns(
        @RequestParam(name = "status", required = false) status: String?,
    ): ResponseEntity<RunsResponse> {
        val agent = currentAgent()
        val filter = status?.split(",")
            ?.map { it.trim() }
            ?.filter { it in listableRunStatuses }
            ?.toSet()
            ?: setOf("pending", "running")

        val runs = transaction {
            AgentRunsTable.selectAll()
                .where {
                    (AgentRunsTable.agentId eq agent.agentId) and
                        (AgentRunsTable.status inList filter.toList())
                }
                .orderBy(AgentRunsTable.createdAt to SortOrder.DESC)
                .limit(50)
                .map { it.toRunDto() }
        }

        return ResponseEntity.ok(RunsResponse(runs))
    }

    @PostMapping("/standup")
    fun postStandup(@RequestBody body: PostStatusRequest): ResponseEntity<Any> {
        if (body.text.isBlank()) {
            return ResponseEntity.badRequest().body(mapOf("error" to "text is required"))
        }

        val agent = currentAgent()

        transaction {
            StatusesTable.insert {
                it[userId] = null
                it[agentId] = EntityID(agent.agentId, AgentsTable)
                it[teamId] = agent.teamId
                it[text] = body.text
                it[blockers] = body.blockers
                it[createdAt] = OffsetDateTime.now()
            }
        }

        messagingTemplate.convertAndSend(
            "/topic/team.${agent.teamId}.status",
            mapOf(
                "agentId" to agent.agentId.toString(),
                "status" to body.text,
                "blockers" to body.blockers,
            ),
        )

        return ResponseEntity.ok(OkResponse())
    }

    @PostMapping("/status")
    fun reportStatus(@RequestBody body: WebhookStatusRequest): ResponseEntity<Any> {
        if (body.status !in validStatuses) {
            return ResponseEntity.badRequest().body(mapOf("error" to "Invalid status"))
        }

        val agent = currentAgent()

        transaction {
            AgentsTable.update({ AgentsTable.id eq agent.agentId }) {
                it[status] = body.status
                it[lastSeen] = OffsetDateTime.now()
            }
        }

        messagingTemplate.convertAndSend(
            "/topic/team.${agent.teamId}.agent.status",
            mapOf(
                "agentId" to agent.agentId.toString(),
                "status" to body.status,
                "statusText" to body.statusText,
            ),
        )

        return ResponseEntity.ok(OkResponse())
    }

    @PostMapping("/run")
    fun reportRun(@RequestBody body: WebhookRunRequest): ResponseEntity<Any> {
        if (body.status !in validRunStatuses) {
            return ResponseEntity.badRequest().body(mapOf("error" to "Invalid run status"))
        }

        val agent = currentAgent()
        val runId = UUID.fromString(body.runId)
        val now = OffsetDateTime.now()

        val run = transaction {
            AgentRunsTable.update({ AgentRunsTable.id eq runId }) {
                it[status] = body.status
                if (body.output != null) {
                    it[output] = body.output
                }
                if (body.status == "running") {
                    // Set started_at only if not already set — use SQL COALESCE
                    it[startedAt] = now
                }
                if (body.status == "success" || body.status == "failure") {
                    it[completedAt] = now
                }
            }

            AgentRunsTable.selectAll()
                .where { AgentRunsTable.id eq runId }
                .single().toRunDto()
        }

        messagingTemplate.convertAndSend(
            "/topic/team.${agent.teamId}.agent.run.updated",
            mapOf("agentId" to agent.agentId.toString(), "run" to run),
        )

        return ResponseEntity.ok(RunResponse(run))
    }
}
