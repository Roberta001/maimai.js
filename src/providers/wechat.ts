import { IPlayerIdentifierProvider, IPlayerProvider, IRecordProvider, IScoreProvider } from './base';
import { PlayerIdentifier, Score, Song, WechatPlayer, PlayerTrophy } from '../models';
import { SongType, LevelIndex, FCType, FSType, RateType } from '../enums';
import type { MaimaiClient } from '../maimai';
import { MaimaiJsError, InvalidPlayerIdentifierError, InvalidWechatTokenError } from '../exceptions';
import { HTMLScore, ScoreCoefficient, wmdx_html2score, wmdx_html2record, wmdx_html2player, wmdx_html2players } from '../utils/index';

export class WechatProvider implements IScoreProvider, IPlayerProvider, IPlayerIdentifierProvider, IRecordProvider {
  _hash(): string {
    return 'wechat';
  }

  static _ensure_cookies(identifier: PlayerIdentifier): string {
    if (typeof identifier.credentials === 'string' && identifier.credentials.includes('=')) {
      return identifier.credentials;
    }
    if (typeof identifier.credentials === 'object' && identifier.credentials !== null) {
      return Object.entries(identifier.credentials)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    }
    throw new InvalidPlayerIdentifierError("Wahlap wechat cookies (as string or Record) are required to fetch data");
  }

  static async _deser_score(score: HTMLScore, client: MaimaiClient): Promise<Score | undefined> {
    const maimai_songs = await client.songs();
    const song = await maimai_songs.by_title(score.title);
    if (song) {
      const is_utage = (song.difficulties.dx.length + song.difficulties.standard.length) === 0;
      let song_type = SongType.STANDARD;
      if (score.type === "SD") {
        song_type = SongType.STANDARD;
      } else if (score.type === "DX" && !is_utage) {
        song_type = SongType.DX;
      } else {
        song_type = SongType.UTAGE;
      }
      
      const level_index = score.level_index as LevelIndex;
      const diff = song.get_difficulty(song_type, level_index);
      if (diff) {
        const rating = new ScoreCoefficient(score.achievements).ra(diff.level_value);
        return new Score({
          id: song.id,
          level: diff.level,
          level_index: level_index,
          achievements: score.achievements,
          fc: score.fc ? (FCType as any)[score.fc.toUpperCase()] : undefined,
          fs: score.fs ? (FSType as any)[score.fs.toUpperCase().replace("FDX", "FSD")] : undefined,
          dx_score: score.dx_score,
          dx_rating: rating,
          play_count: undefined,
          play_time: score.play_time,
          rate: (RateType as any)[score.rate.toUpperCase()],
          type: song_type
        });
      }
    }
  }

  async _crawl_scores_diff(client: MaimaiClient, diff: number, cookieStr: string): Promise<Score[]> {
    await new Promise(r => setTimeout(r, Math.random() * 300));
    const url = `https://maimai.wahlap.com/maimai-mobile/record/musicGenre/search/?genre=99&diff=${diff}`;
    
    const fetchFn = (client as any)._client?.get ? (u: string, o?: any) => (client as any)._client.get(u, o) : (u: string, o?: any) => fetch(u, o);
    const resp = await fetchFn(url, { headers: { Cookie: cookieStr } });
    
    // fetch follows redirects normally. If it redirected, the URL might change.
    // In node-fetch or native fetch, redirected is true.
    if (resp.redirected && resp.url.includes("error")) { // Usually redirects to an error page or login
      throw new InvalidPlayerIdentifierError("Failed to fetch scores, possibly due to invalid cookies or maintenance.");
    }
    
    if (!resp.ok) throw new MaimaiJsError(`HTTP Error ${resp.status}`);
    const html = await resp.text();
    const scores = wmdx_html2score(html);
    
    const parsedObj: Score[] = [];
    for (const score of scores) {
      const res = await WechatProvider._deser_score(score, client);
      if (res) parsedObj.push(res);
    }
    return parsedObj;
  }

  async get_scores_all(identifier: PlayerIdentifier, client: MaimaiClient): Promise<Score[]> {
    const cookieStr = WechatProvider._ensure_cookies(identifier);
    const tasks = [0, 1, 2, 3, 4].map(diff => this._crawl_scores_diff(client, diff, cookieStr));
    const results = await Promise.all(tasks);
    return results.flat();
  }

