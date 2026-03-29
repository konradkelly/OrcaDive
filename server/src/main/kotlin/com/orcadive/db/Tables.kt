package com.orcadive.db

import org.jetbrains.exposed.dao.id.UUIDTable
import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.javatime.timestampWithTimeZone

object TeamsTable : UUIDTable("teams") {
    val name = text("name")
    val createdAt = timestampWithTimeZone("created_at").nullable()
}

object UsersTable : UUIDTable("users") {
    val githubId = long("github_id").uniqueIndex()
    val username = text("username")
    val displayName = text("display_name")
    val avatarUrl = text("avatar_url").nullable()
    val githubToken = text("github_token").nullable()
    val teamId = uuid("team_id").references(TeamsTable.id).nullable()
    val createdAt = timestampWithTimeZone("created_at").nullable()
}

object StatusesTable : UUIDTable("statuses") {
    val userId = uuid("user_id").references(UsersTable.id)
    val teamId = uuid("team_id").references(TeamsTable.id)
    val text = text("text")
    val blockers = text("blockers").nullable()
    val createdAt = timestampWithTimeZone("created_at").nullable()

    init {
        index(false, userId, createdAt)
    }
}

object PrsTable : UUIDTable("prs") {
    val githubPrId = long("github_pr_id").uniqueIndex()
    val repo = text("repo")
    val title = text("title")
    val authorId = uuid("author_id").references(UsersTable.id).nullable()
    val status = text("status").default("open")
    val url = text("url")
    val createdAt = timestampWithTimeZone("created_at").nullable()
    val updatedAt = timestampWithTimeZone("updated_at").nullable()

    init {
        index(false, authorId, status)
    }
}

object TeamReposTable : UUIDTable("team_repos") {
    val teamId = uuid("team_id").references(TeamsTable.id)
    val repoFullName = text("repo_full_name")
    val addedAt = timestampWithTimeZone("added_at").nullable()

    init {
        uniqueIndex(teamId, repoFullName)
    }
}

object AgentsTable : UUIDTable("agents") {
    val teamId = uuid("team_id").references(TeamsTable.id)
    val name = text("name")
    val type = text("type").default("custom")
    val avatarUrl = text("avatar_url").nullable()
    val apiKeyHash = text("api_key_hash")
    val status = text("status").default("idle")
    val lastSeen = timestampWithTimeZone("last_seen").nullable()
    val createdAt = timestampWithTimeZone("created_at").nullable()

    init {
        index(false, teamId)
    }
}

object AgentRunsTable : UUIDTable("agent_runs") {
    val agentId = uuid("agent_id").references(AgentsTable.id)
    val teamId = uuid("team_id").references(TeamsTable.id)
    val task = text("task")
    val status = text("status").default("pending")
    val output = text("output").nullable()
    val startedAt = timestampWithTimeZone("started_at").nullable()
    val completedAt = timestampWithTimeZone("completed_at").nullable()
    val createdAt = timestampWithTimeZone("created_at").nullable()

    init {
        index(false, agentId, createdAt)
    }
}
