package com.orcadive.security

import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.nio.charset.StandardCharsets
import java.util.*
import javax.crypto.SecretKey

@Component
class JwtUtil(
    @Value("\${app.jwt-secret}") private val secret: String,
) {
    private val key: SecretKey by lazy {
        Keys.hmacShaKeyFor(secret.toByteArray(StandardCharsets.UTF_8))
    }

    fun generateToken(userId: UUID, teamId: UUID, githubLogin: String): String {
        val now = Date()
        val expiry = Date(now.time + 30L * 24 * 60 * 60 * 1000) // 30 days

        return Jwts.builder()
            .claim("userId", userId.toString())
            .claim("teamId", teamId.toString())
            .claim("githubLogin", githubLogin)
            .issuedAt(now)
            .expiration(expiry)
            .signWith(key)
            .compact()
    }

    fun parseToken(token: String): UserPrincipal? {
        return try {
            val claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .payload

            UserPrincipal(
                userId = UUID.fromString(claims["userId"] as String),
                teamId = UUID.fromString(claims["teamId"] as String),
                githubLogin = claims["githubLogin"] as String,
            )
        } catch (_: Exception) {
            null
        }
    }
}
