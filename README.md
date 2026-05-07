# VRCX-0

The first commit of this repository corresponds to the upstream VRCX snapshot at the time of forking and is licensed under the MIT License.

All modifications, additions, rewrites, and new code introduced after the fork are licensed under the GNU General Public License v3.0 (GPLv3).

---

VRCX-0 is an independent fork of VRCX, rebuilt with **Tauri + React** instead of the old CEF-based architecture.

I contributed to VRCX from late 2024 to April 2026, working on a large part of its development, including multiple frontend iterations.  
As of April 2026, I am no longer part of the original project.

VRCX has entered maintenance mode, while VRCX-0 is still under active development with its own architecture, roadmap, and priorities.

## Main Changes

- About 50%–70% lower memory usage compared to VRCX
- Windows and macOS installers are only 20MB+
- Much smaller application size
- Different UI and interaction design
- Full keyboard navigation
- Independent roadmap

## Data Migration

On first run, VRCX-0 automatically migrates existing VRCX database and configuration data.

Original VRCX data is not modified.  
No manual setup is required.  
Existing users can start from their current data.

## VROverlay

VROverlay support is planned.

It will be redesigned instead of directly reusing the old implementation, with a focus on better and more correct use cases.

## Development

Requirements:

- Node.js LTS
- Rust latest stable via rustup

```bash
git clone https://github.com/Map1en/VRCX-0
cd VRCX-0

npm install
npm run tauri:dev
```

---

# VRCX-0 中文说明

本仓库的第一个提交对应 fork 时的上游 VRCX 项目快照，并遵循 MIT License。

fork 之后新增、修改、重写的代码，均遵循 GNU General Public License v3.0（GPLv3）。

---

VRCX-0 是 VRCX 的独立 fork，正在使用 **Tauri + React** 重新构建，替代原有的 CEF 架构。

我从 2024 年末开始参与 VRCX 开发，并持续到 2026 年 4 月，期间参与了大量功能开发和多轮前端迭代。  
从 2026 年 4 月起，我已不再参与原项目。

目前 VRCX 已进入维护期，而 VRCX-0 仍在积极开发，会按照独立架构、独立路线和新的优先级继续推进。

## 主要变化

- 相比 VRCX，内存占用通常减少约 50%–70%
- Windows 和 macOS 安装包仅 20MB+
- 程序体积大幅缩小
- 不同的 UI 和交互设计
- 支持完整键盘操作
- 独立的开发路线

## 数据迁移

VRCX-0 首次运行时会自动迁移现有 VRCX 的数据库和配置。

原 VRCX 数据不会被修改。  
不需要手动设置。  
现有用户可以直接从原来的数据开始使用。

## VROverlay

VROverlay 计划支持。

它不会直接沿用旧实现，而是会根据更合适、更正确的使用场景重新设计。

## 开发

需要安装：

- Node.js LTS
- Rust latest stable，建议通过 rustup 安装

```bash
git clone https://github.com/Map1en/VRCX-0
cd VRCX-0

npm install
npm run tauri:dev
```

核心功能已经可用，更多功能仍在继续完善。
