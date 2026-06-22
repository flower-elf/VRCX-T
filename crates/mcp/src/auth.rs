use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use constant_time_eq::constant_time_eq;

use crate::error::McpError;
use crate::types::ClientConfigSnippets;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct McpAuthPolicy {
    pub port: u16,
    pub token: String,
}

#[derive(Clone, Debug, Eq, PartialEq, thiserror::Error)]
pub enum McpAuthError {
    #[error("MCP requests must use a localhost host header")]
    InvalidHost,
    #[error("MCP requests must use a localhost origin")]
    InvalidOrigin,
    #[error("MCP requests require an Authorization bearer token")]
    MissingBearerToken,
    #[error("MCP bearer token did not match")]
    InvalidBearerToken,
}

pub fn generate_mcp_token() -> Result<String, McpError> {
    let mut token_bytes = [0_u8; 32];
    getrandom::fill(&mut token_bytes)?;
    Ok(URL_SAFE_NO_PAD.encode(token_bytes))
}

pub fn authorize_mcp_request(
    policy: &McpAuthPolicy,
    authorization: Option<&str>,
    host: Option<&str>,
    origin: Option<&str>,
) -> Result<(), McpAuthError> {
    if !is_allowed_loopback_authority(host, policy.port) {
        return Err(McpAuthError::InvalidHost);
    }

    if let Some(origin) = origin {
        if !is_allowed_loopback_origin(origin, policy.port) {
            return Err(McpAuthError::InvalidOrigin);
        }
    }

    let bearer = authorization
        .and_then(|value| value.strip_prefix("Bearer "))
        .ok_or(McpAuthError::MissingBearerToken)?;

    if constant_time_eq(bearer.as_bytes(), policy.token.as_bytes()) {
        Ok(())
    } else {
        Err(McpAuthError::InvalidBearerToken)
    }
}

pub fn client_config_snippets(port: u16, token: &str) -> ClientConfigSnippets {
    let url = format!("http://127.0.0.1:{port}/mcp");
    let auth_header = format!("Authorization: Bearer {token}");
    ClientConfigSnippets {
        claude_code_command: format!(
            "claude mcp add --transport http vrcx-0 {url} --header \"{auth_header}\""
        ),
        mcp_remote_json: format!(
            "{{\n  \"mcpServers\": {{\n    \"vrcx-0\": {{\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"mcp-remote\", \"{url}\", \"--header\", \"{auth_header}\"]\n    }}\n  }}\n}}"
        ),
        generic_json: format!(
            "{{\n  \"mcpServers\": {{\n    \"vrcx-0\": {{\n      \"url\": \"{url}\",\n      \"headers\": {{\n        \"Authorization\": \"Bearer {token}\"\n      }}\n    }}\n  }}\n}}"
        ),
    }
}

fn is_allowed_loopback_authority(authority: Option<&str>, port: u16) -> bool {
    matches!(
        authority.map(|value| value.to_ascii_lowercase()),
        Some(value) if value == format!("127.0.0.1:{port}") || value == format!("localhost:{port}")
    )
}

fn is_allowed_loopback_origin(origin: &str, port: u16) -> bool {
    let origin = origin.to_ascii_lowercase();
    origin == format!("http://127.0.0.1:{port}") || origin == format!("http://localhost:{port}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_token_is_high_entropy_base64url_without_padding() {
        let token = generate_mcp_token().unwrap();

        assert!(token.len() >= 43);
        assert!(token
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_'));
        assert!(!token.contains('='));
    }

    #[test]
    fn request_auth_requires_bearer_token_and_loopback_host() {
        let policy = McpAuthPolicy {
            port: 8798,
            token: "secret-token".into(),
        };

        assert_eq!(
            authorize_mcp_request(
                &policy,
                Some("Bearer secret-token"),
                Some("127.0.0.1:8798"),
                None,
            ),
            Ok(())
        );
        assert_eq!(
            authorize_mcp_request(
                &policy,
                Some("Bearer secret-token"),
                Some("localhost:8798"),
                None,
            ),
            Ok(())
        );
        assert!(authorize_mcp_request(
            &policy,
            Some("Bearer secret-token"),
            Some("evil.test:8798"),
            None,
        )
        .is_err());
        assert!(
            authorize_mcp_request(&policy, Some("Bearer wrong"), Some("127.0.0.1:8798"), None,)
                .is_err()
        );
        assert!(authorize_mcp_request(&policy, None, Some("127.0.0.1:8798"), None).is_err());
    }

    #[test]
    fn client_help_snippets_include_real_url_and_token_warning() {
        let snippets = client_config_snippets(7654, "tok_secret");

        assert!(snippets
            .claude_code_command
            .contains("http://127.0.0.1:7654/mcp"));
        assert!(snippets
            .claude_code_command
            .contains("Authorization: Bearer tok_secret"));
        assert!(snippets.generic_json.contains("\"mcpServers\""));
        assert!(snippets.generic_json.contains("http://127.0.0.1:7654/mcp"));
        assert!(snippets.mcp_remote_json.contains("mcp-remote"));
        assert!(snippets
            .mcp_remote_json
            .contains("http://127.0.0.1:7654/mcp"));
    }
}
