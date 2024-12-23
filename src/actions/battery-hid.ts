import { createRequire } from "node:module";
import streamDeck from "@elgato/streamdeck";

// Use createRequire to load node-hid as CommonJS
const require = createRequire(import.meta.url);
const HID = require("node-hid");

const MODEL = "Ninjutso Sora V2";
const VID = 0x1915;
const PID_WIRELESS = 0xae1c;
const PID_WIRED = 0xae11;
const USAGE_PAGE = 0xffa0;

function logDebug(message: string, data?: unknown): void
{
  streamDeck.logger.debug(`[DEBUG] ${message}`, data ?? "");
}

function logError(message: string, error?: unknown): void
{
  streamDeck.logger.error(`[ERROR] ${message}`, error ?? "");
}

/**
 * Enumerates the Sora mouse in either wireless or wired mode.
 * Throws an error if neither is found.
 */
function getDeviceList(): HID.Device[] {
  logDebug("Enumerating HID devices...");
  let deviceList = HID.devices().filter(
    (d) => d.vendorId === VID && d.productId === PID_WIRELESS
  );
  if (deviceList.length === 0) {
    logDebug("Wireless device not found, checking wired mode...");
    deviceList = HID.devices().filter(
      (d) => d.vendorId === VID && d.productId === PID_WIRED
    );
    if (deviceList.length === 0) {
      logError("No matching device found for VID:1915 and PID:AE1C or AE11.");
      throw new Error(
        `Device (1915:AE1C or 1915:AE11) not found. Is it plugged in?`
      );
    }
  }
  logDebug("Device list found:", deviceList);
  return deviceList;
}

/**
 * From a list of devices, find the path that matches the given usage_page.
 */
function getDevicePath(deviceList: HID.Device[], usagePage: number): string | null {
  logDebug(`Searching for device with usagePage: 0x${usagePage.toString(16)}...`);
  for (const device of deviceList) {
    logDebug("Checking device:", device);
    if (device.usagePage === usagePage && device.path) {
      logDebug("Device matched:", device);
      return device.path;
    }
  }
  logError(`No device found with usagePage: 0x${usagePage.toString(16)}`);
  return null;
}

function getDevicePathOrFallback(deviceList: HID.Device[], usagePage: number): string | null
{
  console.log("Searching devices for usagePage:", "0x" + usagePage.toString(16));

  // If there's only one device, just return it
  if (deviceList.length === 1)
  {
    console.log("Only one device in list; using it without usagePage check.");
    return deviceList[0].path ?? null;
  }

  for (const dev of deviceList)
  {
    console.log("Device in list:", dev);
    // If dev.usagePage is undefined, dev.usage might be present
    // or no usage data at all. We'll match either exact or fallback.
    if (dev.usagePage === usagePage && dev.path)
    {
      console.log("Matched usagePage exactly:", dev);
      return dev.path;
    }
  }

  // If we got here, no device usagePage matched. If you want a fallback approach:
  console.warn("No device usagePage matched; falling back to first device with path.");
  for (const dev of deviceList)
  {
    if (dev.path) return dev.path;
  }

  return null;
}

/**
 * Opens the HID device, sends the feature report, and reads battery data.
 * Returns a tuple of (battery, charging, fullCharge, online) or null on error.
 */
export async function getBatteryStatus(): Promise<{
  battery: number;
  charging: number;
  fullCharge: number;
  online: number;
} | null> {
  logDebug("Starting battery status fetch...");
  let deviceList: HID.Device[];

  try {
    deviceList = getDeviceList();
  } catch (err) {
    logError("Error enumerating devices:", err);
    return null;
  }

  const path = getDevicePathOrFallback(deviceList, USAGE_PAGE);
  if (!path)
  {
    logError("No usable device path found.");
    return null;
  }

  logDebug(`Device path selected: ${path}`);

  // Prepare a feature report to request battery info
  const report = Buffer.alloc(32, 0);
  report[0] = 5; // Report ID
  report[1] = 21;
  report[4] = 1;
  logDebug("Prepared feature report:", report);

  let device: HID.HID | null = null;
  try {
    device = new HID.HID(path);
    logDebug("Device opened successfully.");

    // Send feature report
    device.sendFeatureReport(Array.from(report));
    logDebug("Feature report sent.");

    // Give a tiny delay for the device to respond
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Read the result
    const res = device.getFeatureReport(5, 32);
    logDebug("Received feature report:", res);

    if (!res || res.length < 13) {
      logError("Incomplete report received.", res);
      return null;
    }

    const battery = res[9];
    const charging = res[10];
    const fullCharge = res[11];
    const online = res[12];
    logDebug("Battery status parsed:", {
      battery,
      charging,
      fullCharge,
      online,
    });
    return { battery, charging, fullCharge, online };
  } catch (error) {
    logError("Error communicating with HID device:", error);
    return null;
  } finally {
    if (device) {
      logDebug("Closing device...");
      device.close();
    }
  }
}
