import { SimpleMemoryCache } from './cache';
import { 
  Area, 
  DivingFishPlayer, 
  LXNSPlayer, 
  Player, 
  PlayerBests, 
  PlayerIdentifier, 
  PlayerItem, 
  PlayerRegion, 
  PlayerSong, 
  PlateObject, 
  Score, 
  ScoreExtend, 
  Song, 
  SongDifficulty, 
  SongDifficultyUtage,
  WechatPlayer
} from './models';
import { 
  DivingFishProvider, 
  IAliasProvider, 
  IAreaProvider, 
  ICurveProvider, 
  IItemListProvider, 
  IPlayerIdentifierProvider, 
  IPlayerProvider, 
  IRecordProvider, 
  IScoreProvider, 
  IScoreUpdateProvider, 
  ISongProvider, 
  LocalProvider, 
  LXNSProvider, 
  WechatProvider, 
  YuzuProvider,
  ArcadeProvider
} from './providers';
import { InvalidPlateError } from './exceptions';
import { 
  all_versions, 
  FCType, 
  FSType, 
  Genre, 
  LevelIndex, 
  plate_aliases, 
  plate_to_version, 
  RateType, 
  SongType, 
  Version 
} from './enums';
import { isUnset, UNSET, UnsetSentinel } from './utils';

// Used to generate md5 hashes for provider comparisons if needed.
// Though since we run in browser, maybe just a simple string concatenation or mini hash function is enough.
function _miniHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return h.toString(16);
}

export class MaimaiItems<PlayerItemType extends PlayerItem> {
  _client: MaimaiClient;
  _namespace: string;

  constructor(client: MaimaiClient, namespace: string) {
    this._client = client;
    this._namespace = namespace;
  }

  async _configure(provider: IItemListProvider | UnsetSentinel = UNSET): Promise<MaimaiItems<PlayerItemType>> {
    const cache_obj = this._client._cache;
    const cache_ttl = this._client._cache_ttl;

    if (isUnset(provider)) {
      if (await cache_obj.get("provider", null, this._namespace) !== null) {
        return this;
      }
    }
    
    let resolvedProvider: IItemListProvider;
    if (isUnset(provider)) {
      resolvedProvider = ["icons", "nameplates", "frames"].includes(this._namespace) ? new LXNSProvider() : new LocalProvider();
    } else {
      resolvedProvider = provider as IItemListProvider;
    }

    const current_provider_hash = resolvedProvider._hash();
    const previous_provider_hash = await cache_obj.get("provider", "", this._namespace);

    if (current_provider_hash !== previous_provider_hash) {
      const getMethodName = `get_${this._namespace}` as keyof IItemListProvider;
      const val = await (resolvedProvider[getMethodName] as any)(this._client) as Record<number, any>;
      
      const setProviderP = cache_obj.set("provider", current_provider_hash, cache_ttl, this._namespace);
      const ids = Object.keys(val).map(k => parseInt(k, 10));
      const setIdsP = cache_obj.set("ids", ids, undefined, this._namespace);
      const setItemsP = cache_obj.multi_set(Object.entries(val).map(([k, v]) => [parseInt(k, 10), v]), this._namespace);
      
      await Promise.all([setProviderP, setIdsP, setItemsP]);
    }
    return this;
  }

  async get_all(): Promise<PlayerItemType[]> {
    const item_ids = await this._client._cache.get("ids", undefined, this._namespace);
    if (!item_ids) throw new Error(`Items not found in cache ${this._namespace}, please call configure() first.`);
    return await this._client._multi_get(item_ids, this._namespace);
  }

  async get_batch(ids: Iterable<number>): Promise<PlayerItemType[]> {
    return await this._client._multi_get(ids, this._namespace);
  }

  async by_id(id: number): Promise<PlayerItemType | undefined> {
    return await this._client._cache.get(id, undefined, this._namespace);
  }

