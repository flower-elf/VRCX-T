use std::collections::HashMap;

use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use url::Url;

use crate::web_client::{WebExecuteRequest, WebUploadMode};

const DEFAULT_VRCHAT_API_ENDPOINT: &str = "https://api.vrchat.cloud/api/1";
const VRCHAT_API_HOST: &str = "api.vrchat.cloud";
const VRCHAT_FILES_HOST: &str = "files.vrchat.cloud";

#[derive(Debug, thiserror::Error)]
pub enum HttpApiError {
    #[error("{0}")]
    Custom(String),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ApiScope {
    Vrchat,
    VrchatMedia,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApiResponsePolicy {
    pub class: String,
    pub endpoint_scope: String,
    pub retryable: bool,
    pub rate_limited: bool,
    pub session_recovery_required: bool,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpApiRequestInput {
    pub url: Option<String>,
    pub path: Option<String>,
    pub endpoint: Option<String>,
    pub method: Option<String>,
    pub params: Option<HashMap<String, Value>>,
    pub query_params: Option<HashMap<String, Value>>,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<Value>,
    pub json_body: Option<bool>,
    pub skip_empty_query_string: Option<bool>,

    #[serde(rename = "uploadFilePUT")]
    pub upload_file_put: Option<bool>,
    #[serde(rename = "uploadImage")]
    pub upload_image: Option<bool>,
    #[serde(rename = "uploadImagePrint")]
    pub upload_image_print: Option<bool>,
    #[serde(rename = "uploadImageLegacy")]
    pub upload_image_legacy: Option<bool>,
    pub matching_dimensions: Option<bool>,
    pub crop_white_border: Option<bool>,
    pub post_data: Option<String>,
    pub image_data: Option<String>,
    pub file_data: Option<String>,
    #[serde(rename = "fileMIME")]
    pub file_mime: Option<String>,
    #[serde(rename = "fileMD5")]
    pub file_md5: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct HttpApiExecuteResponse {
    pub status: i32,
    pub data: String,
    pub raw: Value,
}

pub fn scope_saves_cookies(scope: ApiScope) -> bool {
    matches!(scope, ApiScope::Vrchat | ApiScope::VrchatMedia)
}

pub fn classify_api_response(status: i32, scope: ApiScope) -> ApiResponsePolicy {
    let class = match status {
        200..=399 => "ok",
        401 | 403 => "auth",
        429 => "rateLimited",
        400..=499 => "clientError",
        500..=599 => "serverError",
        _ => "unknown",
    };
    ApiResponsePolicy {
        class: class.to_string(),
        endpoint_scope: api_scope_name(scope).to_string(),
        retryable: matches!(status, 408 | 409 | 425 | 429 | 500..=599),
        rate_limited: status == 429,
        session_recovery_required: matches!(scope, ApiScope::Vrchat | ApiScope::VrchatMedia)
            && matches!(status, 401 | 403),
    }
}

pub fn execute_response(status: i32, data: String, scope: ApiScope) -> HttpApiExecuteResponse {
    let policy = classify_api_response(status, scope);
    HttpApiExecuteResponse {
        status,
        data: data.clone(),
        raw: json!({
            "status": status,
            "data": data,
            "policy": policy,
        }),
    }
}

pub fn normalize_text(value: impl AsRef<str>) -> String {
    value.as_ref().trim().to_string()
}

pub fn require_text(value: impl AsRef<str>, message: &str) -> Result<String, HttpApiError> {
    let value = normalize_text(value);
    if value.is_empty() {
        return Err(HttpApiError::Custom(message.to_string()));
    }
    Ok(value)
}

pub fn encode_path_segment(value: &str) -> String {
    utf8_percent_encode(value, NON_ALPHANUMERIC).to_string()
}

pub fn json_headers() -> HashMap<String, String> {
    HashMap::from([(
        "Content-Type".to_string(),
        "application/json;charset=utf-8".to_string(),
    )])
}

pub fn object_body(value: Option<Value>) -> Value {
    match value {
        Some(value @ Value::Object(_)) => value,
        _ => json!({}),
    }
}

pub fn api_input(
    endpoint: String,
    method: &str,
    path: impl Into<String>,
    body: Option<Value>,
) -> HttpApiRequestInput {
    let has_body = body.is_some();
    HttpApiRequestInput {
        endpoint: Some(endpoint),
        method: Some(method.into()),
        path: Some(path.into()),
        headers: body.as_ref().map(|_| json_headers()),
        body,
        json_body: Some(has_body),
        ..Default::default()
    }
}

pub fn get_input(
    endpoint: String,
    path: impl Into<String>,
    query_params: HashMap<String, Value>,
) -> HttpApiRequestInput {
    HttpApiRequestInput {
        endpoint: Some(endpoint),
        method: Some("GET".into()),
        path: Some(path.into()),
        params: Some(query_params.clone()),
        query_params: Some(query_params),
        ..Default::default()
    }
}

pub fn query_input(
    endpoint: String,
    method: &str,
    path: impl Into<String>,
    query_params: HashMap<String, Value>,
) -> HttpApiRequestInput {
    HttpApiRequestInput {
        endpoint: Some(endpoint),
        method: Some(method.into()),
        path: Some(path.into()),
        params: Some(query_params.clone()),
        query_params: Some(query_params),
        json_body: Some(false),
        ..Default::default()
    }
}

pub fn api_input_skip_empty_query_string(
    endpoint: String,
    method: &str,
    path: impl Into<String>,
    body: Value,
) -> HttpApiRequestInput {
    HttpApiRequestInput {
        endpoint: Some(endpoint),
        method: Some(method.into()),
        path: Some(path.into()),
        headers: Some(json_headers()),
        body: Some(body),
        json_body: Some(true),
        skip_empty_query_string: Some(true),
        ..Default::default()
    }
}

pub fn get_input_skip_empty_query_string(
    endpoint: String,
    path: impl Into<String>,
    query_params: HashMap<String, Value>,
) -> HttpApiRequestInput {
    HttpApiRequestInput {
        endpoint: Some(endpoint),
        method: Some("GET".into()),
        path: Some(path.into()),
        params: Some(query_params.clone()),
        query_params: Some(query_params),
        skip_empty_query_string: Some(true),
        ..Default::default()
    }
}

pub fn build_web_execute_request(
    input: HttpApiRequestInput,
    scope: ApiScope,
) -> Result<WebExecuteRequest, HttpApiError> {
    let method = input
        .method
        .as_deref()
        .unwrap_or("GET")
        .to_ascii_uppercase();
    let mut request = WebExecuteRequest::new(build_request_url(&input, scope)?, method.clone());

    if let Some(headers) = input.headers.as_ref().filter(|headers| !headers.is_empty()) {
        request.headers = headers
            .iter()
            .map(|(key, value)| (key.clone(), value.clone()))
            .collect();
    }

    if let Some(body) = request_body_text(&input, &method)? {
        request.body = Some(body);
    }

    if input.upload_file_put.unwrap_or(false) {
        request.upload = WebUploadMode::FilePut {
            file_data: input.file_data.unwrap_or_default(),
            file_mime: input
                .file_mime
                .unwrap_or_else(|| "application/octet-stream".to_string()),
            file_md5: input.file_md5,
        };
    } else if input.upload_image.unwrap_or(false) {
        request.upload = WebUploadMode::Image {
            image_data: input.image_data.unwrap_or_default(),
            post_data: input.post_data,
        };
    } else if input.upload_image_print.unwrap_or(false) {
        request.upload = WebUploadMode::PrintImage {
            image_data: input.image_data.unwrap_or_default(),
            post_data: input.post_data,
        };
    } else if input.upload_image_legacy.unwrap_or(false) {
        request.upload = WebUploadMode::LegacyImage {
            image_data: input.image_data.unwrap_or_default(),
            post_data: input.post_data,
        };
    }

    Ok(request)
}

pub fn normalize_vrchat_api_endpoint(endpoint: Option<&str>) -> String {
    let endpoint = endpoint.unwrap_or("").trim().trim_end_matches('/');
    if endpoint.is_empty() {
        DEFAULT_VRCHAT_API_ENDPOINT.to_string()
    } else {
        endpoint.to_string()
    }
}

fn validated_vrchat_api_endpoint(endpoint: Option<&str>) -> Result<String, HttpApiError> {
    let endpoint = normalize_vrchat_api_endpoint(endpoint);
    let url = parse_http_url(&endpoint)?;
    if url.scheme() != "https"
        || url.host_str() != Some(VRCHAT_API_HOST)
        || url.path().trim_end_matches('/') != "/api/1"
    {
        return Err(HttpApiError::Custom(
            "VRChat API endpoint must be https://api.vrchat.cloud/api/1.".into(),
        ));
    }
    Ok(endpoint)
}

fn api_scope_name(scope: ApiScope) -> &'static str {
    match scope {
        ApiScope::Vrchat => "vrchat",
        ApiScope::VrchatMedia => "vrchatMedia",
    }
}

fn value_as_query_strings(value: &Value, skip_empty_string: bool) -> Vec<String> {
    match value {
        Value::Null => Vec::new(),
        Value::String(value) => {
            if skip_empty_string && value.is_empty() {
                Vec::new()
            } else {
                vec![value.to_string()]
            }
        }
        Value::Bool(value) => vec![value.to_string()],
        Value::Number(value) => vec![value.to_string()],
        other => vec![other.to_string()],
    }
}

fn append_query_params(url: &mut Url, params: &HashMap<String, Value>, skip_empty_string: bool) {
    for (key, value) in params {
        if let Value::Array(values) = value {
            for item in values {
                for text in value_as_query_strings(item, skip_empty_string) {
                    url.query_pairs_mut().append_pair(key, &text);
                }
            }
            continue;
        }

        let values = value_as_query_strings(value, skip_empty_string);
        if values.len() == 1 {
            url.query_pairs_mut().append_pair(key, &values[0]);
        }
    }
}

fn parse_http_url(url: &str) -> Result<Url, HttpApiError> {
    let url =
        Url::parse(url).map_err(|error| HttpApiError::Custom(format!("bad API URL: {error}")))?;
    if url.scheme() != "https" && url.scheme() != "http" {
        return Err(HttpApiError::Custom("unsupported API URL scheme".into()));
    }
    Ok(url)
}

fn is_allowed_vrchat_media_upload_url(url: &Url) -> bool {
    if url.scheme() != "https" {
        return false;
    }
    let Some(host) = url.host_str().map(|host| host.to_ascii_lowercase()) else {
        return false;
    };

    if host == VRCHAT_FILES_HOST {
        return true;
    }
    if host == VRCHAT_API_HOST {
        return url.path().starts_with("/api/1/file/");
    }
    if host == "files.vrchat.cloud.s3.amazonaws.com"
        || (host.starts_with("files.vrchat.cloud.") && host.ends_with(".amazonaws.com"))
    {
        return true;
    }
    if host.starts_with("s3.") && host.ends_with(".amazonaws.com") {
        return url
            .path_segments()
            .and_then(|segments| segments.into_iter().next())
            == Some(VRCHAT_FILES_HOST);
    }
    false
}

fn validate_vrchat_media_upload_url(url: &Url) -> Result<(), HttpApiError> {
    if is_allowed_vrchat_media_upload_url(url) {
        return Ok(());
    }
    Err(HttpApiError::Custom(
        "VRChat media upload URL must be an official VRChat HTTPS upload target.".into(),
    ))
}

fn is_upload_request(input: &HttpApiRequestInput) -> bool {
    input.upload_file_put.unwrap_or(false)
        || input.upload_image.unwrap_or(false)
        || input.upload_image_print.unwrap_or(false)
        || input.upload_image_legacy.unwrap_or(false)
        || input.image_data.is_some()
        || input.file_data.is_some()
        || input.file_md5.is_some()
        || input.file_mime.is_some()
        || input.post_data.is_some()
        || input.matching_dimensions.is_some()
        || input.crop_white_border.is_some()
}

fn validate_upload_scope(input: &HttpApiRequestInput, scope: ApiScope) -> Result<(), HttpApiError> {
    if is_upload_request(input) && !matches!(scope, ApiScope::VrchatMedia) {
        return Err(HttpApiError::Custom(
            "upload options are only allowed for VRChat media requests".into(),
        ));
    }
    Ok(())
}

fn build_request_url(input: &HttpApiRequestInput, scope: ApiScope) -> Result<String, HttpApiError> {
    validate_upload_scope(input, scope)?;

    if let Some(url) = input
        .url
        .as_deref()
        .map(str::trim)
        .filter(|url| !url.is_empty())
    {
        let url = parse_http_url(url)?;
        match scope {
            ApiScope::Vrchat | ApiScope::VrchatMedia => {
                if matches!(scope, ApiScope::VrchatMedia) && is_upload_request(input) {
                    validate_vrchat_media_upload_url(&url)?;
                    return Ok(url.to_string());
                }
                return Err(HttpApiError::Custom(
                    "VRChat API requests must use path and endpoint".into(),
                ));
            }
        }
    }

    let path = input
        .path
        .as_deref()
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .ok_or_else(|| HttpApiError::Custom("Missing API request path".into()))?;

    if let Ok(url) = Url::parse(path) {
        match scope {
            ApiScope::Vrchat | ApiScope::VrchatMedia => {
                if matches!(scope, ApiScope::VrchatMedia) && is_upload_request(input) {
                    validate_vrchat_media_upload_url(&url)?;
                    return Ok(url.to_string());
                }
                return Err(HttpApiError::Custom(
                    "VRChat API requests must use relative paths".into(),
                ));
            }
        }
    }

    let base = format!(
        "{}/",
        validated_vrchat_api_endpoint(input.endpoint.as_deref())?
    );
    let mut url = Url::parse(&base)
        .map_err(|error| HttpApiError::Custom(format!("bad API endpoint: {error}")))?
        .join(path.trim_start_matches('/'))
        .map_err(|error| HttpApiError::Custom(format!("bad API path: {error}")))?;

    let query_params = input.query_params.as_ref().or(input.params.as_ref());
    if let Some(params) = query_params {
        append_query_params(
            &mut url,
            params,
            input.skip_empty_query_string.unwrap_or(false),
        );
    }

    Ok(url.to_string())
}

fn normalize_json_body(value: &Value) -> Value {
    if value.is_object() {
        value.clone()
    } else {
        json!({})
    }
}

fn request_body_text(
    input: &HttpApiRequestInput,
    method: &str,
) -> Result<Option<String>, HttpApiError> {
    if method == "GET" {
        return Ok(None);
    }

    let json_body = input.json_body.unwrap_or(true);
    if !json_body {
        return Ok(input.body.as_ref().and_then(|value| {
            value
                .as_str()
                .map(ToString::to_string)
                .or_else(|| (!value.is_null()).then(|| value.to_string()))
        }));
    }

    let body = input.body.as_ref().unwrap_or(&Value::Null);
    serde_json::to_string(&normalize_json_body(body))
        .map(Some)
        .map_err(|error| HttpApiError::Custom(format!("serialize API body: {error}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(path: &str) -> HttpApiRequestInput {
        HttpApiRequestInput {
            path: Some(path.to_string()),
            ..Default::default()
        }
    }

    #[test]
    fn builds_vrchat_url_with_query_arrays_and_skipped_values() {
        let mut request = input("worlds");
        request.endpoint = Some("https://api.vrchat.cloud/api/1/".to_string());
        request.query_params = Some(HashMap::from([
            ("tag".to_string(), json!(["featured", null, "labs", ""])),
            ("n".to_string(), json!(50)),
            ("ignored".to_string(), Value::Null),
        ]));
        request.skip_empty_query_string = Some(true);

        let url = Url::parse(&build_request_url(&request, ApiScope::Vrchat).unwrap()).unwrap();
        assert_eq!(
            format!("{}{}", url.origin().unicode_serialization(), url.path()),
            "https://api.vrchat.cloud/api/1/worlds"
        );
        assert_eq!(
            url.query_pairs()
                .filter(|(key, _)| key == "tag")
                .map(|(_, value)| value.to_string())
                .collect::<Vec<_>>(),
            vec!["featured".to_string(), "labs".to_string()]
        );
        assert_eq!(
            url.query_pairs()
                .find(|(key, _)| key == "n")
                .map(|(_, value)| value.to_string())
                .as_deref(),
            Some("50")
        );
        assert!(url.query_pairs().all(|(key, _)| key != "ignored"));
    }

    #[test]
    fn rejects_non_vrchat_api_endpoint() {
        let mut request = input("worlds");
        request.endpoint = Some("https://api.example.test/api/1/".to_string());
        assert!(build_request_url(&request, ApiScope::Vrchat).is_err());
    }

    #[test]
    fn rejects_absolute_urls_for_vrchat_scopes() {
        let request = HttpApiRequestInput {
            url: Some("https://example.com/".to_string()),
            ..Default::default()
        };
        assert!(build_request_url(&request, ApiScope::Vrchat).is_err());

        let request = input("https://example.com/");
        assert!(build_request_url(&request, ApiScope::VrchatMedia).is_err());
    }

    #[test]
    fn rejects_upload_options_outside_media_scope() {
        let mut request = input("auth/user");
        request.upload_image = Some(true);
        assert!(build_request_url(&request, ApiScope::Vrchat).is_err());

        request.path = Some("file/image".to_string());
        assert!(build_request_url(&request, ApiScope::VrchatMedia).is_ok());
    }

    #[test]
    fn allows_signed_absolute_upload_urls_for_media_scope() {
        let mut request = HttpApiRequestInput {
            url: Some("https://signed-upload.example.test/file".to_string()),
            ..Default::default()
        };
        assert!(build_request_url(&request, ApiScope::VrchatMedia).is_err());

        request.upload_file_put = Some(true);
        assert!(build_request_url(&request, ApiScope::VrchatMedia).is_err());

        request.url = Some("https://files.vrchat.cloud/file".to_string());
        let url = build_request_url(&request, ApiScope::VrchatMedia).unwrap();
        assert_eq!(url, "https://files.vrchat.cloud/file");

        request.url = Some("https://api.vrchat.cloud/api/1/auth/user".to_string());
        assert!(build_request_url(&request, ApiScope::VrchatMedia).is_err());

        request.url = Some("https://api.vrchat.cloud/api/1/file/file_1/1/file".to_string());
        assert!(build_request_url(&request, ApiScope::VrchatMedia).is_ok());
    }

    #[test]
    fn classifies_auth_and_rate_limit_statuses_for_http_policy() {
        let auth = classify_api_response(401, ApiScope::Vrchat);
        assert_eq!(auth.class, "auth");
        assert!(auth.session_recovery_required);
        assert!(!auth.rate_limited);
        assert!(!auth.retryable);

        let forbidden = classify_api_response(403, ApiScope::Vrchat);
        assert_eq!(forbidden.class, "auth");
        assert!(forbidden.session_recovery_required);
        assert!(!forbidden.retryable);

        let rate_limited = classify_api_response(429, ApiScope::Vrchat);
        assert_eq!(rate_limited.class, "rateLimited");
        assert!(rate_limited.rate_limited);
        assert!(rate_limited.retryable);
        assert!(!rate_limited.session_recovery_required);
    }

    #[test]
    fn json_body_false_without_body_does_not_emit_body_option() {
        let mut request = input("favorites/fav_1");
        request.method = Some("DELETE".to_string());
        request.json_body = Some(false);
        request.params = Some(HashMap::from([("objectId".to_string(), json!("fav_1"))]));

        let request = build_web_execute_request(request, ApiScope::Vrchat).unwrap();
        assert!(request.body.is_none());
        assert_eq!(request.method, "DELETE");
    }
}
