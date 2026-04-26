import { Genre, LevelIndex, SongType, FCType, FSType, RateType } from './enums';
import { UNSET, UnsetSentinel, isUnset } from './utils';
import { InvalidPlayerIdentifierError } from './exceptions';

export interface CurveObject {
  sample_size: number;
  fit_level_value: number;
  avg_achievements: number;
  stdev_achievements: number;
  avg_dx_score: number;
  rate_sample_size: Record<number, number>;
  fc_sample_size: Record<number, number>;
}

export interface BuddyNotes {
  left_tap_num: number;
  left_hold_num: number;
  left_slide_num: number;
  left_touch_num: number;
  left_break_num: number;
  right_tap_num: number;
  right_hold_num: number;
  right_slide_num: number;
  right_touch_num: number;
  right_break_num: number;
}

export class SongDifficulty {
  type: SongType;
  level: string;
  level_value: number;
  level_index: LevelIndex | number;
  note_designer: string;
  version: number;
  tap_num: number;
  hold_num: number;
  slide_num: number;
  touch_num: number;
  break_num: number;
  curve?: CurveObject;

  constructor(data: any) {
    this.type = data.type;
    this.level = data.level;
    this.level_value = data.level_value;
    this.level_index = data.level_index;
    this.note_designer = data.note_designer;
    this.version = data.version;
    this.tap_num = data.tap_num;
    this.hold_num = data.hold_num;
    this.slide_num = data.slide_num;
    this.touch_num = data.touch_num;
    this.break_num = data.break_num;
    this.curve = data.curve;
  }

  get level_dx_score(): number {
    return (this.tap_num + this.hold_num + this.slide_num + this.break_num + this.touch_num) * 3;
  }
}

export class SongDifficultyUtage extends SongDifficulty {
  kanji: string;
  description: string;
  diff_id: number;
  is_buddy: boolean;
  buddy_notes?: BuddyNotes;

  constructor(data: any) {
    super(data);
    this.kanji = data.kanji;
    this.description = data.description;
    this.diff_id = data.diff_id;
    this.is_buddy = data.is_buddy;
    this.buddy_notes = data.buddy_notes;
  }
}

export interface SongDifficulties {
  standard: SongDifficulty[];
  dx: SongDifficulty[];
  utage: SongDifficultyUtage[];
}

export class Song {
  id: number;
  title: string;
  artist: string;
  genre: Genre;
  bpm: number;
  map?: string;
  version: number;
  rights?: string;
  aliases?: string[];
  disabled: boolean;
  difficulties: SongDifficulties;

  constructor(data: any) {
    this.id = data.id;
    this.title = data.title;
    this.artist = data.artist;
    this.genre = data.genre;
    this.bpm = data.bpm;
    this.map = data.map;
    this.version = data.version;
    this.rights = data.rights;
    this.aliases = data.aliases;
    this.disabled = data.disabled;
    this.difficulties = {
      standard: (data.difficulties?.standard || []).map((d: any) => new SongDifficulty(d)),
      dx: (data.difficulties?.dx || []).map((d: any) => new SongDifficulty(d)),
      utage: (data.difficulties?.utage || []).map((d: any) => new SongDifficultyUtage(d))
    };
  }

  get_difficulty(type: SongType, level_index: LevelIndex | number): SongDifficulty | undefined {
    if (type === SongType.DX) {
      return this.difficulties.dx.find(diff => diff.level_index === level_index);
    }
    if (type === SongType.STANDARD) {
      return this.difficulties.standard.find(diff => diff.level_index === level_index);
    }
    if (type === SongType.UTAGE) {
      if (typeof level_index === 'number') {
        return this.difficulties.utage.find(diff => diff.diff_id === level_index);
      }
      // If it's a LevelIndex (which is unusual for UTAGE but possible in some cases like iteration)
      return this.difficulties.utage[0];
    }
    return undefined;
  }

  get_difficulties(song_type: SongType | UnsetSentinel = UNSET): SongDifficulty[] {
    if (isUnset(song_type)) {
      return [...this.difficulties.standard, ...this.difficulties.dx, ...this.difficulties.utage];
    }
    if (song_type === SongType.DX) return this.difficulties.dx;
    if (song_type === SongType.STANDARD) return this.difficulties.standard;
    if (song_type === SongType.UTAGE) return this.difficulties.utage;
    return [];
  }

  get_divingfish_id(type: SongType, level_index: LevelIndex | number): number {
    const diff = this.get_difficulty(type, level_index);
    if (diff) {
      if (diff.type === SongType.STANDARD) return this.id;
      if (diff.type === SongType.DX) return this.id + 10000;
      if (diff.type === SongType.UTAGE) return (diff as SongDifficultyUtage).diff_id;
    }
    throw new Error(`No difficulty found for type ${type} and level index ${level_index}`);
  }

  get_divingfish_ids(song_type: SongType | UnsetSentinel = UNSET): Set<number> {
    const ids = new Set<number>();
    for (const difficulty of this.get_difficulties(song_type)) {
      ids.add(this.get_divingfish_id(difficulty.type, difficulty.level_index as number));
    }
    return ids;
  }
}

