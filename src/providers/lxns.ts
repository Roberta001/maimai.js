import { IAliasProvider, IItemListProvider, IPlayerProvider, IScoreProvider, IScoreUpdateProvider, ISongProvider } from './base';
import { PlayerIdentifier, Score, Song, PlayerIcon, PlayerNamePlate, PlayerFrame, PlayerTrophy, LXNSPlayer, SongDifficulties, SongDifficulty, BuddyNotes, SongDifficultyUtage } from '../models';
import { SongType, LevelIndex, FCType, FSType, RateType } from '../enums';
import type { MaimaiClient } from '../maimai';
import { MaimaiJsError, InvalidPlayerIdentifierError, PrivacyLimitationError, InvalidDeveloperTokenError, InvalidJsonError } from '../exceptions';
import { name_to_genre } from '../enums';

export class LXNSProvider implements ISongProvider, IPlayerProvider, IScoreProvider, IScoreUpdateProvider, IAliasProvider, IItemListProvider {
  developer_token?: string;
  base_url = "https://maimai.lxns.net/";

  constructor(developer_token?: string) {
    this.developer_token = developer_token;
  }

  get headers(): Record<string, string> {
    if (!this.developer_token) {
      throw new InvalidDeveloperTokenError("Developer token is not provided.");
    }
    return { "Authorization": this.developer_token };
  }

  _hash(): string {
    return 'lxns';
  }

  async _ensure_friend_code(client: MaimaiClient, identifier: PlayerIdentifier): Promise<void> {
    if (identifier.friend_code === undefined) {
      if (identifier.qq !== undefined) {
        const fetchFn = (client as any)._client?.get ? (u: string, o?: any) => (client as any)._client.get(u, o) : (u: string, o?: any) => fetch(u, o);
        const resp = await fetchFn(this.base_url + `api/v0/maimai/player/qq/${identifier.qq}`, { headers: this.headers });
        const resp_json = await resp.json();
        if (!resp_json.success) {
          throw new InvalidPlayerIdentifierError(resp_json.message);
        }
        identifier.friend_code = resp_json.data.friend_code;
      }
    }
  }

