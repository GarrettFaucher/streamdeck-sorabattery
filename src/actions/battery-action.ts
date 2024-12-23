import {
  streamDeck,
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import { getBatteryStatus } from "./battery-hid";

streamDeck.logger.info("Imported required modules and dependencies");

@action({ UUID: "com.garrett-faucher.sora-battery.monitor" })
export class BatteryAction extends SingletonAction {
  private intervalId?: ReturnType<typeof setInterval>;
  private pollingInterval: number = 60; // Default polling interval (in seconds)

  /**
   * Called when the action first appears. Sets up periodic polling.
   */
  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    streamDeck.logger.info("Action appeared, setting up battery status update");

    // Initial battery status update
    await this.updateBattery(ev);

    // Start polling with the default interval
    this.setupPolling(ev);
  }

  /**
   * Cleanup interval when the action disappears.
   */
  override onWillDisappear(_ev: WillDisappearEvent): void {
    streamDeck.logger.info("Action disappeared, cleaning up interval");

    if (this.intervalId) {
      clearInterval(this.intervalId);
      streamDeck.logger.info("Polling interval cleared");
      this.intervalId = undefined;
    }
  }

  /**
   * Trigger an immediate update when the button is pressed.
   */
  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    streamDeck.logger.info("Key down event triggered, forcing battery update");
    await this.updateBattery(ev, true); // Force an immediate update
  }

  /**
   * Fetch the battery status and update the button title.
   * Also adjust polling interval based on battery state.
   * @param ev The event object
   * @param force Optional flag to skip rate-limiting checks
   */
  private async updateBattery(
    ev: WillAppearEvent | KeyDownEvent,
    force = false
  ): Promise<void> {
    streamDeck.logger.info("Fetching battery status");

    // Optional: rate-limit updates if needed (use `force` to bypass)
    const result = await getBatteryStatus();
    if (!result) {
      streamDeck.logger.warn("Failed to fetch battery status, setting title to N/A");
      await ev.action.setTitle("N/A");
      return;
    }

    const { battery, charging, fullCharge, online } = result;
    streamDeck.logger.info(
      `Battery status: ${battery}%, Charging: ${charging}, FullCharge: ${fullCharge}, Online: ${online}`
    );

    // Update the title based on battery state
    let titleText = `${battery}%`;
    if (charging) {
      titleText = "CHRG";
    } else if (fullCharge) {
      titleText = "100%";
    } else if (!online) {
      titleText = "Zzz";
    }

    streamDeck.logger.info(`Setting button title to: ${titleText}`);
    await ev.action.setTitle(titleText);

    // Adjust polling interval based on charging state
    const newInterval = charging || !online ? 5 : 300; // 1 minute if charging, 5 minutes if on battery
    if (newInterval !== this.pollingInterval) {
      this.pollingInterval = newInterval;
      this.setupPolling(ev);
    }
  }

  /**
   * Set up polling with the current polling interval.
   * @param ev The event object to pass to the polling function.
   */
  private setupPolling(ev: WillAppearEvent): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    streamDeck.logger.info(`Setting polling interval to ${this.pollingInterval} seconds`);
    this.intervalId = setInterval(() => {
      streamDeck.logger.info("Polling battery status");
      void this.updateBattery(ev);
    }, this.pollingInterval * 1000);
  }
}
