import { ICurveProvider, IPlayerProvider, IScoreProvider, IScoreUpdateProvider, ISongProvider } from './base';
import { PlayerIdentifier, Score, Song, DivingFishPlayer, SongDifficulties, SongDifficulty, BuddyNotes, SongDifficultyUtage, CurveObject } from '../models';
import { SongType, LevelIndex, FCType, FSType, RateType } from '../enums';
import type { MaimaiClient, MaimaiSongs } from '../maimai';
import { MaimaiJsError, InvalidPlayerIdentifierError, PrivacyLimitationError, InvalidDeveloperTokenError, InvalidJsonError } from '../exceptions';
import { name_to_genre, divingfish_to_version } from '../enums';

export class DivingFishProvider implements ISongProvider, IPlayerProvider, IScoreProvider, IScoreUpdateProvider, ICurveProvider {
  developer_token?: string;
  base_url = "https://www.diving-fish.com/api/maimaidxprober/";

  constructor(developer_token?: string) {
    this.developer_token = developer_token;
  }

  get headers(): Record<string, string> {
    if (!this.developer_token) {
      throw new InvalidDeveloperTokenError("Developer token is not provided.");
    }
    return { "developer-token": this.developer_token };
  }

  _hash(): string {
    return 'divingfish';
  }

  static _deser_song(song: any): Song {
    return new Song({
      id: parseInt(song.id, 10) % 10000,
      title: parseInt(song.id, 10) !== 383 ? song.basic_info.title : "Link",
      artist: song.basic_info.artist,
      genre: name_to_genre[song.basic_info.genre],
      bpm: song.basic_info.bpm,
      map: undefined,
      rights: undefined,
      aliases: undefined,
      version: divingfish_to_version[song.basic_info.from],
      disabled: false,
      difficulties: { standard: [], dx: [], utage: [] }
    });
  }

  static _deser_diffs(song: any): SongDifficulty[] {
    const song_id = parseInt(song.id, 10);
    const song_type = (SongType as any)[SongType.fromId(song.id.toString()).toUpperCase()];
    const diffs: SongDifficulty[] = [];

    if (song_type === SongType.STANDARD || song_type === SongType.DX) {
      for (let idx = 0; idx < song.charts.length; idx++) {
        const chart = song.charts[idx];
        let touch_num = 0, break_num = 0;
        if (song_type === SongType.DX) {
          touch_num = chart.notes[3] || 0;
          break_num = chart.notes[4] || 0;
        } else {
          break_num = chart.notes[3] || 0;
        }

        diffs.push(new SongDifficulty({
          type: song_type,
          level: song.level[idx],
          level_value: song.ds[idx],
          level_index: idx,
          note_designer: chart.charter,
          version: divingfish_to_version[song.basic_info.from],
          tap_num: chart.notes[0],
          hold_num: chart.notes[1],
          slide_num: chart.notes[2],
          touch_num: touch_num,
          break_num: break_num,
          curve: undefined,
        }));
      }
    } else if (song_type === SongType.UTAGE && song.charts.length > 0) {
      const first_diff = song.charts[0];
      const second_diff = song.charts.length > 1 ? song.charts[1] : null;
      let buddy_notes: BuddyNotes | undefined;
      
      if (second_diff) {
        buddy_notes = {
          left_tap_num: first_diff.notes[0],
          left_hold_num: first_diff.notes[1],
          left_slide_num: first_diff.notes[2],
          left_touch_num: first_diff.notes[3],
          left_break_num: first_diff.notes[4] || 0,
          right_tap_num: second_diff.notes[0],
          right_hold_num: second_diff.notes[1],
          right_slide_num: second_diff.notes[2],
          right_touch_num: second_diff.notes[3],
          right_break_num: second_diff.notes[4] || 0,
        };
      }

      diffs.push(new SongDifficultyUtage({
        diff_id: song_id,
        kanji: song.basic_info.title.substring(1, 2),
        description: "LET'S PARTY!",
        is_buddy: song.charts.length === 2,
        type: song_type,
        level: song.level[0],
        level_value: song.ds[0],
        level_index: 0,
        note_designer: first_diff.charter,
        version: divingfish_to_version[song.basic_info.from],
        tap_num: first_diff.notes[0] + (second_diff ? second_diff.notes[0] : 0),
        hold_num: first_diff.notes[1] + (second_diff ? second_diff.notes[1] : 0),
        slide_num: first_diff.notes[2] + (second_diff ? second_diff.notes[2] : 0),
        touch_num: first_diff.notes[3] + (second_diff ? second_diff.notes[3] : 0),
        break_num: (first_diff.notes[4] || 0) + (second_diff ? (second_diff.notes[4] || 0) : 0),
        buddy_notes: buddy_notes,
        curve: undefined,
      }));
    }
    return diffs;
  }

