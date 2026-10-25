# FriendGroups

A [Vencord](https://github.com/Vencord/Vencord) userplugin that lets you organize your Discord friends into custom collapsible categories in the DM sidebar.

## Features

- Custom friend groups displayed as collapsible categories in the DM sidebar
- Color-coded group headers
- Right-click any user to add/remove them from groups
- Groups stored locally (client-side only — invisible to others)
- Default groups: Minecraft, IRL, Work (customizable)

## Installation

### Manual (Vencord UserPlugin)

1. Navigate to your Vencord userplugins directory:
   - **Windows:** `%APPDATA%/Vencord/userplugins/`
   - **Linux:** `~/.config/Vencord/userplugins/`
   - **macOS:** `~/Library/Application Support/Vencord/userplugins/`

2. Clone this repository into that directory:
   ```bash
   cd ~/.config/Vencord/userplugins/
   git clone https://github.com/cipheros/vencord-friendgroups.git friendGroups
   ```

3. Restart Discord (or Vesktop).

4. Go to **Vencord Settings → Plugins** and enable **FriendGroups**.

### Vesktop (Custom Vencord Build)

If you use Vesktop with a custom Vencord directory:

1. Clone into your Vencord source's `src/userplugins/` folder:
   ```bash
   cd ~/vencord-custom/vencord-src/src/userplugins/
   git clone https://github.com/cipheros/vencord-friendgroups.git friendGroups
   ```

2. Rebuild Vencord:
   ```bash
   cd ~/vencord-custom/vencord-src
   pnpm build
   ```

3. Copy build output to your Vesktop custom Vencord dir:
   ```bash
   cp dist/vencordDesktop{Main,Preload,Renderer}.{js,css} ~/.config/vesktop/customVencord/
   ```

4. Restart Vesktop.

## Usage

- **Create a group:** Right-click any user → Friend Groups → Create New Group...
- **Add/remove from group:** Right-click a user → Friend Groups → toggle the group name
- **Collapse/expand:** Click the category header in the sidebar
- **Delete group:** Right-click the category header → Delete Group

## Files

| File | Description |
|------|-------------|
| `index.tsx` | Main plugin — patches, context menu, sidebar rendering |
| `data.ts` | Data layer — DataStore persistence, group management |
| `styles.css` | Category header styles |

## Requirements

- [Vencord](https://github.com/Vencord/Vencord) (latest)

## License

GPL-3.0-or-later

---

## More projects by vSake

- **[Fih](https://github.com/vSake-clean/Fih)** — programming language with a compiler written in pure x86-64 assembly, no libc
- **[Szept](https://github.com/vSake-clean/Szept)** — serverless Android messenger
- **[LunarDraw](https://github.com/vSake-clean/LunarDraw)** — GTK3/Cairo drawing app with layers
- **[LuminaView](https://github.com/vSake-clean/LuminaView)** — fast, lightweight Qt5 image viewer for Linux
- **[StatusCycler](https://github.com/vSake-clean/StatusCycler)** — Vencord plugin that cycles your Discord custom status
- **[vencord-AutoReply](https://github.com/vSake-clean/vencord-AutoReply)** — Vencord plugin for automatic replies with triggers and filters
- **[vencord-StickyNotes](https://github.com/vSake-clean/vencord-StickyNotes)** — Vencord plugin for sticky notes on Discord users

If you like this project, consider leaving a ⭐ — it really helps!
