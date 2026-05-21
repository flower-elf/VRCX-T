use std::collections::HashMap;
use std::io::Cursor;
use std::sync::Arc;

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use reqwest::header::{HeaderName, HeaderValue, CONTENT_TYPE, REFERER};
use reqwest::multipart::{Form, Part};
use reqwest::{Client, Method, Proxy};
use reqwest_cookie_store::{CookieStore, CookieStoreMutex, RawCookie};

pub type Result<T> = std::result::Result<T, WebClientError>;

#[derive(Debug, thiserror::Error)]
pub enum WebClientError {
    #[error("{0}")]
    Custom(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

use WebClientError as Error;

#[derive(Clone, Debug, Default)]
pub enum WebUploadMode {
    #[default]
    None,
    FilePut {
        file_data: String,
        file_mime: String,
        file_md5: Option<String>,
    },
    LegacyImage {
        image_data: String,
        post_data: Option<String>,
    },
    Image {
        image_data: String,
        post_data: Option<String>,
    },
    PrintImage {
        image_data: String,
        post_data: Option<String>,
    },
}

#[derive(Clone, Debug)]
pub struct WebExecuteRequest {
    pub url: String,
    pub method: String,
    pub headers: Vec<(String, String)>,
    pub body: Option<String>,
    pub upload: WebUploadMode,
}

impl WebExecuteRequest {
    pub fn new(url: String, method: String) -> Self {
        Self {
            url,
            method,
            headers: Vec::new(),
            body: None,
            upload: WebUploadMode::None,
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "PascalCase")]
struct CookieEntry {
    name: String,
    value: String,
    domain: String,
    path: String,
}

pub fn validate_vrchat_cookies_b64(b64: &str) -> Result<()> {
    const MAX_COOKIE_STORE_BYTES: usize = 1024 * 1024;

    let value = b64.trim();
    if value.is_empty() {
        return Ok(());
    }

    let bytes = B64
        .decode(value)
        .map_err(|error| Error::Custom(format!("bad cookie payload: {error}")))?;
    if bytes.len() > MAX_COOKIE_STORE_BYTES {
        return Err(Error::Custom("cookie payload is too large".into()));
    }

    if let Ok(entries) = serde_json::from_slice::<Vec<CookieEntry>>(&bytes) {
        return validate_legacy_cookie_entries(&entries);
    }

    let store = load_cookie_store(&bytes)?;
    validate_cookie_store_domains(&store)
}

fn load_cookie_store(bytes: &[u8]) -> Result<CookieStore> {
    #[allow(deprecated)]
    CookieStore::load_json_all(Cursor::new(bytes))
        .map_err(|error| Error::Custom(format!("bad cookie store JSON: {error}")))
}

fn validate_cookie_store_domains(store: &CookieStore) -> Result<()> {
    let domains = store
        .iter_any()
        .filter_map(|cookie| cookie.domain.as_cow().map(|domain| domain.to_string()))
        .collect::<Vec<_>>();
    if domains.is_empty() {
        return Err(Error::Custom(
            "cookie payload does not contain any cookie domains".into(),
        ));
    }

    for domain in domains {
        if !is_vrchat_cookie_domain(&domain) {
            return Err(Error::Custom(format!(
                "cookie domain is not allowed: {domain}"
            )));
        }
    }

    Ok(())
}

fn validate_legacy_cookie_entries(entries: &[CookieEntry]) -> Result<()> {
    if entries.is_empty() {
        return Err(Error::Custom(
            "cookie payload does not contain any cookie domains".into(),
        ));
    }
    for entry in entries {
        legacy_cookie_url(entry)?;
        legacy_raw_cookie(entry)?;
    }
    Ok(())
}

fn legacy_cookie_url(entry: &CookieEntry) -> Result<reqwest::Url> {
    if !is_vrchat_cookie_domain(&entry.domain) {
        return Err(Error::Custom(format!(
            "cookie domain is not allowed: {}",
            entry.domain
        )));
    }
    if entry.path.is_empty()
        || !entry.path.starts_with('/')
        || entry.path.chars().any(|ch| ch.is_control() || ch == ';')
    {
        return Err(Error::Custom("cookie path is not allowed".into()));
    }
    let domain = entry.domain.trim().trim_start_matches('.');
    format!("https://{}{}", domain, entry.path)
        .parse::<reqwest::Url>()
        .map_err(|error| Error::Custom(format!("bad cookie URL: {error}")))
}

fn legacy_raw_cookie(entry: &CookieEntry) -> Result<RawCookie<'static>> {
    if entry.name.is_empty()
        || entry
            .name
            .chars()
            .any(|ch| ch.is_control() || matches!(ch, '=' | ';'))
        || entry.value.chars().any(|ch| ch.is_control() || ch == ';')
    {
        return Err(Error::Custom(
            "legacy cookie name or value is not allowed".into(),
        ));
    }
    let cookie_str = format!(
        "{}={}; Domain={}; Path={}",
        entry.name, entry.value, entry.domain, entry.path
    );
    RawCookie::parse(cookie_str)
        .map(|cookie| cookie.into_owned())
        .map_err(|error| Error::Custom(format!("bad legacy cookie entry: {error}")))
}

fn is_vrchat_cookie_domain(domain: &str) -> bool {
    let domain = domain
        .trim()
        .trim_start_matches('.')
        .trim_end_matches('.')
        .to_ascii_lowercase();
    domain == "vrchat.com"
        || domain.ends_with(".vrchat.com")
        || domain == "vrchat.cloud"
        || domain.ends_with(".vrchat.cloud")
}

pub struct WebClient {
    client: Client,
    jar: Arc<CookieStoreMutex>,
    proxy_url: Option<String>,
}

impl WebClient {
    pub fn new(proxy_url: Option<String>, cookies_b64: Option<&str>) -> Result<Self> {
        let cookie_store = reqwest_cookie_store::CookieStore::default();
        let jar = Arc::new(CookieStoreMutex::new(cookie_store));

        let mut builder = Client::builder()
            .cookie_provider(jar.clone())
            .user_agent("VRCX-0")
            .gzip(true)
            .brotli(true)
            .deflate(true)
            .pool_max_idle_per_host(10)
            .pool_idle_timeout(std::time::Duration::from_secs(300));

        if let Some(ref url) = proxy_url {
            builder = builder
                .no_proxy()
                .proxy(Proxy::all(url).map_err(|e| Error::Custom(format!("bad proxy: {e}")))?);
        }

        let client = builder
            .build()
            .map_err(|e| Error::Custom(format!("http client: {e}")))?;

        let wc = Self {
            client,
            jar,
            proxy_url: proxy_url.clone(),
        };

        if let Some(cookies_b64) = cookies_b64 {
            let _ = wc.restore_cookies(cookies_b64);
        }

        Ok(wc)
    }

    fn restore_cookies(&self, b64: &str) -> Result<bool> {
        if let Some(store) = Self::deserialize_cookie_store(b64) {
            let mut jar = self.jar.lock().unwrap();
            *jar = store;
            return Ok(true);
        }
        if let Some(entries) = Self::deserialize_legacy_cookie_entries(b64) {
            self.apply_cookie_entries(&entries)?;
            return Ok(true);
        }
        Ok(false)
    }

    fn serialize_cookie_store(&self) -> Option<String> {
        let store = self.jar.lock().unwrap();
        let mut json = Vec::new();
        #[allow(deprecated)]
        store
            .save_incl_expired_and_nonpersistent_json(&mut json)
            .ok()?;
        Some(B64.encode(json))
    }

    fn deserialize_cookie_store(b64: &str) -> Option<CookieStore> {
        let bytes = B64.decode(b64).ok()?;
        #[allow(deprecated)]
        CookieStore::load_json_all(Cursor::new(bytes)).ok()
    }

    fn deserialize_legacy_cookie_entries(b64: &str) -> Option<Vec<CookieEntry>> {
        let bytes = B64.decode(b64).ok()?;
        serde_json::from_slice::<Vec<CookieEntry>>(&bytes).ok()
    }

    fn apply_cookie_entries(&self, entries: &[CookieEntry]) -> Result<()> {
        let mut store = self.jar.lock().unwrap();
        for e in entries {
            let url = legacy_cookie_url(e)?;
            let cookie = legacy_raw_cookie(e)?;
            store
                .insert_raw(&cookie, &url)
                .map_err(|error| Error::Custom(format!("insert legacy cookie: {error}")))?;
        }
        Ok(())
    }

    pub fn cookie_jar(&self) -> Arc<CookieStoreMutex> {
        self.jar.clone()
    }

    pub fn proxy_url(&self) -> Option<&str> {
        self.proxy_url.as_deref()
    }

    pub fn clear_cookies(&self) {
        let mut store = self.jar.lock().unwrap();
        store.clear();
    }

    pub fn get_cookies(&self) -> String {
        self.serialize_cookie_store().unwrap_or_default()
    }

    pub fn set_cookies(&self, b64: &str) -> Result<()> {
        if b64.trim().is_empty() {
            return Ok(());
        }
        validate_vrchat_cookies_b64(b64)?;
        if self.restore_cookies(b64)? {
            Ok(())
        } else {
            Err(Error::Custom("cookie payload could not be restored".into()))
        }
    }

    pub async fn execute(&self, request: WebExecuteRequest) -> Result<(i32, String)> {
        let result = self.do_execute(&request).await;

        match result {
            Ok(pair) => Ok(pair),
            Err(e) => Ok((-1, e.to_string())),
        }
    }

    async fn do_execute(&self, request: &WebExecuteRequest) -> Result<(i32, String)> {
        let request = match &request.upload {
            WebUploadMode::None => self.build_standard_request(request)?,
            WebUploadMode::FilePut {
                file_data,
                file_mime,
                file_md5,
            } => self.build_file_put_request(request, file_data, file_mime, file_md5.as_deref())?,
            WebUploadMode::LegacyImage {
                image_data,
                post_data,
            } => {
                self.build_legacy_image_upload_request(request, image_data, post_data.as_deref())?
            }
            WebUploadMode::Image {
                image_data,
                post_data,
            } => self.build_image_upload_request(request, image_data, post_data.as_deref())?,
            WebUploadMode::PrintImage {
                image_data,
                post_data,
            } => {
                self.build_print_image_upload_request(request, image_data, post_data.as_deref())?
            }
        };

        let response = self
            .client
            .execute(request)
            .await
            .map_err(|e| Error::Custom(e.to_string()))?;

        let status = response.status().as_u16() as i32;
        let content_type = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();

        if content_type.contains("image/") || content_type.contains("application/octet-stream") {
            let bytes = response
                .bytes()
                .await
                .map_err(|e| Error::Custom(e.to_string()))?;
            let b64 = B64.encode(&bytes);
            Ok((status, format!("data:image/png;base64,{b64}")))
        } else {
            let body = response
                .text()
                .await
                .map_err(|e| Error::Custom(e.to_string()))?;
            Ok((status, body))
        }
    }

    fn build_standard_request(&self, request: &WebExecuteRequest) -> Result<reqwest::Request> {
        let method = Method::from_bytes(request.method.as_bytes())
            .map_err(|e| Error::Custom(format!("bad method: {e}")))?;

        let mut builder = self.client.request(method.clone(), &request.url);

        let mut content_type_override: Option<String> = None;
        for (key, val_str) in &request.headers {
            let key_lower = key.to_lowercase();
            if key_lower == "content-type" {
                content_type_override = Some(val_str.to_string());
                continue;
            }
            if key_lower == "referer" {
                builder = builder.header(REFERER, val_str);
            } else if let (Ok(name), Ok(value)) = (
                HeaderName::from_bytes(key.as_bytes()),
                HeaderValue::from_str(val_str),
            ) {
                builder = builder.header(name, value);
            }
        }

        if method != Method::GET {
            if let Some(body) = request.body.as_deref() {
                let ct = content_type_override
                    .as_deref()
                    .unwrap_or("application/json; charset=utf-8");
                builder = builder.header(CONTENT_TYPE, ct).body(body.to_string());
            }
        }

        builder
            .build()
            .map_err(|e| Error::Custom(format!("build request: {e}")))
    }

    fn build_file_put_request(
        &self,
        request: &WebExecuteRequest,
        file_data: &str,
        file_mime: &str,
        file_md5: Option<&str>,
    ) -> Result<reqwest::Request> {
        let bytes = B64
            .decode(file_data)
            .map_err(|e| Error::Custom(format!("bad base64: {e}")))?;

        let mut builder = self
            .client
            .put(&request.url)
            .header(CONTENT_TYPE, file_mime)
            .body(bytes.clone());

        if let Some(md5) = file_md5 {
            if let Ok(md5_bytes) = B64.decode(md5) {
                builder = builder.header("Content-MD5", B64.encode(&md5_bytes));
            }
        }

        for (key, val_str) in &request.headers {
            let key_lower = key.to_lowercase();
            if key_lower == "content-type" {
                continue;
            }
            if let (Ok(name), Ok(value)) = (
                HeaderName::from_bytes(key.as_bytes()),
                HeaderValue::from_str(val_str),
            ) {
                builder = builder.header(name, value);
            }
        }

        builder
            .build()
            .map_err(|e| Error::Custom(format!("build PUT: {e}")))
    }

    fn build_legacy_image_upload_request(
        &self,
        request: &WebExecuteRequest,
        image_data: &str,
        post_data: Option<&str>,
    ) -> Result<reqwest::Request> {
        let image_bytes = B64
            .decode(image_data)
            .map_err(|e| Error::Custom(format!("bad imageData base64: {e}")))?;

        let mut form = Form::new().part(
            "image",
            Part::bytes(image_bytes)
                .file_name("image.png")
                .mime_str("image/png")
                .map_err(|e| Error::Custom(format!("image mime: {e}")))?,
        );

        if let Some(post_data) = post_data {
            form = form.text("data", post_data.to_string());
        }

        self.client
            .post(&request.url)
            .multipart(form)
            .build()
            .map_err(|e| Error::Custom(format!("build legacy upload: {e}")))
    }

    fn build_image_upload_request(
        &self,
        request: &WebExecuteRequest,
        image_data: &str,
        post_data: Option<&str>,
    ) -> Result<reqwest::Request> {
        let image_bytes = B64
            .decode(image_data)
            .map_err(|e| Error::Custom(format!("bad imageData base64: {e}")))?;

        let mut form = Form::new().part(
            "file",
            Part::bytes(image_bytes)
                .file_name("blob")
                .mime_str("image/png")
                .map_err(|e| Error::Custom(format!("image mime: {e}")))?,
        );

        if let Some(post_data) = post_data {
            let json =
                serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(post_data)
                    .map_err(|e| Error::Custom(format!("bad postData: {e}")))?;
            for (key, value) in json {
                let text = match value {
                    serde_json::Value::String(s) => s,
                    other => other.to_string(),
                };
                form = form.text(key, text);
            }
        }

        self.client
            .post(&request.url)
            .multipart(form)
            .build()
            .map_err(|e| Error::Custom(format!("build image upload: {e}")))
    }

    fn build_print_image_upload_request(
        &self,
        request: &WebExecuteRequest,
        image_data: &str,
        post_data: Option<&str>,
    ) -> Result<reqwest::Request> {
        let image_bytes = B64
            .decode(image_data)
            .map_err(|e| Error::Custom(format!("bad imageData base64: {e}")))?;
        let mut form = Form::new().part(
            "image",
            Part::bytes(image_bytes)
                .file_name("image")
                .mime_str("image/png")
                .map_err(|e| Error::Custom(format!("print image mime: {e}")))?,
        );

        if let Some(post_data) = post_data {
            let json = serde_json::from_str::<HashMap<String, String>>(post_data)
                .map_err(|e| Error::Custom(format!("bad postData: {e}")))?;
            for (key, value) in json {
                form = form.text(key, value);
            }
        }

        self.client
            .post(&request.url)
            .multipart(form)
            .build()
            .map_err(|e| Error::Custom(format!("build print upload: {e}")))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::thread::JoinHandle;
    use std::time::{Duration, Instant};

    struct TestDir {
        path: std::path::PathBuf,
    }

    impl TestDir {
        fn new(name: &str) -> Self {
            let nonce = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path =
                std::env::temp_dir().join(format!("vrcx-0-{name}-{}-{nonce}", std::process::id()));
            std::fs::create_dir_all(&path).unwrap();
            Self { path }
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.path);
        }
    }

    fn spawn_text_server(body: &'static [u8]) -> (String, JoinHandle<()>) {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        listener.set_nonblocking(true).unwrap();
        let addr = listener.local_addr().unwrap();
        let url = format!("http://{addr}/api/1");
        let handle = std::thread::spawn(move || {
            let deadline = Instant::now() + Duration::from_secs(5);
            loop {
                match listener.accept() {
                    Ok((mut stream, _)) => {
                        let mut buffer = [0u8; 1024];
                        let _ = stream.read(&mut buffer);
                        let response = format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                            body.len()
                        );
                        let _ = stream.write_all(response.as_bytes());
                        let _ = stream.write_all(body);
                        break;
                    }
                    Err(error)
                        if error.kind() == std::io::ErrorKind::WouldBlock
                            && Instant::now() < deadline =>
                    {
                        std::thread::sleep(Duration::from_millis(10));
                    }
                    Err(_) => break,
                }
            }
        });
        (url, handle)
    }

    fn legacy_cookie_payload(value: serde_json::Value) -> String {
        B64.encode(serde_json::to_vec(&value).unwrap())
    }

    #[test]
    fn validates_legacy_vrchat_cookie_payload() -> Result<()> {
        let payload = legacy_cookie_payload(serde_json::json!([{
            "Name": "auth",
            "Value": "token",
            "Domain": ".vrchat.com",
            "Path": "/"
        }]));

        validate_vrchat_cookies_b64(&payload)
    }

    #[test]
    fn rejects_malformed_legacy_cookie_without_panicking() -> Result<()> {
        let payload = legacy_cookie_payload(serde_json::json!([{
            "Name": "auth",
            "Value": "token; Domain=example.com",
            "Domain": ".vrchat.com",
            "Path": "/"
        }]));
        let web = WebClient::new(None, None)?;

        assert!(validate_vrchat_cookies_b64(&payload).is_err());
        assert!(web.set_cookies(&payload).is_err());
        Ok(())
    }

    #[test]
    fn rejects_non_vrchat_legacy_cookie_domain() {
        let payload = legacy_cookie_payload(serde_json::json!([{
            "Name": "auth",
            "Value": "token",
            "Domain": "example.com",
            "Path": "/"
        }]));

        assert!(validate_vrchat_cookies_b64(&payload).is_err());
    }

    #[test]
    fn execute_returns_success_status_and_body_for_daily_get() -> Result<()> {
        let _dir = TestDir::new("web-client-daily");
        let web = WebClient::new(None, None)?;
        let (url, server) = spawn_text_server(br#"{"ok":true}"#);

        let request = WebExecuteRequest::new(url, "GET".to_string());
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = runtime.block_on(web.execute(request));
        server.join().unwrap();

        let (status, body) = result?;
        assert_eq!(status, 200);
        assert_eq!(body, r#"{"ok":true}"#);
        Ok(())
    }
}
