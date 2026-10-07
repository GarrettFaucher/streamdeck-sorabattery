use crate::render::{Renderer, color_for_level, unavailable_image};
use crate::sora_hid::read_battery;
use async_trait::async_trait;
use openaction::*;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::task::JoinHandle;

/// Poll interval while the mouse is on its cable and charging.
const CHARGING_POLL_SECS: u64 = 5;
/// Poll interval on battery, including while the mouse is asleep. Every poll
/// sends a feature report through the receiver, so polling a sleeping mouse
/// quickly keeps it from staying asleep and drains the battery.
const BATTERY_POLL_SECS: u64 = 300;
/// Poll interval when the mouse/receiver could not be read at all.
const ERROR_POLL_SECS: u64 = 30;

#[derive(Serialize, Deserialize, Default, Clone)]
#[serde(default)]
pub struct BatterySettings {}

pub struct BatteryAction {
	renderer: Arc<Renderer>,
	/// One poll loop per visible key; replaced on re-appear, aborted on disappear.
	pollers: Mutex<HashMap<InstanceId, JoinHandle<()>>>,
}

impl BatteryAction {
	pub fn new() -> Self {
		Self {
			renderer: Arc::new(Renderer::new()),
			pollers: Mutex::new(HashMap::new()),
		}
	}
}

async fn refresh(instance_id: InstanceId, renderer: &Renderer) -> Option<u64> {
	let result = tokio::task::spawn_blocking(read_battery).await;
	let inst = get_instance(instance_id).await?;

	let (data_url, poll_secs) = match result {
		Ok(Ok(status)) => {
			let label = if status.charging {
				"CHRG".to_string()
			} else if status.full_charge {
				"100%".to_string()
			} else if !status.online {
				"Zzz".to_string()
			} else {
				format!("{}%", status.percent)
			};
			let color = color_for_level(status.percent);
			let url = renderer
				.render_label(&label, color)
				.unwrap_or_else(|_| unavailable_image(renderer));
			let secs = if status.charging {
				CHARGING_POLL_SECS
			} else {
				BATTERY_POLL_SECS
			};
			(url, secs)
		}
		_ => (unavailable_image(renderer), ERROR_POLL_SECS),
	};

	let _ = inst.set_title(Some(String::new()), None).await;
	let _ = inst.set_image(Some(data_url), None).await;
	Some(poll_secs)
}

#[async_trait]
impl Action for BatteryAction {
	const UUID: ActionUuid = "com.garrettfaucher.sorabattery.monitor";
	type Settings = BatterySettings;

	async fn will_appear(
		&self,
		instance: &Instance,
		_settings: &Self::Settings,
	) -> OpenActionResult<()> {
		let instance_id = instance.instance_id.clone();
		let renderer = self.renderer.clone();

		let poller = tokio::spawn({
			let instance_id = instance_id.clone();
			async move {
				while let Some(poll_secs) = refresh(instance_id.clone(), &renderer).await {
					tokio::time::sleep(std::time::Duration::from_secs(poll_secs)).await;
				}
			}
		});

		if let Some(previous) = self.pollers.lock().insert(instance_id, poller) {
			previous.abort();
		}

		Ok(())
	}

	async fn will_disappear(
		&self,
		instance: &Instance,
		_settings: &Self::Settings,
	) -> OpenActionResult<()> {
		if let Some(poller) = self.pollers.lock().remove(&instance.instance_id) {
			poller.abort();
		}
		Ok(())
	}

	async fn key_down(
		&self,
		instance: &Instance,
		_settings: &Self::Settings,
	) -> OpenActionResult<()> {
		let instance_id = instance.instance_id.clone();
		let renderer = self.renderer.clone();
		tokio::spawn(async move {
			refresh(instance_id, &renderer).await;
		});
		Ok(())
	}
}