  async filter(kwargs: Record<string, any>): Promise<PlayerItemType[]> {
    const all = await this.get_all();
    return all.filter(item => {
      for (const [k, v] of Object.entries(kwargs)) {
        if (v !== undefined && (item as any)[k] !== v) return false;
      }
      return true;
    });
  }
}

export class MaimaiSongs {
  _client: MaimaiClient;

  constructor(client: MaimaiClient) {
    this._client = client;
  }

  async _configure(
    provider: ISongProvider | UnsetSentinel,
    alias_provider: IAliasProvider | null | UnsetSentinel,
    curve_provider: ICurveProvider | null | UnsetSentinel
  ): Promise<MaimaiSongs> {
    const cache_obj = this._client._cache;
    const cache_ttl = this._client._cache_ttl;

    if (isUnset(provider) && isUnset(alias_provider) && isUnset(curve_provider)) {
      if (await cache_obj.get("provider", null, "songs") !== null) {
        return this;
      }
    }

    const resolvedProvider = isUnset(provider) ? new LXNSProvider() : (provider as ISongProvider);
    const resolvedAlias = isUnset(alias_provider) ? new YuzuProvider() : (alias_provider as IAliasProvider | null);
    const resolvedCurve = isUnset(curve_provider) ? null : (curve_provider as ICurveProvider | null);

    const hashStr = resolvedProvider._hash() + (resolvedAlias ? resolvedAlias._hash() : "") + (resolvedCurve ? resolvedCurve._hash() : "");
    const current_provider_hash = _miniHash(hashStr);
    const previous_provider_hash = await cache_obj.get("provider", "", "songs");

    if (current_provider_hash !== previous_provider_hash) {
      const [songs, song_aliases, song_curves] = await Promise.all([
        resolvedProvider.get_songs(this._client),
        resolvedAlias ? resolvedAlias.get_aliases(this._client) : Promise.resolve({} as Record<number, string[]>),
        resolvedCurve ? resolvedCurve.get_curves(this._client) : Promise.resolve({} as Record<string, any>),
      ]);

      for (const song of songs) {
        if (resolvedAlias) {
          const aliases = song_aliases[song.id];
          if (aliases) song.aliases = aliases;
        }
        if (resolvedCurve) {
          const dC = song_curves[`${song.id}_DX`];
          const sC = song_curves[`${song.id}_STANDARD`];
          const uC = song_curves[`${song.id}_UTAGE`];
          if (dC) {
             const diffs = song.get_difficulties(SongType.DX);
             diffs.forEach((d, i) => { if (i < dC.length) d.curve = dC[i] });
          }
          if (sC) {
            const diffs = song.get_difficulties(SongType.STANDARD);
            diffs.forEach((d, i) => { if (i < sC.length) d.curve = sC[i] });
          }
          if (uC) {
            const diffs = song.get_difficulties(SongType.UTAGE);
            diffs.forEach((d, i) => { if (i < uC.length) d.curve = uC[i] });
          }
        }
      }

      const P1 = cache_obj.set("provider", current_provider_hash, cache_ttl, "songs");
      const P2 = cache_obj.set("ids", songs.map(s => s.id), undefined, "songs");
      const P3 = cache_obj.multi_set(songs.map(s => [s.id, s]), "songs");
      const P4 = cache_obj.multi_set(songs.map(s => [s.title, s.id]), "tracks");
      
      const aliasPairs: [string, number][] = [];
      for (const [idStr, alArr] of Object.entries(song_aliases)) {
        for (const a of alArr) aliasPairs.push([a, parseInt(idStr, 10)]);
      }
      const P5 = cache_obj.multi_set(aliasPairs, "aliases");

      const versionsMap: Record<string, number> = {};
      for (const song of songs) {
        for (const diff of song.get_difficulties()) {
          versionsMap[`${song.id} ${diff.type} ${diff.level_index}`] = diff.version;
        }
      }
      const P6 = cache_obj.set("versions", versionsMap, undefined, "songs");

      await Promise.all([P1, P2, P3, P4, P5, P6]);
    }
    return this;
  }

