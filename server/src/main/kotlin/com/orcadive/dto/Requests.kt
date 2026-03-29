package com.orcadive.dto

import com.fasterxml.jackson.annotation.JsonProperty

// === Auth ===
data class GitHubAuthRequest(val code: String)

// === Status ===
data class PostStatusRequest(val text: String, val blockers: String? = null)

// === Repos ===
data class AddRepoRequest(val repoFullName: String)

// === Agents (user-facing) ===
data class CreateAgentRequest(
    val name: String,
    val type: String? = "custom",
    val avatarUrl: String? = null,
)

data class AssignTaskRequest(val task: String)

// === Agent Webhooks ===
data class WebhookStatusRequest(
    val status: String,
    val statusText: String? = null,
)

data class WebhookRunRequest(
    val runId: String,
    val status: String,
    val output: String? = null,
)
