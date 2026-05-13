use ab_glyph::{Font as _, FontRef, PxScale, ScaleFont as _};
use anyhow::Result;
use base64::{Engine as _, engine::general_purpose};
use image::{Rgba, RgbaImage};
use imageproc::drawing::draw_text_mut;
use std::io::Cursor;

const W: u32 = 144;
const H: u32 = 144;
const BG: Rgba<u8> = Rgba([17, 17, 17, 255]);
const GREY: Rgba<u8> = Rgba([102, 102, 102, 255]);
const GREEN: Rgba<u8> = Rgba([74, 222, 128, 255]);
const ORANGE: Rgba<u8> = Rgba([251, 146, 60, 255]);
const RED: Rgba<u8> = Rgba([248, 113, 113, 255]);

const FONT_BYTES: &[u8] = include_bytes!("../assets/fonts/LiberationSans-Bold.ttf");

pub struct Renderer {
	font_bytes: &'static [u8],
}

impl Renderer {
	pub fn new() -> Self {
		Self {
			font_bytes: FONT_BYTES,
		}
	}

	pub fn render_label(&self, label: &str, color: Rgba<u8>) -> Result<String> {
		let mut img = RgbaImage::from_pixel(W, H, BG);
		let font = FontRef::try_from_slice(self.font_bytes).map_err(|e| anyhow::anyhow!("{e}"))?;

		let scale_px = if label.len() > 3 { 44.0_f32 } else { 52.0_f32 };
		let scale = PxScale {
			x: scale_px,
			y: scale_px,
		};

		// Centre the text horizontally; vertically place it at visual midpoint.
		let sf = font.as_scaled(scale);
		let text_w: f32 = label.chars().map(|c| sf.h_advance(sf.glyph_id(c))).sum();
		let ascent = sf.ascent();
		let descent = sf.descent();
		let text_h = ascent - descent;

		let x = ((W as f32 - text_w) / 2.0).round() as i32;
		let y = ((H as f32 - text_h) / 2.0 + descent.abs()).round() as i32;

		draw_text_mut(&mut img, color, x, y, scale, &font, label);

		let mut buf = Cursor::new(Vec::new());
		img.write_to(&mut buf, image::ImageFormat::Png)?;
		Ok(format!(
			"data:image/png;base64,{}",
			general_purpose::STANDARD.encode(buf.into_inner())
		))
	}
}

pub fn color_for_level(percent: u8) -> Rgba<u8> {
	if percent < 30 {
		RED
	} else if percent < 60 {
		ORANGE
	} else {
		GREEN
	}
}

pub fn unavailable_image(renderer: &Renderer) -> String {
	renderer.render_label("N/A", GREY).unwrap_or_default()
}