  async get_all(): Promise<Song[]> {
    const song_ids = await this._client._cache.get("ids", undefined, "songs");
    if (!song_ids) throw new Error("Songs not found in cache, please call configure() first.");
    return await this._client._multi_get(song_ids, "songs");
  }

  async get_batch(ids: Iterable<number>): Promise<Song[]> {
    const mapped = Array.from(ids).map(id => id % 10000);
    return await this._client._multi_get(mapped, "songs");
  }

  async by_id(id: number): Promise<Song | undefined> {
    return await this._client._cache.get(id % 10000, undefined, "songs");
  }

  async by_title(title: string): Promise<Song | undefined> {
    let song_id = await this._client._cache.get(title, undefined, "tracks");
    song_id = title === "Link(CoF)" ? 383 : song_id;
    return song_id ? await this._client._cache.get(song_id, undefined, "songs") : undefined;
  }

  async by_alias(alias: string): Promise<Song | undefined> {
    const song_id = await this._client._cache.get(alias, undefined, "aliases");
    if (song_id) {
      return await this._client._cache.get(song_id, undefined, "songs");
    }
  }

  async by_artist(artist: string): Promise<Song[]> {
    const all = await this.get_all();
    return all.filter(s => s.artist === artist);
  }

  async by_genre(genre: Genre): Promise<Song[]> {
    const all = await this.get_all();
    return all.filter(s => s.genre === genre);
  }

  async by_bpm(minimum: number, maximum: number): Promise<Song[]> {
    const all = await this.get_all();
    return all.filter(s => s.bpm >= minimum && s.bpm <= maximum);
  }

  async by_versions(versions: Version): Promise<Song[]> {
    const all = await this.get_all();
    const idx = all_versions.indexOf(versions);
    if (idx === -1) return [];
    const nextVal = idx + 1 < all_versions.length ? all_versions[idx + 1] : Number.MAX_SAFE_INTEGER;
    
    return all.filter(s => s.version >= versions && s.version < nextVal);
  }

  async by_keywords(keywords: string): Promise<Song[]> {
    const exact_matches: Song[] = [];
    const fuzzy_matches: Song[] = [];
    const lowerKey = keywords.toLowerCase();

    for (const song of await this.get_all()) {
      if (
        lowerKey === song.title.toLowerCase() ||
        lowerKey === song.artist.toLowerCase() ||
        (song.aliases || []).some(a => a.toLowerCase() === lowerKey)
      ) {
        exact_matches.push(song);
      } else if (
        `${song.title} + ${song.artist} + ${(song.aliases || []).join("")}`.toLowerCase().includes(lowerKey)
      ) {
        fuzzy_matches.push(song);
      }
    }
    return exact_matches.length > 0 ? exact_matches : fuzzy_matches;
  }

  async filter(kwargs: Record<string, any>): Promise<Song[]> {
    const all = await this.get_all();
    return all.filter(song => {
      for (const [k, v] of Object.entries(kwargs)) {
        if (v !== undefined && (song as any)[k] !== v) return false;
      }
      return true;
    });
  }
}

export class MaimaiPlates {
  _client: MaimaiClient;
  _kind: string = "";
  _version: string = "";
  _versions: Set<Version> = new Set();
  _matched_songs: Song[] = [];
  _matched_scores: ScoreExtend[] = [];

  constructor(client: MaimaiClient) {
    this._client = client;
  }

