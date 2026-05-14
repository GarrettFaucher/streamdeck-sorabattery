use ab_glyph::{Font as _, FontRef, PxScale, ScaleFont as _, point};
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

		// Layout glyphs as draw_text_mut does, then union their px_bounds for
		// the actual visible ink rectangle. h_advance includes side-bearings,
		// which causes visual mis-centering (especially with '%').
		let sf = font.as_scaled(scale);
		let mut caret = 0.0_f32;
		let mut prev_id = None;
		let mut min_x = f32::INFINITY;
		let mut max_x = f32::NEG_INFINITY;
		let mut min_y = f32::INFINITY;
		let mut max_y = f32::NEG_INFINITY;
		for c in label.chars() {
			let gid = sf.glyph_id(c);
			if let Some(prev) = prev_id {
				caret += sf.kern(prev, gid);
			}
			let glyph = gid.with_scale_and_position(scale, point(caret, sf.ascent()));
			if let Some(outlined) = font.outline_glyph(glyph) {
				let bb = outlined.px_bounds();
				min_x = min_x.min(bb.min.x);
				max_x = max_x.max(bb.max.x);
				min_y = min_y.min(bb.min.y);
				max_y = max_y.max(bb.max.y);
			}
			caret += sf.h_advance(gid);
			prev_id = Some(gid);
		}
		let (x, y) = if min_x.is_finite() {
			let vw = max_x - min_x;
			let vh = max_y - min_y;
			let x = ((W as f32 - vw) / 2.0 - min_x).round() as i32;
			let y = ((H as f32 - vh) / 2.0 - min_y).round() as i32;
			(x, y)
		} else {
			(0, 0)
		};

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
