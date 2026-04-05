using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Threading.Tasks;
using Newtonsoft.Json;
using NLog;

namespace VRCX_0
{
    public partial class AppApi
    {
        private static readonly Logger logger = LogManager.GetCurrentClassLogger();

        public void Init()
        {
        }

        public JsonSerializerSettings JsonSerializerSettings = new JsonSerializerSettings
        {
            Error = delegate (object _, Newtonsoft.Json.Serialization.ErrorEventArgs args)
            {
                args.ErrorContext.Handled = true;
            }
        };

        public void OpenLink(string url)
        {
            if (url.StartsWith("http://") ||
                url.StartsWith("https://"))
            {
                Process.Start(new ProcessStartInfo(url)
                {
                    UseShellExecute = true
                });
            }
        }

        public void OpenDiscordProfile(string discordId)
        {
            if (!long.TryParse(discordId, out _))
                throw new Exception("Invalid user ID");

            var uri = $"discord://-/users/{discordId}";
            Process.Start(new ProcessStartInfo(uri)
            {
                UseShellExecute = true
            });
        }

        public string GetLaunchCommand()
        {
            var command = StartupArgs.LaunchArguments.LaunchCommand;
            StartupArgs.LaunchArguments.LaunchCommand = string.Empty;
            return command;
        }

        public void IPCAnnounceStart()
        {
            IPCServer.Send(new IPCPacket
            {
                Type = "VRCXLaunch",
                MsgType = "VRCXLaunch"
            });
        }

        public void SendIpc(string type, string data)
        {
            IPCServer.Send(new IPCPacket
            {
                Type = "VrcxMessage",
                MsgType = type,
                Data = data
            });
        }

        public string CurrentCulture()
        {
            var culture = CultureInfo.CurrentCulture.ToString();
            if (string.IsNullOrEmpty(culture))
                culture = "en-US";

            return culture;
        }

        public string CurrentLanguage()
        {
            return CultureInfo.InstalledUICulture.Name;
        }

        public bool VrcClosedGracefully()
        {
            return LogWatcher.Instance.VrcClosedGracefully;
        }

        public void SetAppLauncherSettings(bool enabled, bool killOnExit, bool runProcessOnce)
        {
            AutoAppLaunchManager.Instance.Enabled = enabled;
            AutoAppLaunchManager.Instance.KillChildrenOnExit = killOnExit;
            AutoAppLaunchManager.Instance.RunProcessOnce = runProcessOnce;
        }

        public string GetFileBase64(string path)
        {
            if (File.Exists(path))
            {
                return Convert.ToBase64String(File.ReadAllBytes(path));
            }

            return null;
        }

        public Task<bool> TryOpenInstanceInVrc(string launchUrl)
        {
            return VRCIPC.Send(launchUrl);
        }
    }
}