using System;
using System.Collections.Generic;
using Microsoft.Data.Sqlite;
using System.IO;
using System.Text.Json;
using System.Threading;

namespace VRCX_0
{
    public class SQLite
    {
        public static SQLite Instance;
        private readonly ReaderWriterLockSlim m_ConnectionLock;
        private SqliteConnection m_Connection;

        static SQLite()
        {
            Instance = new SQLite();
        }

        public SQLite()
        {
            m_ConnectionLock = new ReaderWriterLockSlim();
        }

        public void Init()
        {
            var dataSource = Program.ConfigLocation;
            var jsonDataSource = VRCXStorage.Instance.Get("VRCX-0_DatabaseLocation");
            if (!string.IsNullOrEmpty(jsonDataSource))
                dataSource = jsonDataSource;

            m_Connection = new SqliteConnection($"Data Source={dataSource};Pooling=False");
            m_Connection.Open();

            using var pragma = m_Connection.CreateCommand();
            pragma.CommandText = """
                PRAGMA locking_mode=NORMAL;
                PRAGMA busy_timeout=5000;
                PRAGMA journal_mode=WAL;
                PRAGMA optimize=0x10002;
                """;
            pragma.ExecuteNonQuery();
        }

        public void Exit()
        {
            m_Connection.Close();
            m_Connection.Dispose();
        }

        public object[][] Execute(string sql, IDictionary<string, object>? args = null)
        {
            m_ConnectionLock.EnterReadLock();
            try
            {
                using var command = new SqliteCommand(sql, m_Connection);
                if (args != null)
                {
                    foreach (var arg in args)
                    {
                        command.Parameters.AddWithValue(arg.Key, UnwrapValue(arg.Value));
                    }
                }

                using var reader = command.ExecuteReader();
                var result = new List<object[]>();
                while (reader.Read())
                {
                    var values = new object[reader.FieldCount];
                    for (var i = 0; i < reader.FieldCount; i++)
                    {
                        values[i] = reader.GetValue(i);
                    }
                    result.Add(values);
                }
                return result.ToArray();
            }
            finally
            {
                m_ConnectionLock.ExitReadLock();
            }
        }

        public int ExecuteNonQuery(string sql, IDictionary<string, object>? args = null)
        {
            var result = -1;
            m_ConnectionLock.EnterWriteLock();
            try
            {
                using var command = new SqliteCommand(sql, m_Connection);
                if (args != null)
                {
                    foreach (var arg in args)
                    {
                        command.Parameters.AddWithValue(arg.Key, UnwrapValue(arg.Value));
                    }
                }
                result = command.ExecuteNonQuery();
            }
            finally
            {
                m_ConnectionLock.ExitWriteLock();
            }

            return result;
        }

        private static object UnwrapValue(object value)
        {
            if (value is JsonElement je)
            {
                return je.ValueKind switch
                {
                    JsonValueKind.String => je.GetString(),
                    JsonValueKind.Number => je.TryGetInt64(out var l) ? l : je.GetDouble(),
                    JsonValueKind.True => 1L,
                    JsonValueKind.False => 0L,
                    JsonValueKind.Null => DBNull.Value,
                    JsonValueKind.Undefined => DBNull.Value,
                    _ => je.GetRawText()
                };
            }
            return value ?? DBNull.Value;
        }
    }
}
