package com.orcadive.security

import org.springframework.security.core.context.SecurityContextHolder

fun currentUser(): UserPrincipal =
    SecurityContextHolder.getContext().authentication.principal as UserPrincipal

fun currentAgent(): AgentPrincipal =
    SecurityContextHolder.getContext().authentication.principal as AgentPrincipal
