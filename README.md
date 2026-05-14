# streamdeck-sorabattery

An [OpenDeck](https://github.com/nekename/OpenDeck) / Elgato Stream Deck plugin written in Rust that displays the Ninjutso Sora V2 mouse battery percentage on a key.

## Features

- Battery percentage rendered as a colored label on a Stream Deck key
- Green ≥ 60%, Orange 30–59%, Red < 30%
- `CHRG` while charging, `Zzz` when the mouse is off/asleep, `100%` at full charge
- Press the key to force an immediate refresh
- Polls every 5 minutes on battery; every 5 seconds while charging or offline

## Compatibility

| Host | Supported |
|------|-----------|
| OpenDeck (Linux x86_64) | Yes — primary target |
| OpenDeck (Linux aarch64) | Builds in CI |
| OpenDeck (macOS x86_64 / aarch64) | Builds in CI, untested |
| Elgato Stream Deck (Windows) | Builds in CI, untested |

This plugin uses the [`openaction`](https://github.com/OpenActionAPI/rust) crate and stays within the Elgato-compatible feature subset (`set_image`, `set_title`, Keypad controller only).

## Requirements

- Ninjutso Sora V2 (VID `1915`, PID `ae1c` wireless / `ae11` wired)
- Rust 1.85+ (edition 2024)
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
./deploy.sh
```

Or manually:

```sh
PLUGIN_DIR=~/.config/opendeck/plugins/com.garrettfaucher.sorabattery.sdPlugin
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
rm -rf ~/.config/opendeck/plugins/com.garrettfaucher.sorabattery.sdPlugin
sudo rm /etc/udev/rules.d/70-sora-v2.rules
sudo udevadm control --reload-rules && sudo udevadm trigger
```

## Project structure

```
streamdeck-sorabattery/
├── .github/workflows/build.yml   # 5-target CI build matrix
├── Cargo.toml                    # package: oasorabattery
├── rustfmt.toml                  # hard tabs, Unix line endings
├── udev/70-sora-v2.rules
├── assets/
│   ├── fonts/LiberationSans-Bold.ttf
│   ├── imgs/battery.png
│   ├── icon.png
│   └── manifest.json
└── src/
    ├── main.rs         (entry point)
    ├── battery.rs      (action impl + async poll loop)
    ├── sora_hid.rs     (hidapi feature-report read)
    └── render.rs       (imageproc label rendering)
```

## License

MIT — see [LICENSE](LICENSE).
