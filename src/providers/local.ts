import { IAreaProvider, IItemListProvider } from './base';
import type { MaimaiClient } from '../maimai';
import { PlayerIcon, PlayerNamePlate, PlayerFrame, PlayerPartner, PlayerChara, PlayerTrophy, Area, AreaCharacter, AreaSong } from '../models';

import iconsJson from './local/icons.json';
import nameplatesJson from './local/nameplates.json';
import framesJson from './local/frames.json';
import partnersJson from './local/partners.json';
import charasJson from './local/charas.json';
import trophiesJson from './local/trophies.json';
import areasJaJson from './local/areas_ja.json';
import areasZhJson from './local/areas_zh.json';

export class LocalProvider implements IItemListProvider, IAreaProvider {
  _hash(): string {
    // Return a dummy hash or implement a real hash over the JSON strings.
    // For isomorphic bundles, the files are bundled, so they only change on package update.
    return 'local_v1';
  }

  async get_icons(client: MaimaiClient): Promise<Record<number, PlayerIcon>> {
    const data = (iconsJson as any).data || iconsJson;
    const result: Record<number, PlayerIcon> = {};
    for (const [k, v] of Object.entries(data)) {
      result[parseInt(k)] = new PlayerIcon({ id: parseInt(k), name: v });
    }
    return result;
  }

  async get_nameplates(client: MaimaiClient): Promise<Record<number, PlayerNamePlate>> {
    const data = (nameplatesJson as any).data || nameplatesJson;
    const result: Record<number, PlayerNamePlate> = {};
    for (const [k, v] of Object.entries(data)) {
      result[parseInt(k)] = new PlayerNamePlate({ id: parseInt(k), name: v });
    }
    return result;
  }

  async get_frames(client: MaimaiClient): Promise<Record<number, PlayerFrame>> {
    const data = (framesJson as any).data || framesJson;
    const result: Record<number, PlayerFrame> = {};
    for (const [k, v] of Object.entries(data)) {
      result[parseInt(k)] = new PlayerFrame({ id: parseInt(k), name: v });
    }
    return result;
  }

  async get_partners(client: MaimaiClient): Promise<Record<number, PlayerPartner>> {
    const data = (partnersJson as any).data || partnersJson;
    const result: Record<number, PlayerPartner> = {};
    for (const [k, v] of Object.entries(data)) {
      result[parseInt(k)] = new PlayerPartner({ id: parseInt(k), name: v });
    }
    return result;
  }

  async get_charas(client: MaimaiClient): Promise<Record<number, PlayerChara>> {
    const data = (charasJson as any).data || charasJson;
    const result: Record<number, PlayerChara> = {};
    for (const [k, v] of Object.entries(data)) {
      result[parseInt(k)] = new PlayerChara({ id: parseInt(k), name: v });
    }
    return result;
  }

  async get_trophies(client: MaimaiClient): Promise<Record<number, PlayerTrophy>> {
    const data = (trophiesJson as any).data || trophiesJson;
    const result: Record<number, PlayerTrophy> = {};
    for (const [k, v] of Object.entries(data)) {
      const val = v as any;
      result[parseInt(k)] = new PlayerTrophy({ id: parseInt(k), name: val.title, color: val.rareType });
    }
    return result;
  }

  async get_areas(lang: string, client: MaimaiClient): Promise<Record<string, Area>> {
    const data = lang === 'ja' ? areasJaJson : areasZhJson;
    const maimai_songs = await client.songs();
    const result: Record<string, Area> = {};

    for (const item of (data as any[])) {
      const charas = item.characters.map((char: any) => ({
        name: char.name,
        illustrator: char.illustrator,
        description1: char.description1,
        description2: char.description2,
        team: char.team,
        props: char.props,
      }) as AreaCharacter);

      const songs = item.songs.map((song: any) => ({
        id: undefined,
        title: song.title,
        artist: song.artist,
        description: song.description,
        illustrator: song.illustrator,
        movie: song.movie,
      }) as AreaSong);

      result[item.id] = new Area({
        id: item.id,
        name: item.name,
        comment: item.comment,
        description: item.description,
        video_id: item.video_id,
        characters: charas,
        songs: songs,
      });
    }

    for (const area of Object.values(result)) {
      for (const song of area.songs) {
        const maimai_song = await maimai_songs.by_title(song.title);
        song.id = maimai_song ? maimai_song.id : undefined;
      }
    }

    return result;
  }
}
