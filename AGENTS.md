# Agent Guide

## Project layout

```
src/
  plugin.ts               entry point — registers BatteryAction, connects to OpenDeck/Stream Deck
  actions/
    battery-action.ts     SingletonAction — polling loop, title/colour updates, key-press handler
    battery-hid.ts        all HID I/O — enumerate device, send feature report, parse battery data
com.garrett-faucher.sorabattery.sdPlugin/
  manifest.json           plugin metadata (UUID, actions, OS support including linux)
  imgs/                   icons shipped with the plugin
  bin/                    rollup output — generated, not committed (plugin.js + package.json)
udev/
  70-sora-v2.rules        udev rule granting hidraw access to the Sora V2 mouse
```

## Build

```sh
npm install   # local only, no global packages
npm run build # rollup → .sdPlugin/bin/plugin.js
```

Rollup bundles `@elgato/streamdeck` and all pure-JS deps. `node-hid` is loaded at runtime via `createRequire(import.meta.url)` and must **not** be bundled — the native `.node` binding cannot be included in the rollup output. Node's module resolution walks up from `bin/plugin.js` to find `node_modules/node-hid/` in the repo root, which works because the plugin is deployed as a symlink (real path stays inside the project tree).

## Deploy

```sh
npm run deploy  # symlinks .sdPlugin into ~/.config/opendeck/plugins/
```

Then restart OpenDeck. To remove: `rm ~/.config/opendeck/plugins/com.garrett-faucher.sorabattery.sdPlugin`.

## Runtime constraints

- **Node ≥ 20** required; OpenDeck uses the system `node` binary.
- **udev rule** must be installed before the plugin can open the mouse (`1915:ae1c` wireless, `1915:ae11` wired). See `udev/70-sora-v2.rules` and the README install steps.
- **Do not add runtime dependencies.** `node-hid` is the only non-bundleable dep; any new runtime library either needs to be bundleable (gets rolled into plugin.js by rollup) or becomes another native module that complicates deployment. Check with the owner before adding deps.

## Key behaviours

- Polling is adaptive: 5 s while charging or sleeping, 5 min on battery.
- `onKeyDown` forces an immediate refresh regardless of interval.
- `getBatteryStatus()` returns `null` on any HID error; the action sets the title to `N/A` and continues.
- Title colour thresholds: green ≥ 60 %, yellow 30–59 %, red < 30 %.

## Testing

No automated test suite. To verify end-to-end:

1. `node -e 'const r=require("node-hid"); console.log(r.devices().filter(d=>d.vendorId===0x1915))'` — confirms hidraw access.
2. Drag the action onto a key in OpenDeck; confirm the percentage appears within ~1 s.
3. Check `~/.config/opendeck/plugins/com.garrett-faucher.sorabattery.sdPlugin/logs/` for TRACE-level output.