  async _configure(plate: string, scores: Score[]): Promise<MaimaiPlates> {
    const maimai_songs = await this._client.songs();
    this._version = plate_aliases[plate.slice(0, 1)] || plate.slice(0, 1);
    this._kind = plate_aliases[plate.slice(1)] || plate.slice(1);

    let versions: Version[] = [];
    if (this._version === "真") {
      versions = [plate_to_version["初"], plate_to_version["真"]];
    } else if (["霸", "舞"].includes(this._version)) {
      versions = Object.values(plate_to_version).filter(v => v < 20000);
    } else if (plate_to_version[this._version]) {
      versions = [plate_to_version[this._version]];
    }

    if (versions.length === 0 || !["将", "者", "极", "舞舞", "神"].includes(this._kind)) {
      throw new InvalidPlateError(`Invalid plate: ${this._version}${this._kind}`);
    }

    const nextVer = Object.values(plate_to_version).filter(v => v > versions[versions.length - 1])[0];
    if (nextVer) versions.push(nextVer);
    else versions.push(Number.MAX_SAFE_INTEGER as Version);

    this._versions = new Set(versions);

    const song_diff_versions = await this._client._cache.get("versions", {}, "songs");
    const versioned_matched_songs = new Set<number>();

    for (const [k, v] of Object.entries(song_diff_versions)) {
      const verV = v as number;
      if (versions.slice(0, -1).some((o, i) => verV >= o && verV < versions[i + 1])) {
        versioned_matched_songs.add(parseInt(k.split(" ")[0], 10));
      }
    }
    
    this._matched_songs = await this._client._multi_get(versioned_matched_songs, "songs");
    
    const versioned_joined_scores: Record<string, Score> = {};
    for (const score of scores) {
      const score_key = `${score.id} ${score.type} ${score.level_index}`;
      const score_version = song_diff_versions[score_key] as number | undefined;
      if (score_version !== undefined) {
        if (versions.slice(0, -1).some((o, i) => score_version >= o && score_version < versions[i + 1])) {
          if (!(score.level_index === LevelIndex.ReMASTER && this.no_remaster)) {
             versioned_joined_scores[score_key] = score._join(versioned_joined_scores[score_key]);
          }
        }
      }
    }

    this._matched_scores = await MaimaiScores._get_extended(Object.values(versioned_joined_scores), maimai_songs);
    return this;
  }

  get _major_type(): SongType {
    if (Array.from(this._versions).some(ver => ver > 20000)) return SongType.DX;
    return SongType.STANDARD;
  }

  get no_remaster(): boolean {
    return !["舞", "霸"].includes(this._version);
  }

  _get_levels(song: Song): Set<LevelIndex> {
    const levels = new Set<LevelIndex>(song.get_difficulties(this._major_type).map(d => d.level_index as LevelIndex));
    if (this.no_remaster && levels.has(LevelIndex.ReMASTER)) {
      levels.delete(LevelIndex.ReMASTER);
    }
    return levels;
  }

  async get_remained(): Promise<PlateObject[]> {
    const grouped: Record<number, ScoreExtend[]> = {};
    for (const s of this._matched_scores) {
      if (!grouped[s.id]) grouped[s.id] = [];
      grouped[s.id].push(s);
    }

    const results: Record<number, PlateObject> = {};
    for (const song of this._matched_songs) {
      results[song.id] = new PlateObject({
        song,
        levels: this._get_levels(song),
        scores: grouped[song.id] || []
      });
    }

    const extract = (score: ScoreExtend) => {
      const idx = results[score.id].scores.indexOf(score);
      if (idx > -1) results[score.id].scores.splice(idx, 1);
      results[score.id].levels.delete(score.level_index);
    };

    const process = (cond: (s: ScoreExtend) => boolean) => {
      for (const score of this._matched_scores) {
        if (cond(score)) extract(score);
      }
    };

    if (this._kind === "者") process(s => (s.rate || RateType.C) <= RateType.A);
    else if (this._kind === "将") process(s => (s.rate || RateType.C) <= RateType.SSS);
    else if (this._kind === "极") process(s => s.fc !== undefined && s.fc <= FCType.FC);
    else if (this._kind === "舞舞") process(s => s.fs !== undefined && s.fs <= FSType.FSD);
    else if (this._kind === "神") process(s => s.fc !== undefined && s.fc <= FCType.AP);

    return Object.values(results).filter(p => p.levels.size > 0);
  }

