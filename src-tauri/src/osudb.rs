use std::io::{Cursor, Read};

use anyhow::{anyhow, Result};
use byteorder::{LittleEndian, ReadBytesExt};

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
    pub song_title: Option<String>,
    pub difficulty: Option<String>,
    pub md5: Option<String>,

    pub beatmap_id: i32,
    pub beatmapset_id: i32,
    pub mode: u8,

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
        reader.read_string()?; // artist unicode
        let song_title = reader.read_string()?;
        reader.read_string()?; // title unicode
        reader.read_string()?; // creator
        let difficulty = reader.read_string()?;
        reader.read_string()?; // audio
        let md5 = reader.read_string()?;
        reader.read_string()?; // osu file name

        reader.read_u8()?; // ranked
        reader.read_i16()?;
        reader.read_i16()?;
        reader.read_i16()?;
        reader.read_i64()?; // last modification

        if osuver < 20140609 {
            reader.read_u8()?;
            reader.read_u8()?;
            reader.read_u8()?;
            reader.read_u8()?;
        } else {
            reader.read_f32()?;
            reader.read_f32()?;
            reader.read_f32()?;
            reader.read_f32()?;
        }

        reader.read_f64()?; // slider velocity

        for _ in 0..4 {
            let len = reader.read_i32()?;
            for _ in 0..len {
                reader.read_u8()?;
                reader.read_i32()?;
                reader.read_u8()?;
                if osuver > 20250107 {
                    reader.read_f32()?;
                } else {
                    reader.read_f64()?;
                }
            }
        }

        reader.read_i32()?; // drain
        reader.read_i32()?; // total
        reader.read_i32()?; // preview

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
        reader.read_i32()?; // thread id

        reader.read_u8()?;
        reader.read_u8()?;
        reader.read_u8()?;
        reader.read_u8()?;

        reader.read_i16()?;
        reader.read_f32()?;

        let mode = reader.read_u8()?;
        reader.read_string()?;
        reader.read_string()?;

        reader.read_i16()?;
        reader.read_string()?;

        reader.read_bool()?;
        reader.read_i64()?;
        reader.read_bool()?;
        reader.read_string()?;
        reader.read_i64()?;

        reader.read_bool()?;
        reader.read_bool()?;
        reader.read_bool()?;
        reader.read_bool()?;
        reader.read_bool()?;

        if osuver < 20140609 {
            reader.read_i16()?;
        }

        reader.read_i32()?;
        reader.read_u8()?;

        beatmaps.push(Beatmap {
            artist_name,
            song_title,
            difficulty,
            md5,
            beatmap_id,
            beatmapset_id,
            mode,
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