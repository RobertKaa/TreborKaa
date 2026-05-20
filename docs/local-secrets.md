# Local secrets

## Trello MCP credentials

Do not store Trello credentials in repository files or shared documentation. For Codex Desktop, keep
the Trello board id in `~/.codex/config.toml`, but store the sensitive values as Windows user
environment variables:

```powershell
[Environment]::SetEnvironmentVariable("TRELLO_API_KEY", "<new-api-key>", "User")
[Environment]::SetEnvironmentVariable("TRELLO_TOKEN", "<new-token>", "User")
```

Then remove these lines from `~/.codex/config.toml` if they exist:

```toml
TRELLO_API_KEY = "..."
TRELLO_TOKEN = "..."
```

Restart Codex Desktop after changing user environment variables so new MCP server processes inherit
them.

## Rotation procedure

1. Revoke the old Trello token in Trello.
2. Generate a new Trello token for the same API key, or rotate the API key as well if needed.
3. Update the Windows user environment variables.
4. Restart Codex Desktop.
5. Verify Trello MCP with a read-only board/list call before creating or moving cards.

The repository should never contain `TRELLO_API_KEY`, `TRELLO_TOKEN`, raw Trello tokens or copied
Codex MCP config blocks with credentials.