export class PlayerIdentifier {
  qq?: number;
  username?: string;
  friend_code?: number;
  credentials?: string | Record<string, any>;

  constructor(data: Partial<PlayerIdentifier> = {}) {
    this.qq = data.qq;
    this.username = data.username;
    this.friend_code = data.friend_code;
    this.credentials = data.credentials;
  }

  _is_empty(): boolean {
    return this.qq === undefined && this.username === undefined && this.friend_code === undefined && this.credentials === undefined;
  }

  _as_diving_fish(): Record<string, any> {
    if (this.qq !== undefined) return { qq: this.qq.toString() };
    if (this.username !== undefined) return { username: this.username };
    if (this.friend_code !== undefined) throw new InvalidPlayerIdentifierError("Friend code is not applicable for Diving Fish");
    throw new InvalidPlayerIdentifierError("No valid identifier provided");
  }

  _as_lxns(): string {
    if (this.friend_code !== undefined) return this.friend_code.toString();
    if (this.qq !== undefined) return `qq/${this.qq}`;
    if (this.username !== undefined) throw new InvalidPlayerIdentifierError("Username is not applicable for LXNS");
    throw new InvalidPlayerIdentifierError("No valid identifier provided");
  }
}

export class PlayerItem {
  static _namespace(): string {
    throw new Error("Not Implemented");
  }
}

export class PlayerTrophy extends PlayerItem {
  id: number;
  name: string;
  color: string;
  constructor(data: any) { super(); this.id = data.id; this.name = data.name; this.color = data.color; }
  static _namespace() { return "trophies"; }
}

export class PlayerIcon extends PlayerItem {
  id: number;
  name: string;
  description?: string;
  genre?: string;
  constructor(data: any) { super(); this.id = data.id; this.name = data.name; this.description = data.description; this.genre = data.genre; }
  static _namespace() { return "icons"; }
}

export class PlayerNamePlate extends PlayerItem {
  id: number;
  name: string;
  description?: string;
  genre?: string;
  constructor(data: any) { super(); this.id = data.id; this.name = data.name; this.description = data.description; this.genre = data.genre; }
  static _namespace() { return "nameplates"; }
}

export class PlayerFrame extends PlayerItem {
  id: number;
  name: string;
  description?: string;
  genre?: string;
  constructor(data: any) { super(); this.id = data.id; this.name = data.name; this.description = data.description; this.genre = data.genre; }
  static _namespace() { return "frames"; }
}

export class PlayerPartner extends PlayerItem {
  id: number;
  name: string;
  constructor(data: any) { super(); this.id = data.id; this.name = data.name; }
  static _namespace() { return "partners"; }
}

export class PlayerChara extends PlayerItem {
  id: number;
  name: string;
  constructor(data: any) { super(); this.id = data.id; this.name = data.name; }
  static _namespace() { return "charas"; }
}

export interface PlayerRegion {
  region_id: number;
  region_name: string;
  play_count: number;
  created_at: Date | string;
}

export class Player {
  name: string;
  rating: number;
  constructor(data: any) { this.name = data.name; this.rating = data.rating; }
}

export class DivingFishPlayer extends Player {
  nickname: string;
  plate: string;
  additional_rating: number;
  constructor(data: any) {
    super(data);
    this.nickname = data.nickname;
    this.plate = data.plate;
    this.additional_rating = data.additional_rating;
  }
}

export class LXNSPlayer extends Player {
  friend_code: number;
  course_rank: number;
  class_rank: number;
  star: number;
  frame?: PlayerFrame;
  icon?: PlayerIcon;
  trophy?: PlayerTrophy;
  name_plate?: PlayerNamePlate;
  upload_time: string;
  constructor(data: any) {
    super(data);
    this.friend_code = data.friend_code;
    this.course_rank = data.course_rank;
    this.class_rank = data.class_rank;
    this.star = data.star;
    this.frame = data.frame;
    this.icon = data.icon;
    this.trophy = data.trophy;
    this.name_plate = data.name_plate;
    this.upload_time = data.upload_time;
  }
}

export class ArcadePlayer extends Player {
  is_login: boolean;
  icon?: PlayerIcon;
  trophy?: PlayerTrophy;
  name_plate?: PlayerNamePlate;
  constructor(data: any) {
    super(data);
    this.is_login = data.is_login;
    this.icon = data.icon;
    this.trophy = data.trophy;
    this.name_plate = data.name_plate;
  }
}

export class WechatPlayer extends Player {
  friend_code: number;
  star: number;
  trophy?: PlayerTrophy;
  token?: string;
  constructor(data: any) {
    super(data);
    this.friend_code = data.friend_code;
    this.star = data.star;
    this.trophy = data.trophy;
    this.token = data.token;
  }
}

export interface AreaCharacter {
  name: string;
  illustrator: string;
  description1: string;
  description2: string;
  team: string;
  props: Record<string, string>;
}