  async get_cleared(): Promise<PlateObject[]> {
    const results: Record<number, PlateObject> = {};
    for (const song of this._matched_songs) {
      results[song.id] = new PlateObject({ song, levels: new Set(), scores: [] });
    }

    const insert = (score: ScoreExtend) => {
      if(results[score.id]) {
        results[score.id].scores.push(score);
        results[score.id].levels.add(score.level_index);
      }
    };

    const process = (cond: (s: ScoreExtend) => boolean) => {
      for (const score of this._matched_scores) {
        if (cond(score)) insert(score);
      }
    };

    if (this._kind === "者") process(s => (s.rate || RateType.C) <= RateType.A);
    else if (this._kind === "将") process(s => (s.rate || RateType.C) <= RateType.SSS);
    else if (this._kind === "极") process(s => s.fc !== undefined && s.fc <= FCType.FC);
    else if (this._kind === "舞舞") process(s => s.fs !== undefined && s.fs <= FSType.FSD);
    else if (this._kind === "神") process(s => s.fc !== undefined && s.fc <= FCType.AP);

    return Object.values(results).filter(p => p.levels.size > 0);
  }

  async get_played(): Promise<PlateObject[]> {
    const results: Record<number, PlateObject> = {};
    for (const song of this._matched_songs) {
      results[song.id] = new PlateObject({ song, levels: new Set(), scores: [] });
    }
    for (const score of this._matched_scores) {
      if(results[score.id]) {
        results[score.id].scores.push(score);
        results[score.id].levels.add(score.level_index);
      }
    }
    return Object.values(results).filter(p => p.levels.size > 0);
  }

  async get_all(): Promise<PlateObject[]> {
    const results: Record<number, PlateObject> = {};
    for (const song of this._matched_songs) {
      results[song.id] = new PlateObject({ song, levels: new Set(), scores: [] });
    }
    for (const score of this._matched_scores) {
      if(results[score.id]) {
        results[score.id].scores.push(score);
        results[score.id].levels.add(score.level_index);
      }
    }
    return Object.values(results);
  }

  async count_played() { return (await this.get_played()).reduce((acc, p) => acc + p.levels.size, 0); }
  async count_cleared() { return (await this.get_cleared()).reduce((acc, p) => acc + p.levels.size, 0); }
  async count_remained() { return (await this.get_remained()).reduce((acc, p) => acc + p.levels.size, 0); }
  async count_all() { return (await this.get_all()).reduce((acc, p) => acc + this._get_levels(p.song).size, 0); }
}

export class MaimaiScores {
  _client: MaimaiClient;
  scores: ScoreExtend[] = [];
  scores_b35: ScoreExtend[] = [];
  scores_b15: ScoreExtend[] = [];
  rating: number = 0;
  rating_b35: number = 0;
  rating_b15: number = 0;

  constructor(client: MaimaiClient) {
    this._client = client;
  }

  async configure(scores: Score[], b50_only: boolean = false): Promise<MaimaiScores> {
    const maimai_songs = await this._client.songs();
    const song_diff_versions = await this._client._cache.get("versions", {}, "songs") as Record<string, number>;

    const scores_unique: Record<string, Score> = {};
    for (const score of scores) {
      const score_key = `${score.id} ${score.type} ${score.level_index}`;
      scores_unique[score_key] = score._compare(scores_unique[score_key]);
    }

    this.scores = await MaimaiScores._get_extended(Object.values(scores_unique), maimai_songs);
    
    for (const score of this.scores) {
      if (score.type === SongType.STANDARD || score.type === SongType.DX) {
        const diff_key = `${score.id} ${score.type} ${score.level_index}`;
        const score_version = song_diff_versions[diff_key];
        if (score_version !== undefined) {
          if (score_version >= plate_to_version["辉"]) {
            this.scores_b15.push(score);
          } else {
            this.scores_b35.push(score);
          }
        }
      }
    }

    const sortFn = (a: ScoreExtend, b: ScoreExtend) => {
      if ((b.dx_rating || 0) !== (a.dx_rating || 0)) return (b.dx_rating || 0) - (a.dx_rating || 0);
      if ((b.dx_score || 0) !== (a.dx_score || 0)) return (b.dx_score || 0) - (a.dx_score || 0);
      return (b.achievements || 0) - (a.achievements || 0);
    };

    this.scores_b35.sort(sortFn);
    this.scores_b15.sort(sortFn);

    this.scores_b35 = this.scores_b35.slice(0, 35);
    this.scores_b15 = this.scores_b15.slice(0, 15);
    
    if (b50_only) {
      this.scores = [...this.scores_b35, ...this.scores_b15];
    }

    this.rating_b35 = this.scores_b35.reduce((sum, s) => sum + (s.dx_rating || 0), 0);
    this.rating_b15 = this.scores_b15.reduce((sum, s) => sum + (s.dx_rating || 0), 0);
    this.rating = this.rating_b35 + this.rating_b15;

    return this;
  }

