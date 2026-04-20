use std::io::{Cursor, Read};

use anyhow::{Result, anyhow};
use byteorder::{LittleEndian, ReadBytesExt};
use std::collections::HashMap;

pub struct OsuReader {
    cursor: Cursor<Vec<u8>>,
}

impl OsuReader {
    pub fn new(data: Vec<u8>) -> Self {
        Self {
            cursor: Cursor::new(data),
        }
    }

    fn read_i16(&mut self) -> Result<i16> {
        Ok(self.cursor.read_i16::<LittleEndian>()?)
    }

    fn read_i32(&mut self) -> Result<i32> {
        Ok(self.cursor.read_i32::<LittleEndian>()?)
    }

    fn read_i64(&mut self) -> Result<i64> {
        Ok(self.cursor.read_i64::<LittleEndian>()?)
    }

    fn read_u8(&mut self) -> Result<u8> {
        Ok(self.cursor.read_u8()?)
    }

    fn read_f32(&mut self) -> Result<f32> {
        Ok(self.cursor.read_f32::<LittleEndian>()?)
    }

    fn read_f64(&mut self) -> Result<f64> {
        Ok(self.cursor.read_f64::<LittleEndian>()?)
    }

    fn read_bool(&mut self) -> Result<bool> {
        Ok(self.read_u8()? != 0)
    }

    fn read_string(&mut self) -> Result<Option<String>> {
        let indicator = self.read_u8()?;

        if indicator == 0 {
            return Ok(None);
        }

        if indicator != 0x0B {
            return Err(anyhow!("Invalid osu string indicator"));
        }

        let len = self.read_uleb128()? as usize;
        let mut buf = vec![0; len];
        self.cursor.read_exact(&mut buf)?;

        Ok(Some(String::from_utf8(buf)?))
    }

    fn read_uleb128(&mut self) -> Result<u64> {
        let mut result = 0;
        let mut shift = 0;

        loop {
            let byte = self.read_u8()?;
            result |= ((byte & 0x7F) as u64) << shift;

            if (byte & 0x80) == 0 {
                break;
            }

            shift += 7;
        }

        Ok(result)
    }
}

#[derive(Debug)]
pub struct TimingPoint {
    pub bpm: f64,
    pub offset: f64,
    pub inherited: bool,
}

#[derive(Debug)]
pub struct Beatmap {
    pub artist_name: Option<String>,
    pub artist_unicode: Option<String>,
    pub song_title: Option<String>,
    pub song_title_unicode: Option<String>,
    pub creator: Option<String>,
    pub difficulty: Option<String>,
    pub audio: Option<String>,
    pub md5: Option<String>,
    pub osu_file_name: Option<String>,

    pub ranked_status: u8,
    pub hitcircles: i16,
    pub slider_count: i16,
    pub spinner_count: i16,
    pub last_modification: i64,

    pub approach_rate: f32,
    pub circle_size: f32,
    pub hp_drain: f32,
    pub overall_difficulty: f32,
    pub slider_velocity: f64,

    pub difficulties: HashMap<i32, f64>,

    pub drain_time: i32,
    pub total_time: i32,
    pub preview_offset: i32,

    pub beatmap_id: i32,
    pub beatmapset_id: i32,
    pub thread_id: i32,

    pub grade_standard: u8,
    pub grade_taiko: u8,
    pub grade_catch: u8,
    pub grade_mania: u8,

    pub local_beatmap_offset: i16,
    pub stack_leniency: f32,

    pub mode: u8,
    pub song_source: Option<String>,
    pub song_tags: Option<String>,

    pub online_beatmap_offset: i16,
    pub title_font: Option<String>,

    pub unplayed: bool,
    pub last_played: i64,
    pub osz2: bool,
    pub folder_name: Option<String>,
    pub last_checked_against_repository: i64,

    pub ignore_sound: bool,
    pub ignore_skin: bool,
    pub disable_storyboard: bool,
    pub disable_video: bool,
    pub visual_override: bool,

    pub last_modification_time: i32,
    pub mania_scroll_speed: u8,

    pub timing_points: Vec<TimingPoint>,
}

#[derive(Debug)]
pub struct OsuDbData {
    pub osuver: i32,
    pub folder_count: i32,
    pub is_unlocked: bool,
    pub date_unlock_ticks: i64,
    pub username: Option<String>,
    pub beatmaps: Vec<Beatmap>,
    pub userperms: i32,
}

//
// =========================
//         PARSER
// =========================
//

