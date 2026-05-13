// src/actions/battery-hid.ts

import { createRequire } from "node:module";
import streamDeck from "@elgato/streamdeck";

// Import only the type definitions from node-hid
import type { HID as HIDClass, Device as HIDDevice } from "node-hid";

// Use createRequire to load node-hid in a CommonJS-like context
const require = createRequire(import.meta.url);

// node-hid exports { HID, devices, ... }
const nodeHid = require("node-hid") as {
    HID: new (path: string) => HIDClass;
    devices: () => HIDDevice[];
};

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
function getDeviceList(): HIDDevice[]
{
    logDebug("Enumerating HID devices...");
    // We call nodeHid.devices() (not NodeHid() as a constructor).
    let deviceList = nodeHid.devices().filter(
        (d: HIDDevice) => d.vendorId === VID && d.productId === PID_WIRELESS
    );

    if (deviceList.length === 0)
    {
        logDebug("Wireless device not found, checking wired mode...");
        deviceList = nodeHid.devices().filter(
            (d: HIDDevice) => d.vendorId === VID && d.productId === PID_WIRED
        );
        if (deviceList.length === 0)
        {
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
 * From a list of devices, find the path that matches the given usage page.
 * If there's only one device, fallback to that device immediately.
 */
function getDevicePathOrFallback(
    deviceList: HIDDevice[],
    usagePage: number
): string | null
{
    console.log("Searching devices for usagePage:", "0x" + usagePage.toString(16));

    // If there's only one device, just return it.
    if (deviceList.length === 1)
    {
        console.log("Only one device in list; using it without usagePage check.");
        return deviceList[0].path ?? null;
    }

    // Try to find an exact usage page match.
    for (const dev of deviceList)
    {
        console.log("Device in list:", dev);
        if (dev.usagePage === usagePage && dev.path)
        {
            console.log("Matched usagePage exactly:", dev);
            return dev.path;
        }
    }

    // If none matched, fallback to the first device with a path.
    console.warn("No device usagePage matched; falling back to first device with path.");
    for (const dev of deviceList)
    {
        if (dev.path)
        {
            return dev.path;
        }
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
} | null>
{
    logDebug("Starting battery status fetch...");
    let deviceList: HIDDevice[];

    try
    {
        deviceList = getDeviceList();
    }
    catch (err)
    {
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

    let device: HIDClass | null = null;
    try
    {
        // IMPORTANT: new nodeHid.HID(...) is the constructor call
        device = new nodeHid.HID(path);
        logDebug("Device opened successfully.");

        // Send feature report
        device.sendFeatureReport(Array.from(report));
        logDebug("Feature report sent.");

        // Give a tiny delay for the device to respond
        await new Promise((resolve) => setTimeout(resolve, 250));

        // Read the result
        const res = device.getFeatureReport(5, 32);
        logDebug("Received feature report:", res);

        if (!res || res.length < 13)
        {
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
    }
    catch (error)
    {
        logError("Error communicating with HID device:", error);
        return null;
    }
    finally
    {
        if (device)
        {
            logDebug("Closing device...");
            device.close();
        }
    }
}