  static async *_get_mapping(scores: Iterable<Score>, maimai_songs: MaimaiSongs): AsyncGenerator<[Song, SongDifficulty, Score]> {
    const purified_ids = new Set<number>();
    for (const s of scores) purified_ids.add(s.id % 10000);
    
    const required_songs = await maimai_songs.get_batch(purified_ids);
    const required_songs_dict: Record<number, Song> = {};
    for (const song of required_songs) {
      if (song) required_songs_dict[song.id] = song;
    }

    for (const score of scores) {
      const song = required_songs_dict[score.id % 10000];
      const level_index = score.type !== SongType.UTAGE ? score.level_index : score.id;
      if (song) {
        const diff = song.get_difficulty(score.type, level_index);
        if (diff) yield [song, diff, score];
      }
    }
  }

  static _calcuate_dx_star(dx_score: number, max_dx_score: number): number {
    const THRESHOLD = [0.85, 0.90, 0.93, 0.95, 0.97];
    const percentage = dx_score / max_dx_score;
    for (let i = 0; i < THRESHOLD.length; i++) {
        if (percentage < THRESHOLD[i]) return i;
    }
    return 5;
  }

  static async _get_extended(scores: Iterable<Score>, maimai_songs: MaimaiSongs): Promise<ScoreExtend[]> {
    const extended_scores: ScoreExtend[] = [];
    for await (const [song, diff, score] of MaimaiScores._get_mapping(scores, maimai_songs)) {
      const level_dx_score = (diff.tap_num + diff.hold_num + diff.slide_num + diff.break_num + diff.touch_num) * 3;
      const dx_star = score.dx_score ? MaimaiScores._calcuate_dx_star(score.dx_score, level_dx_score) : undefined;
      
      extended_scores.push(new ScoreExtend({
        ...score,
        level: diff.level,
        title: song.title,
        dx_star,
        version: diff.version,
        level_value: diff.level_value,
        level_dx_score
      }));
    }
    return extended_scores;
  }

  async get_mapping(): Promise<[Song, SongDifficulty, ScoreExtend][]> {
    const maimai_songs = await this._client.songs();
    const result: [Song, SongDifficulty, ScoreExtend][] = [];
    const extendedIter = (await MaimaiScores._get_extended(this.scores, maimai_songs));
    
    // We already have extended scores which have song infos, but we don't have Song obj in them directly.
    // Let's just yield via mapping again.
    for await (const [song, diff, score] of MaimaiScores._get_mapping(extendedIter, maimai_songs)) {
      result.push([song, diff, score as ScoreExtend]);
    }
    return result;
  }

  get_player_bests(): PlayerBests {
    return new PlayerBests({
      rating: this.rating,
      rating_b35: this.rating_b35,
      rating_b15: this.rating_b15,
      scores_b35: this.scores_b35,
      scores_b15: this.scores_b15,
    });
  }