  async _build_player_request(path: string, identifier: PlayerIdentifier, client: MaimaiClient): Promise<[string, Record<string, string>, boolean]> {
    const use_user_api = identifier.credentials !== undefined && typeof identifier.credentials === 'string';
    let entrypoint = "";
    let reqHeaders: Record<string, string> = {};

    if (use_user_api) {
      entrypoint = `api/v0/user/maimai/player/${path}`;
      const cred = identifier.credentials as string;
      const is_jwt = /^[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+$/.test(cred);
      reqHeaders = is_jwt ? { "Authorization": `Bearer ${cred}` } : { "X-User-Token": cred };
    } else {
      await this._ensure_friend_code(client, identifier);
      entrypoint = `api/v0/maimai/player/${identifier.friend_code}/${path}`;
      reqHeaders = this.headers;
    }
    if (entrypoint.endsWith("/")) {
      entrypoint = entrypoint.slice(0, -1);
    }
    return [this.base_url + entrypoint, reqHeaders, use_user_api];
  }

  static _deser_note(diff: any, key: string): number {
    if (diff.notes) {
      if (diff.is_buddy) {
        return (diff.notes.left[key] || 0) + (diff.notes.right[key] || 0);
      }
      return diff.notes[key] || 0;
    }
    return 0;
  }

  static _deser_buddy_notes(diff: any): BuddyNotes | undefined {
    if (diff.notes && diff.is_buddy) {
      return {
        left_tap_num: diff.notes.left.tap || 0,
        left_hold_num: diff.notes.left.hold || 0,
        left_slide_num: diff.notes.left.slide || 0,
        left_touch_num: diff.notes.left.touch || 0,
        left_break_num: diff.notes.left.break || 0,
        right_tap_num: diff.notes.right.tap || 0,
        right_hold_num: diff.notes.right.hold || 0,
        right_slide_num: diff.notes.right.slide || 0,
        right_touch_num: diff.notes.right.touch || 0,
        right_break_num: diff.notes.right.break || 0,
      };
    }
    return undefined;
  }

  static _deser_song(song: any): Song {
    return new Song({
      id: parseInt(song.id, 10) % 10000,
      title: song.title,
      artist: song.artist,
      genre: name_to_genre[song.genre],
      bpm: song.bpm,
      aliases: song.aliases,
      map: song.map,
      version: song.version,
      rights: song.rights,
      disabled: song.disabled || false,
      difficulties: { standard: [], dx: [], utage: [] }
    });
  }

  static _deser_diff(difficulty: any): SongDifficulty {
    return new SongDifficulty({
      type: (SongType as any)[difficulty.type.toUpperCase()],
      level: difficulty.level,
      level_value: difficulty.level_value,
      level_index: difficulty.difficulty,
      note_designer: difficulty.note_designer,
      version: difficulty.version,
      tap_num: LXNSProvider._deser_note(difficulty, "tap"),
      hold_num: LXNSProvider._deser_note(difficulty, "hold"),
      slide_num: LXNSProvider._deser_note(difficulty, "slide"),
      touch_num: LXNSProvider._deser_note(difficulty, "touch"),
      break_num: LXNSProvider._deser_note(difficulty, "break"),
      curve: undefined,
    });
  }

  static _deser_diff_utage(difficulty: any, diff_id: number): SongDifficultyUtage {
    const base = LXNSProvider._deser_diff(difficulty);
    return new SongDifficultyUtage({
      ...base,
      type: SongType.UTAGE, // Ensure utage
      diff_id,
      kanji: difficulty.kanji,
      description: difficulty.description,
      is_buddy: difficulty.is_buddy,
      buddy_notes: LXNSProvider._deser_buddy_notes(difficulty),
    });
  }

  static _deser_score(score: any): Score {
    return new Score({
      id: score.id,
      level: score.level,
      level_index: score.level_index,
      achievements: score.achievements,
      fc: score.fc ? (FCType as any)[score.fc.toUpperCase()] : undefined,
      fs: score.fs ? (FSType as any)[score.fs.toUpperCase()] : undefined,
      dx_score: score.dx_score,
      dx_rating: score.dx_rating ? parseInt(score.dx_rating, 10) : undefined,
      play_count: undefined,
      play_time: undefined,
      rate: (RateType as any)[score.rate.toUpperCase()],
      type: (SongType as any)[score.type.toUpperCase()]
    });
  }

  static async _ser_score(score: Score): Promise<any> {
    return {
      id: score.id,
      level_index: score.level_index,
      achievements: score.achievements,
      fc: score.fc !== undefined ? FCType[score.fc].toLowerCase() : null,
      fs: score.fs !== undefined ? FSType[score.fs].toLowerCase() : null,
      dx_score: score.dx_score,
      play_time: score.play_time instanceof Date ? score.play_time.toISOString().replace(/\.\d{3}Z$/, 'Z') : score.play_time || null,
      type: score.type
    };
  }

  async _check_response_player(resp: Response): Promise<any> {
    try {
      const resp_json = await resp.json();
      if (!resp_json.success) {
        if ([400, 404].includes(resp_json.code)) throw new InvalidPlayerIdentifierError(resp_json.message);
        if (resp_json.code === 403) throw new PrivacyLimitationError(resp_json.message);
        if (resp_json.code === 401) throw new InvalidDeveloperTokenError(resp_json.message);
        if ([400, 401].includes(resp.status)) throw new InvalidPlayerIdentifierError(resp_json.message);
        if (!resp.ok) throw new MaimaiJsError(`HTTP Error ${resp.status}`);
      }
      return resp_json;
    } catch (exc) {
      if (exc instanceof MaimaiJsError) throw exc;
      throw new InvalidJsonError();
    }
  }

  async get_songs(client: MaimaiClient): Promise<Song[]> {
    const fetchFn = (client as any)._client?.get ? (u: string, o?: any) => (client as any)._client.get(u, o) : (u: string, o?: any) => fetch(u, o);
    const resp = await fetchFn(this.base_url + "api/v0/maimai/song/list?notes=true", {});
    const resp_json = await resp.json();
    const songs_unique: Record<number, Song> = {};

    for (const song of resp_json.songs) {
      const lxns_id = parseInt(song.id, 10);
      const song_key = lxns_id % 10000;
      if (!songs_unique[song_key]) {
        songs_unique[song_key] = LXNSProvider._deser_song(song);
      }
      const difficulties = songs_unique[song_key].difficulties;
      if (song.difficulties.standard) {
        difficulties.standard.push(...song.difficulties.standard.map((d: any) => LXNSProvider._deser_diff(d)));
      }
      if (song.difficulties.dx) {
        difficulties.dx.push(...song.difficulties.dx.map((d: any) => LXNSProvider._deser_diff(d)));
      }
      if (song.difficulties.utage) {
        difficulties.utage.push(...song.difficulties.utage.map((d: any) => LXNSProvider._deser_diff_utage(d, lxns_id)));
      }
    }
    return Object.values(songs_unique);
  }

  async get_player(identifier: PlayerIdentifier, client: MaimaiClient): Promise<LXNSPlayer> {
    const [maimai_frames, maimai_icons, maimai_trophies, maimai_nameplates] = await Promise.all([
      client.items(PlayerFrame), client.items(PlayerIcon), client.items(PlayerTrophy), client.items(PlayerNamePlate)
    ]);
    const [url, headers] = await this._build_player_request("", identifier, client);
    const fetchFn = (client as any)._client?.get ? (u: string, o?: any) => (client as any)._client.get(u, o) : (u: string, o?: any) => fetch(u, o);
    const resp = await fetchFn(url, { headers });
    const resp_data = (await this._check_response_player(resp)).data;

    return new LXNSPlayer({
      name: resp_data.name,
      rating: resp_data.rating,
      friend_code: resp_data.friend_code,
      course_rank: resp_data.course_rank,
      class_rank: resp_data.class_rank,
      star: resp_data.star,
      frame: resp_data.frame ? await maimai_frames.by_id(resp_data.frame.id) : undefined,
      icon: resp_data.icon ? await maimai_icons.by_id(resp_data.icon.id) : undefined,
      trophy: resp_data.trophy ? await maimai_trophies.by_id(resp_data.trophy.id) : undefined,
      name_plate: resp_data.name_plate ? await maimai_nameplates.by_id(resp_data.name_plate.id) : undefined,
      upload_time: resp_data.upload_time,
    });
  }

  async get_scores_all(identifier: PlayerIdentifier, client: MaimaiClient): Promise<Score[]> {
    const [url, headers, use_user_api] = await this._build_player_request("scores", identifier, client);
    const fetchFn = (client as any)._client?.get ? (u: string, o?: any) => (client as any)._client.get(u, o) : (u: string, o?: any) => fetch(u, o);
    const resp = await fetchFn(url, { headers });
    const resp_data = (await this._check_response_player(resp)).data;
    const scores = resp_data.map((s: any) => LXNSProvider._deser_score(s)).filter((s: any) => s);

    if (!use_user_api) {
      const bests = await this.get_scores_best(identifier, client);
      scores.push(...bests);
    }
    return scores;
  }

  async get_scores_best(identifier: PlayerIdentifier, client: MaimaiClient): Promise<Score[]> {
    const [url, headers] = await this._build_player_request("bests", identifier, client);
    const fetchFn = (client as any)._client?.get ? (u: string, o?: any) => (client as any)._client.get(u, o) : (u: string, o?: any) => fetch(u, o);
    const resp = await fetchFn(url, { headers });
    const resp_data = (await this._check_response_player(resp)).data;
    return [...resp_data.standard, ...resp_data.dx].map((s: any) => LXNSProvider._deser_score(s));
  }

  async get_scores_one(identifier: PlayerIdentifier, song: Song, client: MaimaiClient): Promise<Score[]> {
    const allScores = await this.get_scores_all(identifier, client);
    return allScores.filter(s => s.id % 10000 === song.id);
  }

  async update_scores(identifier: PlayerIdentifier, scores: Iterable<Score>, client: MaimaiClient): Promise<void> {
    const [url, headers] = await this._build_player_request("scores", identifier, client);
    const scores_arr = [];
    for (const score of scores) {
      const json = await LXNSProvider._ser_score(score);
      if (json) scores_arr.push(json);
    }
    const fetchFnPost = (client as any)._client?.post ? (u: string, o?: any) => (client as any)._client.post(u, o) : (u: string, o?: any) => fetch(u, { method: 'POST', ...o });
    const resp = await fetchFnPost(url, { headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ scores: scores_arr }) });
    await this._check_response_player(resp);
  }

  async get_aliases(client: MaimaiClient): Promise<Record<number, string[]>> {
    const fetchFn = (client as any)._client?.get ? (u: string, o?: any) => (client as any)._client.get(u, o) : (u: string, o?: any) => fetch(u, o);
    const resp = await fetchFn(this.base_url + "api/v0/maimai/alias/list");
    const resp_json = await resp.json();
    const map: Record<number, string[]> = {};
    for (const item of resp_json.aliases) {
      map[item.song_id] = item.aliases;
    }
    return map;
  }

  static _deser_item(item: any, cls: any): any {
    return new cls({
      id: item.id,
      name: item.name,
      description: item.description,
      genre: item.genre,
    });
  }

  async get_icons(client: MaimaiClient): Promise<Record<number, PlayerIcon>> {
    const fetchFn = (client as any)._client?.get ? (u: string, o?: any) => (client as any)._client.get(u, o) : (u: string, o?: any) => fetch(u, o);
    const resp = await fetchFn(this.base_url + "api/v0/maimai/icon/list");
    const resp_json = await resp.json();
    const map: Record<number, PlayerIcon> = {};
    for (const item of resp_json.icons) map[item.id] = LXNSProvider._deser_item(item, PlayerIcon);
    return map;
  }

  async get_nameplates(client: MaimaiClient): Promise<Record<number, PlayerNamePlate>> {
    const fetchFn = (client as any)._client?.get ? (u: string, o?: any) => (client as any)._client.get(u, o) : (u: string, o?: any) => fetch(u, o);
    const resp = await fetchFn(this.base_url + "api/v0/maimai/plate/list");
    const resp_json = await resp.json();
    const map: Record<number, PlayerNamePlate> = {};
    for (const item of resp_json.plates) map[item.id] = LXNSProvider._deser_item(item, PlayerNamePlate);
    return map;
  }

  async get_frames(client: MaimaiClient): Promise<Record<number, PlayerFrame>> {
    const fetchFn = (client as any)._client?.get ? (u: string, o?: any) => (client as any)._client.get(u, o) : (u: string, o?: any) => fetch(u, o);
    const resp = await fetchFn(this.base_url + "api/v0/maimai/frame/list");
    const resp_json = await resp.json();
    const map: Record<number, PlayerFrame> = {};
    for (const item of resp_json.frames) map[item.id] = LXNSProvider._deser_item(item, PlayerFrame);
    return map;
  }

  async get_trophies(client: MaimaiClient): Promise<Record<number, any>> {
    return {};
  }
  
  async get_charas(client: MaimaiClient): Promise<Record<number, any>> {
    return {};
  }
  
  async get_partners(client: MaimaiClient): Promise<Record<number, any>> {
    return {};
  }
}
