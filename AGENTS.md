# Agent Guide

## What this repo is

A Rust OpenAction plugin that reads the Ninjutso Sora V2 mouse battery via HID feature reports and renders a colored percentage label on a Stream Deck key.

Uses the `openaction` crate (OpenAction protocol, compatible with both OpenDeck and Elgato Stream Deck software).

## Build

```sh
cargo build --release        # binary: target/release/oasorabattery
cargo check                  # fast type-check without linking
```

Requires `libhidapi-dev` (Linux) or `hidapi` (macOS via Homebrew). Edition 2024 — requires Rust 1.85+.

## Project layout

| File | Purpose |
|------|---------|
| `src/main.rs` | Entry point — registers the action and calls `run()` |
| `src/battery.rs` | `BatteryAction` — `will_appear` spawns the poll loop; `key_down` fires an immediate refresh |
| `src/sora_hid.rs` | `read_battery()` — sync HID I/O run via `spawn_blocking` |
| `src/render.rs` | `Renderer` — renders a text label onto a 144×144 PNG via imageproc/ab_glyph |
| `assets/manifest.json` | Plugin metadata (UUID, action, CodePaths for 5 targets) |
| `assets/fonts/LiberationSans-Bold.ttf` | Bundled font — do not move without updating `include_bytes!` path |
| `udev/70-sora-v2.rules` | udev rule granting hidraw access (Linux only) |

## HID protocol

- VID `0x1915`, PID `0xae1c` (wireless) / `0xae11` (wired), usage page `0xffa0`
- Feature report: `[0]=5, [1]=21, [4]=1`, rest zeros; send then wait 250 ms; get feature report ID 5
- Response bytes: `[9]=percent, [10]=charging, [11]=full_charge, [12]=online`

## Key behaviours

- Poll cadence: 5 s while charging or offline, 300 s on battery.
- `key_down` spawns a one-shot refresh task — does not wait for the main loop.
- `read_battery()` opens and closes the device each call — no persistent handle (avoids conflicts with other software).

## Testing

1. `lsusb | grep 1915` — confirms mouse is seen by USB.
2. After installing, drag **Battery Monitor** onto a key in OpenDeck; confirm the percentage appears within ~1 s.
3. Attach a debugger or check OpenDeck's plugin log for simplelog output.

## Reference

- openaction API: `~/.cargo/registry/src/**/openaction-2.6.*/`
- OpenAction docs: https://github.com/OpenActionAPI/docs
- hidapi crate: https://docs.rs/hidapi