  by_song(song_id: number, song_type: SongType | UnsetSentinel = UNSET, level_index: LevelIndex | UnsetSentinel = UNSET): ScoreExtend[] {
    return this.scores.filter(s => 
      s.id === song_id && 
      (isUnset(song_type) || s.type === song_type) && 
      (isUnset(level_index) || s.level_index === level_index)
    );
  }

  filter(kwargs: Record<string, any>): Score[] {
    return this.scores.filter(s => {
      for (const [k, v] of Object.entries(kwargs)) {
        if (v !== undefined && (s as any)[k] !== v) return false;
      }
      return true;
    });
  }
}

export class MaimaiAreas {
  _client: MaimaiClient;
  _lang: string = "ja";

  constructor(client: MaimaiClient) {
    this._client = client;
  }

  async _configure(lang: string, provider: IAreaProvider | UnsetSentinel): Promise<MaimaiAreas> {
    this._lang = lang;
    const cache_obj = this._client._cache;
    const cache_ttl = this._client._cache_ttl;

    if (isUnset(provider)) {
      if (await cache_obj.get("provider", null, `areas_${lang}`) !== null) {
        return this;
      }
    }

    const resolvedProvider = isUnset(provider) ? new LocalProvider() : provider as IAreaProvider;
    const current_provider_hash = resolvedProvider._hash();
    const previous_provider_hash = await cache_obj.get("provider", "", `areas_${lang}`);

    if (current_provider_hash !== previous_provider_hash) {
      const areas = await resolvedProvider.get_areas(lang, this._client);
      await Promise.all([
        cache_obj.set("provider", current_provider_hash, cache_ttl, `areas_${lang}`),
        cache_obj.set("ids", Object.values(areas).map(a => a.id), undefined, `areas_${lang}`),
        cache_obj.multi_set(Object.entries(areas), `areas_${lang}`)
      ]);
    }
    return this;
  }

  async get_all(): Promise<Area[]> {
    const area_ids = await this._client._cache.get("ids", undefined, `areas_${this._lang}`);
    if (!area_ids) throw new Error("Areas not found in cache, please call configure() first.");
    return await this._client._multi_get(area_ids, `areas_${this._lang}`);
  }

  async get_batch(ids: Iterable<string>): Promise<Area[]> {
    return await this._client._multi_get(ids, `areas_${this._lang}`);
  }

  async by_id(id: string): Promise<Area | undefined> {
    return await this._client._cache.get(id, undefined, `areas_${this._lang}`);
  }

  async by_name(name: string): Promise<Area | undefined> {
    const all = await this.get_all();
    return all.find(a => a.name === name);
  }
}

export class MaimaiClient {
  private static _instance: MaimaiClient;
  _cache: SimpleMemoryCache;
  _cache_ttl: number;

  static get instance(): MaimaiClient {
    if (!MaimaiClient._instance) {
      MaimaiClient._instance = new MaimaiClient();
    }
    return MaimaiClient._instance;
  }

  constructor(cache?: SimpleMemoryCache, cache_ttl: number = 60 * 60 * 24) {
    this._cache = cache || new SimpleMemoryCache();
    this._cache_ttl = cache_ttl;
  }

  async _multi_get(keys: Iterable<any>, namespace?: string): Promise<any[]> {
    return await this._cache.multi_get(keys, namespace);
  }

  async songs(
    provider: ISongProvider | UnsetSentinel = UNSET,
    alias_provider: IAliasProvider | null | UnsetSentinel = UNSET,
    curve_provider: ICurveProvider | null | UnsetSentinel = UNSET
  ): Promise<MaimaiSongs> {
    const s = new MaimaiSongs(this);
    return await s._configure(provider, alias_provider, curve_provider);
  }

  async players(identifier: PlayerIdentifier, provider: IPlayerProvider = new LXNSProvider()): Promise<Player> {
    return await provider.get_player(identifier, this);
  }

  async scores(identifier: PlayerIdentifier, provider: IScoreProvider = new LXNSProvider()): Promise<MaimaiScores> {
    const scores = await provider.get_scores_all(identifier, this);
    const m = new MaimaiScores(this);
    return await m.configure(scores);
  }

