using System;
using System.Collections.Generic;
using Microsoft.Data.Sqlite;

namespace VRCX_0
{
    public class MetadataCache
    {
        public int Id { get; set; }
        public string FilePath { get; set; }
        public string? Metadata { get; set; }
        public DateTimeOffset CachedAt { get; set; }
    }

    // Imagine using SQLite to store json strings in one table lmao
    // Couldn't be me... oh wait
    internal class ScreenshotMetadataDatabase
    {
        private readonly SqliteConnection _sqlite;

        public ScreenshotMetadataDatabase(string databaseLocation)
        {
            _sqlite = new SqliteConnection($"Data Source={databaseLocation};Pooling=False");
            _sqlite.Open();

            using var pragma = _sqlite.CreateCommand();
            pragma.CommandText = """
                PRAGMA locking_mode=NORMAL;
                PRAGMA busy_timeout=5000;
                PRAGMA journal_mode=WAL;
                PRAGMA optimize=0x10002;
                """;
            pragma.ExecuteNonQuery();

            using var cmd = _sqlite.CreateCommand();
            cmd.CommandText = @"CREATE TABLE IF NOT EXISTS cache (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    file_path TEXT NOT NULL UNIQUE,
                                    metadata TEXT,
                                    cached_at INTEGER NOT NULL
                                );";
            cmd.ExecuteNonQuery();
        }

        public void AddMetadataCache(string filePath, string metadata)
        {
            const string sql = "INSERT OR IGNORE INTO cache (file_path, metadata, cached_at) VALUES (@FilePath, @Metadata, @CachedAt);";
            using var command = new SqliteCommand(sql, _sqlite);
            command.Parameters.AddWithValue("@FilePath", filePath);
            command.Parameters.AddWithValue("@Metadata", metadata);
            command.Parameters.AddWithValue("@CachedAt", DateTimeOffset.Now.Ticks);
            command.ExecuteNonQuery();
        }

        public void BulkAddMetadataCache(IEnumerable<MetadataCache> cache)
        {
            using var transaction = _sqlite.BeginTransaction();
            const string sql = "INSERT OR IGNORE INTO cache (file_path, metadata, cached_at) VALUES (@FilePath, @Metadata, @CachedAt);";
            using var command = new SqliteCommand(sql, _sqlite);
            var filePathParam = command.Parameters.Add("@FilePath", SqliteType.Text);
            var metadataParam = command.Parameters.Add("@Metadata", SqliteType.Text);
            var cachedAtParam = command.Parameters.Add("@CachedAt", SqliteType.Integer);
            foreach (var item in cache)
            {
                filePathParam.Value = item.FilePath;
                metadataParam.Value = (object?)item.Metadata ?? DBNull.Value;
                cachedAtParam.Value = item.CachedAt.Ticks;
                command.ExecuteNonQuery();
            }
            transaction.Commit();
        }

        public bool IsFileCached(string filePath)
        {
            const string sql = "SELECT 1 FROM cache WHERE file_path = @FilePath LIMIT 1;";
            using var command = new SqliteCommand(sql, _sqlite);
            command.Parameters.AddWithValue("@FilePath", filePath);
            return command.ExecuteScalar() != null;
        }

        public string? GetMetadata(string filePath)
        {
            const string sql = "SELECT metadata FROM cache WHERE file_path = @FilePath LIMIT 1;";
            using var command = new SqliteCommand(sql, _sqlite);
            command.Parameters.AddWithValue("@FilePath", filePath);
            var result = command.ExecuteScalar();
            return result is DBNull or null ? null : (string)result;
        }

        public string? GetMetadataById(int id)
        {
            const string sql = "SELECT metadata FROM cache WHERE id = @Id LIMIT 1;";
            using var command = new SqliteCommand(sql, _sqlite);
            command.Parameters.AddWithValue("@Id", id);
            var result = command.ExecuteScalar();
            return result is DBNull or null ? null : (string)result;
        }

        public void Close()
        {
            _sqlite.Close();
            _sqlite.Dispose();
        }
    }
}
