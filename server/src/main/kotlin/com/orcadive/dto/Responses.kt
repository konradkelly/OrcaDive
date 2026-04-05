package com.orcadive.dto

// === Auth ===
data class AuthResponse(val token: String, val userId: String, val username: String)

// === Status ===
data class TeamMember(
    val id: String,
    /** `"user"` (GitHub teammate) or `"agent"` (registered AI agent). */
    val kind: String,
    val name: String,
    val avatar: String?,
    val status: String?,
    val blockers: String?,
    val updatedAt: String?,
    val updatedToday: Boolean,
    val openPRs: Int,
)

data class TeamStatusResponse(val members: List<TeamMember>)

// === PRs ===
data class PrItem(
    val id: String,
    val title: String,
    val repo: String,
    val author: String,
    val status: String,
    val url: String,
    val ageLabel: String,
)

data class PrsResponse(val prs: List<PrItem>)

// === AI Suggest ===
data class SuggestResponse(val suggestion: String?)

// === Agents ===
data class AgentDto(
    val id: String,
    val name: String,
    val type: String,
    val avatarUrl: String?,
    val status: String,
    val lastSeen: String?,
    val createdAt: String?,
)

data class AgentsResponse(val agents: List<AgentDto>)
data class CreateAgentResponse(val agent: AgentDto, val apiKey: String)

data class RunDto(
    val id: String,
    val task: String,
    val status: String,
    val output: String?,
    val startedAt: String?,
    val completedAt: String?,
    val createdAt: String?,
)

data class RunsResponse(val runs: List<RunDto>)
data class RunResponse(val run: RunDto)

// === Generic ===
data class OkResponse(val ok: Boolean = true)
