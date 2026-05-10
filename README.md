# Sora Battery

Stream Deck / OpenDeck plugin that displays the Ninjutso Sora V2 mouse battery percentage on a key.

- Green label: battery ≥ 60 %
- Yellow label: battery 30–59 %
- Red label: battery < 30 %
- `CHRG` while charging, `Zzz` when the mouse is off/asleep, `100` at full charge
- Press the key to force an immediate refresh; otherwise it polls every 5 minutes on battery or every 5 seconds while charging

## Requirements

- Ninjutso Sora V2 (VID `1915`, PID `ae1c` wireless / `ae11` wired)
- [OpenDeck](https://github.com/nekename/OpenDeck) on Linux, or the Elgato Stream Deck app on macOS/Windows
- Node.js ≥ 20 (system install is fine; no nvm/fnm wrapper needed)

## Install (OpenDeck on Linux)

### 1. Install udev rule

The Sora V2's hidraw interfaces are root-only by default. This rule grants the active local user read/write access via `uaccess`:

```sh
sudo install -m 644 udev/70-sora-v2.rules /etc/udev/rules.d/70-sora-v2.rules
sudo udevadm control --reload-rules && sudo udevadm trigger
```

Verify: `ls -l /dev/hidraw*` — the Sora's interface(s) should now show `crw-rw----+` (the `+` indicates an ACL).

### 2. Build

```sh
npm install
npm run build
```

`npm install` pulls a prebuilt `node-hid` binary for linux-x64 — no compiler or system libraries needed.

### 3. Deploy

```sh
npm run deploy
```

This symlinks `com.garrett-faucher.sora-battery.sdPlugin` into `~/.config/opendeck/plugins/`. No files are copied; reverting is `rm ~/.config/opendeck/plugins/com.garrett-faucher.sora-battery.sdPlugin`.

### 4. Restart OpenDeck

Use the tray-icon menu → **Restart**, or:

```sh
pkill -x opendeck && opendeck &
```

Then drag **Battery Monitor** from the Sora Battery category onto a key.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Key shows `N/A` | Mouse not found: check udev rule, replug, confirm `lsusb` shows `1915:ae1c` or `1915:ae11` |
| Plugin missing from OpenDeck | Restart OpenDeck so it rescans plugins |
| Stale reading | Press the key to force a refresh |
| Build errors | `rm -rf node_modules && npm install` |

Logs are written to `~/.config/opendeck/plugins/com.garrett-faucher.sora-battery.sdPlugin/logs/` when the plugin is running.

## Development (Elgato Stream Deck app)

```sh
npm run watch   # rebuild on save + restart plugin
```

To publish:

```sh
npx streamdeck validate com.garrett-faucher.sora-battery.sdPlugin
npx streamdeck pack com.garrett-faucher.sora-battery.sdPlugin -f
```

## Removing the plugin

```sh
rm ~/.config/opendeck/plugins/com.garrett-faucher.sora-battery.sdPlugin
sudo rm /etc/udev/rules.d/70-sora-v2.rules
sudo udevadm control --reload-rules && sudo udevadm trigger
```
