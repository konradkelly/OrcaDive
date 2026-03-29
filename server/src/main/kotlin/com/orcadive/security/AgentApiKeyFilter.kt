package com.orcadive.security

import com.orcadive.db.AgentsTable
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.update
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.security.MessageDigest
import java.time.OffsetDateTime

@Component
class AgentApiKeyFilter : OncePerRequestFilter() {

    override fun shouldNotFilter(request: HttpServletRequest): Boolean {
        return !request.servletPath.startsWith("/api/agents/webhook")
    }

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val header = request.getHeader("Authorization")
        if (header == null || !header.startsWith("Bearer agent:")) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Missing or invalid agent API key")
            return
        }

        val rawKey = header.removePrefix("Bearer agent:")
        val hash = sha256(rawKey)

        val principal = transaction {
            val row = AgentsTable.selectAll()
                .where { AgentsTable.apiKeyHash eq hash }
                .singleOrNull() ?: return@transaction null

            AgentsTable.update({ AgentsTable.apiKeyHash eq hash }) {
                it[lastSeen] = OffsetDateTime.now()
            }

            AgentPrincipal(
                agentId = row[AgentsTable.id].value,
                teamId = row[AgentsTable.teamId],
            )
        }

        if (principal == null) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid agent API key")
            return
        }

        val auth = UsernamePasswordAuthenticationToken(principal, null, emptyList())
        SecurityContextHolder.getContext().authentication = auth
        filterChain.doFilter(request, response)
    }

    private fun sha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(input.toByteArray()).joinToString("") { "%02x".format(it) }
    }
}