pub fn parse_osudb(bytes: Vec<u8>) -> Result<OsuDbData> {
    let mut reader = OsuReader::new(bytes);

    let osuver = reader.read_i32()?;
    let folder_count = reader.read_i32()?;
    let is_unlocked = reader.read_bool()?;
    let date_unlock_ticks = reader.read_i64()?;
    let username = reader.read_string()?;
    let beatmaps_count = reader.read_i32()?;

    let mut beatmaps = Vec::new();

    for _ in 0..beatmaps_count {
        if osuver < 20191107 {
            reader.read_i32()?; // entry size
        }

        let artist_name = reader.read_string()?;
        let artist_unicode = reader.read_string()?;
        let song_title = reader.read_string()?;
        let song_title_unicode = reader.read_string()?;
        let creator = reader.read_string()?;
        let difficulty = reader.read_string()?;
        let audio = reader.read_string()?;
        let md5 = reader.read_string()?;
        let osu_file_name = reader.read_string()?;

        let ranked_status = reader.read_u8()?;
        let hitcircles = reader.read_i16()?;
        let slider_count = reader.read_i16()?;
        let spinner_count = reader.read_i16()?;
        let last_modification = reader.read_i64()?;

        let approach_rate = if osuver < 20140609 {
            reader.read_u8()? as f32
        } else {
            reader.read_f32()?
        };

        let circle_size = if osuver < 20140609 {
            reader.read_u8()? as f32
        } else {
            reader.read_f32()?
        };

        let hp_drain = if osuver < 20140609 {
            reader.read_u8()? as f32
        } else {
            reader.read_f32()?
        };

        let overall_difficulty = if osuver < 20140609 {
            reader.read_u8()? as f32
        } else {
            reader.read_f32()?
        };

        let slider_velocity = reader.read_f64()?;

        let mut difficulties: HashMap<i32, f64> = HashMap::new();

        if osuver >= 20140609 {
            for _ in 0..4 {
                let len = reader.read_i32()?;
                for _ in 0..len {
                    reader.read_u8()?;
                    let mode = reader.read_i32()?;
                    reader.read_u8()?;
                    let diff = if osuver > 20250107 {
                        reader.read_f32()? as f64
                    } else {
                        reader.read_f64()?
                    };

                    difficulties.insert(mode, diff);
                }
            }
        }

        let drain_time = reader.read_i32()?;
        let total_time = reader.read_i32()?;
        let preview_offset = reader.read_i32()?;

        let timing_len = reader.read_i32()?;
        let mut timing_points = Vec::new();
        for _ in 0..timing_len {
            timing_points.push(TimingPoint {
                bpm: reader.read_f64()?,
                offset: reader.read_f64()?,
                inherited: reader.read_bool()?,
            });
        }

        let beatmap_id = reader.read_i32()?;
        let beatmapset_id = reader.read_i32()?;
        let thread_id = reader.read_i32()?;

        let grade_standard = reader.read_u8()?;
        let grade_taiko = reader.read_u8()?;
        let grade_catch = reader.read_u8()?;
        let grade_mania = reader.read_u8()?;

        let local_beatmap_offset = reader.read_i16()?;
        let stack_leniency = reader.read_f32()?;

        let mode = reader.read_u8()?;
        let song_source = reader.read_string()?;
        let song_tags = reader.read_string()?;

        let online_beatmap_offset = reader.read_i16()?;
        let title_font = reader.read_string()?;

        let unplayed = reader.read_bool()?;
        let last_played = reader.read_i64()?;
        let osz2 = reader.read_bool()?;
        let folder_name = reader.read_string()?;
        let last_checked_against_repository = reader.read_i64()?;

        let ignore_sound = reader.read_bool()?;
        let ignore_skin = reader.read_bool()?;
        let disable_storyboard = reader.read_bool()?;
        let disable_video = reader.read_bool()?;
        let visual_override = reader.read_bool()?;

        if osuver < 20140609 {
            reader.read_i16()?;
        }

        let last_modification_time = reader.read_i32()?;
        let mania_scroll_speed = reader.read_u8()?;

        beatmaps.push(Beatmap {
            artist_name,
            artist_unicode,
            song_title,
            song_title_unicode,
            creator,
            difficulty,
            audio,
            md5,
            osu_file_name,
            ranked_status,
            hitcircles,
            slider_count,
            spinner_count,
            last_modification,
            approach_rate,
            circle_size,
            hp_drain,
            overall_difficulty,
            slider_velocity,
            difficulties,
            drain_time,
            total_time,
            preview_offset,
            beatmap_id,
            beatmapset_id,
            thread_id,
            grade_standard,
            grade_taiko,
            grade_catch,
            grade_mania,
            local_beatmap_offset,
            stack_leniency,
            mode,
            song_source,
            song_tags,
            online_beatmap_offset,
            title_font,
            unplayed,
            last_played,
            osz2,
            folder_name,
            last_checked_against_repository,
            ignore_sound,
            ignore_skin,
            disable_storyboard,
            disable_video,
            visual_override,
            last_modification_time,
            mania_scroll_speed,
            timing_points,
        });
    }

    let userperms = reader.read_i32()?;

    Ok(OsuDbData {
        osuver,
        folder_count,
        is_unlocked,
        date_unlock_ticks,
        username,
        beatmaps,
        userperms,
    })
}
