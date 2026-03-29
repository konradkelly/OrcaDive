package com.orcadive.websocket

import com.orcadive.security.JwtUtil
import org.springframework.messaging.Message
import org.springframework.messaging.MessageChannel
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.messaging.support.ChannelInterceptor
import org.springframework.messaging.support.MessageHeaderAccessor
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.stereotype.Component

@Component
class StompAuthInterceptor(
    private val jwtUtil: JwtUtil,
) : ChannelInterceptor {

    override fun preSend(message: Message<*>, channel: MessageChannel): Message<*>? {
        val accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor::class.java)
            ?: return message

        if (accessor.command == StompCommand.CONNECT) {
            val token = accessor.getFirstNativeHeader("token")
                ?: accessor.getFirstNativeHeader("Authorization")?.removePrefix("Bearer ")

            if (token != null) {
                val principal = jwtUtil.parseToken(token)
                if (principal != null) {
                    accessor.user = UsernamePasswordAuthenticationToken(principal, null, emptyList())
                }
            }
        }

        return message
    }
}
