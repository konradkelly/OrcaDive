package com.orcadive.security

import java.util.UUID

data class UserPrincipal(val userId: UUID, val teamId: UUID, val githubLogin: String)