  static _deser_score(score: any): Score | undefined {
    if (!score || typeof score !== 'object') return undefined;
    return new Score({
      id: score.song_id > 100000 ? score.song_id : score.song_id % 10000,
      level: score.level,
      level_index: score.level_index,
      achievements: score.achievements,
      fc: score.fc ? (FCType as any)[score.fc.toUpperCase()] : undefined,
      fs: score.fs ? (FSType as any)[score.fs.toUpperCase()] : undefined,
      dx_score: score.dxScore,
      dx_rating: score.ra,
      play_count: undefined,
      play_time: undefined,
      rate: (RateType as any)[score.rate.toUpperCase()],
      type: (SongType as any)[SongType.fromId(score.song_id.toString()).toUpperCase()],
    });
  }

  static async _ser_score(score: Score, songs: MaimaiSongs): Promise<any> {
    const song = await songs.by_id(score.id % 10000);
    if (song) {
      let song_title = score.id === 383 ? "Link(CoF)" : song.title;
      if (score.type === SongType.UTAGE) {
        const diff = song.get_difficulty(score.type, score.id) as SongDifficultyUtage;
        if (diff) song_title = `[${diff.kanji}]${song_title}`;
      }
      return {
        title: song_title,
        level_index: score.level_index as number,
        achievements: score.achievements,
        fc: score.fc !== undefined ? FCType[score.fc].toLowerCase() : null,
        fs: score.fs !== undefined ? FSType[score.fs].toLowerCase() : null,
        dxScore: score.dx_score,
        type: score.type === SongType.STANDARD ? "SD" : score.type === SongType.DX ? "DX" : "UTAGE",
      };
    }
    return null;
  }

  static _deser_curve(chart: any): CurveObject {
    return {
      sample_size: parseInt(chart.cnt, 10),
      fit_level_value: chart.fit_diff,
      avg_achievements: chart.avg,
      stdev_achievements: chart.std_dev,
      avg_dx_score: chart.avg_dx,
      rate_sample_size: Object.values(RateType).reduce((acc: any, val: any, i: number) => {
        if (typeof val === 'number') acc[val] = chart.dist[13 - i];
        return acc;
      }, {}),
      fc_sample_size: Object.values(FCType).reduce((acc: any, val: any, i: number) => {
        if (typeof val === 'number') acc[val] = chart.dist[4 - i];
        return acc;
      }, {})
    };
  }

  async _check_response_player(resp: Response): Promise<any> {
    try {
      const resp_json = await resp.json();
      if ([400, 401].includes(resp.status)) throw new InvalidPlayerIdentifierError(resp_json.message);
      if (resp.status === 403) throw new PrivacyLimitationError(resp_json.message);
      if (resp_json.msg && ["请先联系水鱼申请开发者token", "开发者token有误", "开发者token被禁用"].includes(resp_json.msg)) {
        throw new InvalidDeveloperTokenError(resp_json.msg);
      }
      if (resp_json.message && ["导入token有误", "尚未登录", "会话过期"].includes(resp_json.message)) {
        throw new InvalidPlayerIdentifierError(resp_json.message);
      }
      if (!resp.ok) throw new MaimaiJsError(`HTTP Error ${resp.status}`);
      return resp_json;
    } catch (exc) {
      if (exc instanceof MaimaiJsError) throw exc;
      throw new InvalidJsonError();
    }
  }

  async get_songs(client: MaimaiClient): Promise<Song[]> {
    const fetchFn = (client as any)._client?.get ? (u: string, o?: any) => (client as any)._client.get(u, o) : (u: string, o?: any) => fetch(u, o);
    const resp = await fetchFn(this.base_url + "music_data", {});
    if (!resp.ok) throw new MaimaiJsError(`HTTP Error ${resp.status}`);
    const resp_json = await resp.json();
    
    const songs_unique: Record<number, Song> = {};
    for (const song of resp_json) {
      const song_key = parseInt(song.id, 10) % 10000;
      const song_type_str = SongType.fromId(song.id.toString()).toUpperCase();
      const song_type = (SongType as any)[song_type_str];

      if (!songs_unique[song_key]) {
        songs_unique[song_key] = DivingFishProvider._deser_song(song);
      }
      const difficulties = (songs_unique[song_key].difficulties as any)[song_type_str.toLowerCase()];
      if (difficulties) difficulties.push(...DivingFishProvider._deser_diffs(song));
    }
    return Object.values(songs_unique);
  }

