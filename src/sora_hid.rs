use anyhow::{Result, anyhow};
use hidapi::HidApi;

const VID: u16 = 0x1915;
const PID_WIRELESS: u16 = 0xae1c;
const PID_WIRED: u16 = 0xae11;
const USAGE_PAGE: u16 = 0xffa0;

#[derive(Debug, Clone, Copy)]
pub struct BatteryStatus {
	pub percent: u8,
	pub charging: bool,
	pub full_charge: bool,
	pub online: bool,
}

pub fn read_battery() -> Result<BatteryStatus> {
	let api = HidApi::new()?;

	// Prefer wireless; fall back to wired.
	let dev_info = api
		.device_list()
		.find(|d| {
			d.vendor_id() == VID && d.product_id() == PID_WIRELESS && d.usage_page() == USAGE_PAGE
		})
		.or_else(|| {
			// Single-device fallback when usage_page filtering yields nothing.
			api.device_list()
				.find(|d| d.vendor_id() == VID && d.product_id() == PID_WIRELESS)
		})
		.or_else(|| {
			api.device_list().find(|d| {
				d.vendor_id() == VID && d.product_id() == PID_WIRED && d.usage_page() == USAGE_PAGE
			})
		})
		.or_else(|| {
			api.device_list()
				.find(|d| d.vendor_id() == VID && d.product_id() == PID_WIRED)
		})
		.ok_or_else(|| anyhow!("Sora V2 (1915:AE1C or 1915:AE11) not found — is it plugged in?"))?;

	let device = dev_info.open_device(&api)?;

	// Feature report: ID=5, byte[1]=21, byte[4]=1, rest zeros.
	let mut report = [0u8; 32];
	report[0] = 5;
	report[1] = 21;
	report[4] = 1;
	device.send_feature_report(&report)?;

	// Give the device 250 ms to prepare its response.
	std::thread::sleep(std::time::Duration::from_millis(250));

	let mut buf = [0u8; 32];
	buf[0] = 5;
	let n = device.get_feature_report(&mut buf)?;
	if n < 13 {
		return Err(anyhow!("Short feature report: got {n} bytes, expected ≥13"));
	}

	Ok(BatteryStatus {
		percent: buf[9],
		charging: buf[10] != 0,
		full_charge: buf[11] != 0,
		online: buf[12] != 0,
	})
}
