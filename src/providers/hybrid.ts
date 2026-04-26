import { IAreaProvider, IItemListProvider, ISongProvider } from './base';
import { LocalProvider } from './local';
import { LXNSProvider } from './lxns';
import type { MaimaiClient } from '../maimai';
import { Area, PlayerChara, PlayerFrame, PlayerIcon, PlayerNamePlate, PlayerPartner, PlayerTrophy, Song } from '../models';

export class HybridProvider implements ISongProvider, IItemListProvider, IAreaProvider {
  provider_local: LocalProvider;
  provider_lxns: LXNSProvider;

  constructor() {
    this.provider_local = new LocalProvider();
    this.provider_lxns = new LXNSProvider();
  }

  _hash(): string {
    return 'hybrid';
  }

  async get_songs(client: MaimaiClient): Promise<Song[]> {
    return await this.provider_lxns.get_songs(client);
  }

  async get_icons(client: MaimaiClient): Promise<Record<number, PlayerIcon>> {
    return await this.provider_lxns.get_icons(client);
  }

  async get_nameplates(client: MaimaiClient): Promise<Record<number, PlayerNamePlate>> {
    return await this.provider_lxns.get_nameplates(client);
  }

  async get_frames(client: MaimaiClient): Promise<Record<number, PlayerFrame>> {
    return await this.provider_lxns.get_frames(client);
  }

  async get_partners(client: MaimaiClient): Promise<Record<number, PlayerPartner>> {
    return await this.provider_local.get_partners(client);
  }

  async get_charas(client: MaimaiClient): Promise<Record<number, PlayerChara>> {
    return await this.provider_local.get_charas(client);
  }

  async get_trophies(client: MaimaiClient): Promise<Record<number, PlayerTrophy>> {
    return await this.provider_local.get_trophies(client);
  }

  async get_areas(lang: string, client: MaimaiClient): Promise<Record<string, Area>> {
    return await this.provider_local.get_areas(lang, client);
  }
}
