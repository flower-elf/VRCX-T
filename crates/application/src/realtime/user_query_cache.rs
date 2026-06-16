use std::future::Future;
use std::sync::Arc;
use std::time::Duration;

use moka::future::Cache;

use crate::vrchat_api::VrchatApiResponse;
use crate::Error;

const QUERY_TTL_SECS: u64 = 60;
const QUERY_CAPACITY: u64 = 2000;

pub(crate) struct UserQueryCache {
    cache: Cache<String, Arc<VrchatApiResponse>>,
}

impl UserQueryCache {
    pub(crate) fn new() -> Self {
        Self {
            cache: Cache::builder()
                .max_capacity(QUERY_CAPACITY)
                .time_to_live(Duration::from_secs(QUERY_TTL_SECS))
                .build(),
        }
    }

    pub(crate) async fn get_or_fetch<F>(
        &self,
        key: String,
        init: F,
    ) -> Result<Arc<VrchatApiResponse>, Arc<Error>>
    where
        F: Future<Output = Result<Arc<VrchatApiResponse>, Error>>,
    {
        self.cache.try_get_with(key, init).await
    }

    pub(crate) async fn invalidate(&self, key: &str) {
        self.cache.invalidate(key).await;
    }

    pub(crate) fn clear(&self) {
        self.cache.invalidate_all();
    }
}