  async bests(identifier: PlayerIdentifier, provider: IScoreProvider = new LXNSProvider()): Promise<MaimaiScores> {
    const scores = await provider.get_scores_best(identifier, this);
    const m = new MaimaiScores(this);
    return await m.configure(scores, true);
  }

  async minfo(song: Song | number | string, identifier?: PlayerIdentifier, provider: IScoreProvider = new LXNSProvider()): Promise<PlayerSong | undefined> {
    const maimai_songs = await this.songs();
    let s: Song | undefined;

    if (typeof song === 'string' && /^\d+$/.test(song)) {
      s = await maimai_songs.by_id(parseInt(song, 10));
    } else if (typeof song === 'string') {
      const res = await maimai_songs.by_keywords(song);
      if(res.length > 0) s = res[0];
    } else if (typeof song === 'number') {
      s = await maimai_songs.by_id(song);
    } else if (song instanceof Song) {
      s = song;
    }

    if (!s) return undefined;

    let extended_scores: ScoreExtend[] = [];
    if (identifier) {
      const sc = await provider.get_scores_one(identifier, s, this);
      extended_scores = await MaimaiScores._get_extended(sc, maimai_songs);
    }
    return new PlayerSong({ song: s, scores: extended_scores });
  }

  // Not strictly matching regions interface but implemented. Need RegionProvider ? Missing in original python import so just left mock. 
  // It returns any[] temporarily since IRegionProvider is barely tracked.
  async regions(identifier: PlayerIdentifier, provider: any): Promise<PlayerRegion[]> {
    return await provider.get_regions(identifier, this);
  }

  async updates(identifier: PlayerIdentifier, scores: Iterable<Score>, provider: IScoreUpdateProvider = new LXNSProvider()): Promise<void> {
    await provider.update_scores(identifier, scores, this);
  }

  async plates(identifier: PlayerIdentifier, plate: string, provider: IScoreProvider = new LXNSProvider()): Promise<MaimaiPlates> {
    const scores = await provider.get_scores_all(identifier, this);
    const m = new MaimaiPlates(this);
    return await m._configure(plate, scores);
  }

  async identifiers(code: string | Record<string, string>, provider: IPlayerIdentifierProvider | UnsetSentinel = UNSET): Promise<PlayerIdentifier> {
    const p = isUnset(provider) ? new ArcadeProvider() : (provider as IPlayerIdentifierProvider);
    return await p.get_identifier(code, this);
  }

  async items<T extends PlayerItem>(cls: new (...args: any[]) => T, provider: IItemListProvider | UnsetSentinel = UNSET): Promise<MaimaiItems<T>> {
    const m = new MaimaiItems<T>(this, (cls as any)._namespace());
    return await m._configure(provider);
  }

  async areas(lang: "ja" | "zh" = "ja", provider: IAreaProvider = new LocalProvider()): Promise<MaimaiAreas> {
    const m = new MaimaiAreas(this);
    return await m._configure(lang, provider);
  }

  async records(identifier: PlayerIdentifier, provider: IRecordProvider = new WechatProvider()): Promise<Score[]> {
    return await provider.get_records(identifier, this);
  }

  async wechat(r?: string, t?: string, code?: string, state?: string): Promise<string | PlayerIdentifier> {
    if (!r || !t || !code || !state) {
      const resp = await fetch("https://tgk-wcaime.wahlap.com/wc_auth/oauth/authorize/maimai-dx", { redirect: 'manual' });
      const location = resp.headers.get("location");
      if (location) return location.replace("redirect_uri=https", "redirect_uri=http");
      return "";
    }
    return await new WechatProvider().get_identifier({ r, t, code, state }, this);
  }

  async qrcode(qrcode: string, http_proxy?: string): Promise<PlayerIdentifier> {
    const provider = new ArcadeProvider(http_proxy);
    return await provider.get_identifier(qrcode, this);
  }
}