  async get_player(identifier: PlayerIdentifier, client: MaimaiClient): Promise<DivingFishPlayer> {
    const fetchFnPost = (client as any)._client?.post ? (u: string, o?: any) => (client as any)._client.post(u, o) : (u: string, o?: any) => fetch(u, { method: 'POST', ...o });
    const resp = await fetchFnPost(this.base_url + "query/player", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(identifier._as_diving_fish())
    });
    const resp_json = await this._check_response_player(resp);
    return new DivingFishPlayer({
      name: resp_json.username,
      rating: resp_json.rating,
      nickname: resp_json.nickname,
      plate: resp_json.plate,
      additional_rating: resp_json.additional_rating,
    });
  }

  async get_scores_all(identifier: PlayerIdentifier, client: MaimaiClient): Promise<Score[]> {
    const fetchFnGet = (client as any)._client?.get ? (u: string, o?: any) => (client as any)._client.get(u, o) : (u: string, o?: any) => fetch(u, o);
    const fetchFnPost = (client as any)._client?.post ? (u: string, o?: any) => (client as any)._client.post(u, o) : (u: string, o?: any) => fetch(u, { method: 'POST', ...o });

    let resp: Response;
    if (identifier.username && identifier.credentials) {
      const login_json = { username: identifier.username, password: identifier.credentials };
      const login_resp = await fetchFnPost("https://www.diving-fish.com/api/maimaidxprober/login", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(login_json)
      });
      await this._check_response_player(login_resp);
      const setCookie = login_resp.headers.get("set-cookie") || "";
      resp = await fetchFnGet(this.base_url + "player/records", { headers: { "Cookie": setCookie } });
    } else if (!identifier.username && identifier.credentials && typeof identifier.credentials === 'string') {
      resp = await fetchFnGet(this.base_url + "player/records", { headers: { "Import-Token": identifier.credentials } });
    } else {
      const params = new URLSearchParams(identifier._as_diving_fish() as any).toString();
      resp = await fetchFnGet(this.base_url + "dev/player/records?" + params, { headers: this.headers });
    }
    const resp_json = await this._check_response_player(resp);
    return resp_json.records.map((s: any) => DivingFishProvider._deser_score(s)).filter((s: any) => s) as Score[];
  }

  async get_scores_best(identifier: PlayerIdentifier, client: MaimaiClient): Promise<Score[]> {
    const fetchFnPost = (client as any)._client?.post ? (u: string, o?: any) => (client as any)._client.post(u, o) : (u: string, o?: any) => fetch(u, { method: 'POST', ...o });
    const resp = await fetchFnPost(this.base_url + "query/player", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ b50: true, ...identifier._as_diving_fish() })
    });
    const resp_json = await this._check_response_player(resp);
    return [...resp_json.charts.sd, ...resp_json.charts.dx]
      .map((s: any) => DivingFishProvider._deser_score(s))
      .filter((s: any) => s) as Score[];
  }

  async get_scores_one(identifier: PlayerIdentifier, song: Song, client: MaimaiClient): Promise<Score[]> {
    const fetchFnPost = (client as any)._client?.post ? (u: string, o?: any) => (client as any)._client.post(u, o) : (u: string, o?: any) => fetch(u, { method: 'POST', ...o });
    const music_id = Array.from(song.get_divingfish_ids());
    const resp = await fetchFnPost(this.base_url + "dev/player/record", {
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ music_id, ...identifier._as_diving_fish() })
    });
    const resp_json = await this._check_response_player(resp);
    const scores: Score[] = [];
    for (const scoreList of Object.values(resp_json) as any[]) {
      for (const s of scoreList) {
        const deser = DivingFishProvider._deser_score(s);
        if (deser) scores.push(deser);
      }
    }
    return scores;
  }

  async update_scores(identifier: PlayerIdentifier, scores: Iterable<Score>, client: MaimaiClient): Promise<void> {
    const fetchFnPost = (client as any)._client?.post ? (u: string, o?: any) => (client as any)._client.post(u, o) : (u: string, o?: any) => fetch(u, { method: 'POST', ...o });
    let headers: Record<string, string> = {};
    const maimai_songs = await client.songs();

    if (identifier.username && identifier.credentials) {
      const login_json = { username: identifier.username, password: identifier.credentials };
      const resp1 = await fetchFnPost("https://www.diving-fish.com/api/maimaidxprober/login", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(login_json)
      });
      await this._check_response_player(resp1);
      const setCookie = resp1.headers.get("set-cookie") || "";
      headers["Cookie"] = setCookie;
    } else if (!identifier.username && identifier.credentials && typeof identifier.credentials === 'string') {
      headers["Import-Token"] = identifier.credentials;
    } else {
      throw new InvalidPlayerIdentifierError("Either username and password or import token is required to deliver scores");
    }

    const scores_json = [];
    for (const score of scores) {
      const s = await DivingFishProvider._ser_score(score, maimai_songs);
      if (s) scores_json.push(s);
    }

    const resp2 = await fetchFnPost(this.base_url + "player/update_records", {
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(scores_json)
    });
    await this._check_response_player(resp2);
  }

  async get_curves(client: MaimaiClient): Promise<Record<string, CurveObject[]>> {
    const fetchFnGet = (client as any)._client?.get ? (u: string, o?: any) => (client as any)._client.get(u, o) : (u: string, o?: any) => fetch(u, o);
    const resp = await fetchFnGet(this.base_url + "chart_stats", {});
    if (!resp.ok) throw new MaimaiJsError(`HTTP Error ${resp.status}`);
    const resp_json = await resp.json();
    const result: Record<string, CurveObject[]> = {};

    for (const [idx, charts] of Object.entries(resp_json.charts)) {
      const idx_int = parseInt(idx, 10);
      const key_idx = idx_int % 10000;
      const typeStr = SongType.fromId(idx_int.toString()).toUpperCase();
      const key = `${key_idx}_${typeStr}`;
      
      const arr = (charts as any[]).filter(c => Object.keys(c).length > 0).map(c => DivingFishProvider._deser_curve(c));
      result[key] = arr;
    }
    return result;
  }
}