export interface AreaSong {
  id?: number;
  title: string;
  artist: string;
  description: string;
  illustrator?: string;
  movie?: string;
}

export class Area {
  id: string;
  name: string;
  comment: string;
  description: string;
  video_id: string;
  characters: AreaCharacter[];
  songs: AreaSong[];
  constructor(data: any) {
    this.id = data.id;
    this.name = data.name;
    this.comment = data.comment;
    this.description = data.description;
    this.video_id = data.video_id;
    this.characters = data.characters;
    this.songs = data.songs;
  }
}

export class Score {
  id: number;
  level: string;
  level_index: LevelIndex;
  achievements?: number;
  fc?: FCType;
  fs?: FSType;
  dx_score?: number;
  dx_rating?: number;
  play_count?: number;
  play_time?: Date | string;
  rate: RateType;
  type: SongType;

  constructor(data: any) {
    this.id = data.id;
    this.level = data.level;
    this.level_index = data.level_index;
    this.achievements = data.achievements;
    this.fc = data.fc;
    this.fs = data.fs;
    this.dx_score = data.dx_score;
    this.dx_rating = data.dx_rating;
    this.play_count = data.play_count;
    this.play_time = data.play_time;
    this.rate = data.rate;
    this.type = data.type;
  }

  _compare(other?: Score): Score {
    if (!other) return this;
    if (this.dx_score !== other.dx_score) {
      return (this.dx_score || 0) > (other.dx_score || 0) ? this : other;
    }
    if (this.achievements !== other.achievements) {
      return (this.achievements || 0) > (other.achievements || 0) ? this : other;
    }
    if (this.rate !== other.rate) {
      const self_rate = this.rate !== undefined ? this.rate : 100;
      const other_rate = other.rate !== undefined ? other.rate : 100;
      return self_rate < other_rate ? this : other;
    }
    if (this.fc !== other.fc) {
      const self_fc = this.fc !== undefined ? this.fc : 100;
      const other_fc = other.fc !== undefined ? other.fc : 100;
      return self_fc < other_fc ? this : other;
    }
    if (this.fs !== other.fs) {
      const self_fs = this.fs !== undefined ? this.fs : -1;
      const other_fs = other.fs !== undefined ? other.fs : -1;
      return self_fs > other_fs ? this : other;
    }
    return this;
  }

  _join(other?: Score): Score {
    if (other) {
      if (this.level_index !== other.level_index || this.type !== other.type) {
        throw new Error("Cannot join scores with different level indexes or types");
      }
      this.achievements = Math.max(this.achievements || 0, other.achievements || 0);
      if (this.fc !== other.fc) {
        const self_fc = this.fc !== undefined ? this.fc : 100;
        const other_fc = other.fc !== undefined ? other.fc : 100;
        const selected_value = Math.min(self_fc, other_fc);
        this.fc = selected_value !== 100 ? selected_value as FCType : undefined;
      }
      if (this.fs !== other.fs) {
        const self_fs = this.fs !== undefined ? this.fs : -1;
        const other_fs = other.fs !== undefined ? other.fs : -1;
        const selected_value = Math.max(self_fs, other_fs);
        this.fs = selected_value !== -1 ? selected_value as FSType : undefined;
      }
      if (this.rate !== other.rate) {
        const self_rate = this.rate !== undefined ? this.rate : 100;
        const other_rate = other.rate !== undefined ? other.rate : 100;
        this.rate = Math.min(self_rate, other_rate) as RateType;
      }
      if (this.play_count !== other.play_count) {
        this.play_count = Math.max(this.play_count || 0, other.play_count || 0);
      }
    }
    return this;
  }
}

export class ScoreExtend extends Score {
  title: string;
  level_value: number;
  level_dx_score: number;
  dx_star?: number;
  version: number;

  constructor(data: any) {
    super(data);
    this.title = data.title;
    this.level_value = data.level_value;
    this.level_dx_score = data.level_dx_score;
    this.dx_star = data.dx_star;
    this.version = data.version;
  }
}

export class PlateObject {
  song: Song;
  levels: Set<LevelIndex>;
  scores: ScoreExtend[];
  constructor(data: any) {
    this.song = data.song;
    this.levels = data.levels;
    this.scores = data.scores;
  }
}

export class PlayerSong {
  song: Song;
  scores: ScoreExtend[];
  constructor(data: any) {
    this.song = data.song;
    this.scores = data.scores;
  }
}

export class PlayerBests {
  rating: number;
  rating_b35: number;
  rating_b15: number;
  scores_b35: ScoreExtend[];
  scores_b15: ScoreExtend[];

  constructor(data: any) {
    this.rating = data.rating;
    this.rating_b35 = data.rating_b35;
    this.rating_b15 = data.rating_b15;
    this.scores_b35 = data.scores_b35;
    this.scores_b15 = data.scores_b15;
  }

  get scores(): ScoreExtend[] {
    return [...this.scores_b35, ...this.scores_b15];
  }
}
