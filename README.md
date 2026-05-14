# streamdeck-sorabattery

An [OpenDeck](https://github.com/nekename/OpenDeck) / Elgato Stream Deck plugin written in Rust that displays the Ninjutso Sora V2 mouse battery percentage on a key.

- Green label: battery ≥ 60%
- Orange label: battery 30–59%
- Red label: battery < 30%
- `CHRG` while charging, `Zzz` when the mouse is off/asleep, `100%` at full charge
- Press the key to force an immediate refresh; otherwise polls every 5 minutes on battery or every 5 seconds while charging

## Compatibility

| Host | Supported |
|------|-----------|
| OpenDeck (Linux/Mac/Win) | Yes |
| Elgato Stream Deck software (Mac/Win) | Yes |

This plugin uses the [`openaction`](https://github.com/OpenActionAPI/rust) crate and stays within the Elgato-compatible feature subset (`set_image`, `set_title`, Keypad controller only). It runs on any OpenAction-compatible host.

## Requirements

- Ninjutso Sora V2 (VID `1915`, PID `ae1c` wireless / `ae11` wired)
- Rust (edition 2024, tested on 1.85+)
- `libhidapi-dev` (Linux: `sudo apt install libhidapi-dev`; macOS: `brew install hidapi`)
- [OpenDeck](https://github.com/nekename/OpenDeck) or the Elgato Stream Deck app

## Build

```sh
cargo build --release
```

Binary lands at `target/release/oasorabattery`.

## Install (OpenDeck on Linux)

### 1. Install udev rule

The Sora V2's hidraw interfaces are root-only by default. This rule grants the active local user read/write access via `uaccess`:

```sh
sudo install -m 644 udev/70-sora-v2.rules /etc/udev/rules.d/70-sora-v2.rules
sudo udevadm control --reload-rules && sudo udevadm trigger
```

Verify: `ls -l /dev/hidraw*` — the Sora's interface(s) should show `crw-rw----+` (the `+` indicates an ACL).

### 2. Deploy

```sh
PLUGIN_DIR=~/.config/opendeck/plugins/com.garrett-faucher.sorabattery.sdPlugin
TARGET=x86_64-unknown-linux-gnu

mkdir -p "$PLUGIN_DIR"
cp -r assets/. "$PLUGIN_DIR/"
cp target/release/oasorabattery "$PLUGIN_DIR/oasorabattery-$TARGET"
```

### 3. Restart OpenDeck

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

## Removing the plugin

```sh
rm -rf ~/.config/opendeck/plugins/com.garrett-faucher.sorabattery.sdPlugin
sudo rm /etc/udev/rules.d/70-sora-v2.rules
sudo udevadm control --reload-rules && sudo udevadm trigger
```

## Project structure

```
streamdeck-sorabattery/
├── .github/workflows/build.yml   # 5-target release matrix
├── Cargo.toml                    # package: oasorabattery
├── rustfmt.toml                  # hard tabs, Unix line endings
├── udev/70-sora-v2.rules
├── assets/
│   ├── fonts/LiberationSans-Bold.ttf
│   ├── imgs/battery.png
│   ├── icon.png
│   └── manifest.json
├── src/
│   ├── main.rs         (entry point)
│   ├── battery.rs      (action impl + async poll loop)
│   ├── sora_hid.rs     (hidapi feature-report read)
│   └── render.rs       (imageproc label rendering)
└── legacy/             (old TypeScript source — reference only)
```
