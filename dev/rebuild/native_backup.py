"""Options for credential-free native recovery dumps.

User accounts/password hashes and all document/history data are retained. Live
sessions, recovery tokens and delegated agent keys must be reissued after restore.
Use this for operator recovery dumps; ordinary database replication is separate.
"""
IDENTITY_CREDENTIAL_EXCLUSIONS = [
    "--exclude-table-data=aether_identity.sessions",
    "--exclude-table-data=aether_identity.recovery",
    "--exclude-table-data=aether_identity.agent_connections",
]
