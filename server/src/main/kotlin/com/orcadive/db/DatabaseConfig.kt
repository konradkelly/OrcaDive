package com.orcadive.db

import jakarta.annotation.PostConstruct
import org.jetbrains.exposed.sql.Database
import org.springframework.context.annotation.Configuration
import javax.sql.DataSource

@Configuration
class DatabaseConfig(
    private val dataSource: DataSource,
) {
    @PostConstruct
    fun init() {
        Database.connect(dataSource)
    }
}
