// src/plugin.ts
import streamDeck, { LogLevel } from "@elgato/streamdeck";
import { BatteryAction } from "./actions/battery-action";

// Optional: enable trace logging for debugging
streamDeck.logger.setLevel(LogLevel.TRACE);

// Register the battery action
streamDeck.actions.registerAction(new BatteryAction());

// Finally, connect to the Stream Deck
streamDeck.connect();
