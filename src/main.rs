mod battery;
mod render;
mod sora_hid;

use battery::BatteryAction;
use openaction::*;

#[tokio::main]
async fn main() -> OpenActionResult<()> {
	{
		use simplelog::*;
		if let Err(e) = TermLogger::init(
			LevelFilter::Debug,
			Config::default(),
			TerminalMode::Stdout,
			ColorChoice::Never,
		) {
			eprintln!("Logger initialization failed: {e}");
		}
	}

	register_action(BatteryAction::new()).await;
	run(std::env::args().collect()).await
}
