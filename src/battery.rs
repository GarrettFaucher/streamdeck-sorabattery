use crate::render::{Renderer, color_for_level, unavailable_image};
use crate::sora_hid::read_battery;
use async_trait::async_trait;
use openaction::*;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Serialize, Deserialize, Default, Clone)]
#[serde(default)]
pub struct BatterySettings {}

pub struct BatteryAction {
	renderer: Arc<Renderer>,
}

impl BatteryAction {
	pub fn new() -> Self {
		Self {
			renderer: Arc::new(Renderer::new()),
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
			let secs = if status.charging || !status.online {
				5
			} else {
				300
			};
			(url, secs)
		}
		_ => (unavailable_image(renderer), 30u64),
	};

	let _ = inst.set_title(Some(String::new()), None).await;
	let _ = inst.set_image(Some(data_url), None).await;
	Some(poll_secs)
}

#[async_trait]
impl Action for BatteryAction {
	const UUID: ActionUuid = "com.garrett-faucher.sorabattery.monitor";
	type Settings = BatterySettings;

	async fn will_appear(
		&self,
		instance: &Instance,
		_settings: &Self::Settings,
	) -> OpenActionResult<()> {
		let instance_id = instance.instance_id.clone();
		let renderer = self.renderer.clone();

		tokio::spawn(async move {
			loop {
				let poll_secs = match refresh(instance_id.clone(), &renderer).await {
					Some(s) => s,
					None => break,
				};
				tokio::time::sleep(std::time::Duration::from_secs(poll_secs)).await;
			}
		});

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