  async get_scores_one(identifier: PlayerIdentifier, song: Song, client: MaimaiClient): Promise<Score[]> {
    const allScores = await this.get_scores_all(identifier, client);
    return allScores.filter(s => (s.id % 10000) === song.id);
  }

  async get_scores_best(identifier: PlayerIdentifier, client: MaimaiClient): Promise<Score[]> {
    return this.get_scores_all(identifier, client);
  }

  async get_player(identifier: PlayerIdentifier, client: MaimaiClient): Promise<WechatPlayer> {
    const trophies = await client.items(PlayerTrophy);
    const cookieStr = WechatProvider._ensure_cookies(identifier);
    const url = "https://maimai.wahlap.com/maimai-mobile/friend/userFriendCode/";
    
    const fetchFn = (client as any)._client?.get ? (u: string, o?: any) => (client as any)._client.get(u, o) : (u: string, o?: any) => fetch(u, o);
    const resp = await fetchFn(url, { headers: { Cookie: cookieStr } });
    if (resp.redirected && resp.url.includes("error")) {
      throw new InvalidPlayerIdentifierError("Failed to fetch player information, possibly due to invalid cookies or maintenance.");
    }

    const html = await resp.text();
    const player = wmdx_html2player(html);
    
    let userTrophy: PlayerTrophy | undefined;
    if (player.trophy_text) {
        // filter equivalent
        const allTrophies = await trophies.get_all();
        userTrophy = allTrophies.find(t => t.name === player.trophy_text);
    }

    return new WechatPlayer({
      name: player.name,
      rating: player.rating,
      friend_code: player.friend_code,
      star: player.star,
      trophy: userTrophy,
      token: undefined,
    });
  }

  async get_identifier(code: string | Record<string, string>, client: MaimaiClient): Promise<PlayerIdentifier> {
    if (typeof code === 'object' && code.r && code.t && code.code && code.state) {
      const wechat_ua = "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x6307001e)";
      const params = new URLSearchParams(code).toString();
      const url = `https://tgk-wcaime.wahlap.com/wc_auth/oauth/callback/maimai-dx?${params}`;
      
      const fetchFn = (client as any)._client?.get ? (u: string, o?: any) => (client as any)._client.get(u, o) : (u: string, o?: any) => fetch(u, o);
      // Not easily possible to capture redirected cookies manually with `fetch` if the server natively redirects without exposing set-cookie in redirect responses unless we use manual redirect mode
      // This is a known limitation of using native `fetch` over `httpx`.
      // We'll mimic the logic using 'redirect: manual' for Node environments if node-fetch supports it or rely on a wrapper.
      // But in pure JS fetch:
      const resp = await fetchFn(url, { 
        headers: { "User-Agent": wechat_ua },
        redirect: 'manual' 
      });

      if (resp.status >= 300 && resp.status < 400) {
        const setCookie = resp.headers.get("set-cookie") || "";
        const location = resp.headers.get("location");
        if (location) {
          const resp_next = await fetchFn(location, {
            headers: { "User-Agent": wechat_ua, "Cookie": setCookie }
          });
          const setCookieNext = resp_next.headers.get("set-cookie") || "";
          return new PlayerIdentifier({ credentials: setCookie + "; " + setCookieNext });
        }
      }
      throw new InvalidWechatTokenError("Invalid or expired Wechat token");
    }
    throw new InvalidWechatTokenError("Invalid Wechat token format, expected an object with 'r', 't', 'code', and 'state' keys");
  }

  async get_records(identifier: PlayerIdentifier, client: MaimaiClient): Promise<Score[]> {
    const cookieStr = WechatProvider._ensure_cookies(identifier);
    const url = "https://maimai.wahlap.com/maimai-mobile/record/";
    
    const fetchFn = (client as any)._client?.get ? (u: string, o?: any) => (client as any)._client.get(u, o) : (u: string, o?: any) => fetch(u, o);
    const resp = await fetchFn(url, { headers: { Cookie: cookieStr } });
    if (resp.redirected && resp.url.includes("error")) {
      throw new InvalidPlayerIdentifierError("Failed to fetch records, possibly due to invalid cookies or maintenance.");
    }
    
    const html = await resp.text();
    const scores = wmdx_html2record(html);
    
    const parsedObj: Score[] = [];
    for (const score of scores) {
      const res = await WechatProvider._deser_score(score, client);
      if (res) parsedObj.push(res);
    }
    return parsedObj;
  }
}
