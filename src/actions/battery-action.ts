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
  private pollingInterval: number = 60;

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    streamDeck.logger.info("Action appeared, setting up battery status update");
    await this.updateBattery(ev);
    this.setupPolling(ev);
  }

  override onWillDisappear(_ev: WillDisappearEvent): void {
    streamDeck.logger.info("Action disappeared, cleaning up interval");
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    streamDeck.logger.info("Key down event triggered, forcing battery update");
    await this.updateBattery(ev, true);
  }

  // Renders the key as an SVG image so we get full font/colour control with no
  // extra dependencies. The title overlay is cleared alongside so nothing stacks.
  private renderKey(label: string, color: string): string {
    const fontSize = label.length > 3 ? 44 : 52;
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">`,
      `<rect width="144" height="144" fill="#111111"/>`,
      `<text x="72" y="72"`,
      ` font-family="ui-sans-serif,system-ui,-apple-system,sans-serif"`,
      ` font-size="${fontSize}" font-weight="700"`,
      ` fill="${color}"`,
      ` text-anchor="middle" dominant-baseline="central">${label}</text>`,
      `</svg>`,
    ].join("");
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  }

  private async updateBattery(
    ev: WillAppearEvent | KeyDownEvent,
    _force = false
  ): Promise<void> {
    streamDeck.logger.info("Fetching battery status");

    const result = await getBatteryStatus();
    if (!result) {
      streamDeck.logger.warn("Failed to fetch battery status");
      await ev.action.setTitle("");
      await ev.action.setImage(this.renderKey("N/A", "#666666"));
      return;
    }

    const { battery, charging, fullCharge, online } = result;
    streamDeck.logger.info(
      `Battery: ${battery}%, charging=${charging}, fullCharge=${fullCharge}, online=${online}`
    );

    let label: string;
    if (charging) {
      label = "CHRG";
    } else if (fullCharge) {
      label = "100%";
    } else if (!online) {
      label = "Zzz";
    } else {
      label = `${battery}%`;
    }

    let color = "#4ade80"; // green
    if (battery < 30) {
      color = "#f87171"; // red
    } else if (battery < 60) {
      color = "#fb923c"; // orange
    }

    streamDeck.logger.info(`Rendering key: "${label}" ${color}`);
    await ev.action.setTitle("");
    await ev.action.setImage(this.renderKey(label, color));

    const newInterval = charging || !online ? 5 : 300;
    if (newInterval !== this.pollingInterval) {
      this.pollingInterval = newInterval;
      this.setupPolling(ev);
    }
  }

  private setupPolling(ev: KeyDownEvent | WillAppearEvent): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    streamDeck.logger.info(`Polling interval: ${this.pollingInterval}s`);
    this.intervalId = setInterval(() => {
      void this.updateBattery(ev);
    }, this.pollingInterval * 1000);
  }
}
