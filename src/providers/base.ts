import { Score, PlayerIdentifier, Player, Song, Area, CurveObject, PlayerRegion, PlayerChara, PlayerFrame, PlayerIcon, PlayerNamePlate, PlayerPartner, PlayerTrophy } from '../models';
import { SongType, LevelIndex } from '../enums';
import type { MaimaiClient } from '../maimai';

export abstract class IProvider {
  abstract _hash(): string;
}

export abstract class ISongProvider extends IProvider {
  abstract get_songs(client: MaimaiClient): Promise<Song[]>;
}

export abstract class IAliasProvider extends IProvider {
  abstract get_aliases(client: MaimaiClient): Promise<Record<number, string[]>>;
}

export abstract class IPlayerProvider extends IProvider {
  abstract get_player(identifier: PlayerIdentifier, client: MaimaiClient): Promise<Player>;
}

export abstract class IScoreProvider extends IProvider {
  async get_scores_one(identifier: PlayerIdentifier, song: Song, client: MaimaiClient): Promise<Score[]> {
    const scores = await this.get_scores_all(identifier, client);
    return scores.filter(score => (score.id % 10000) === song.id);
  }

  async get_scores_best(identifier: PlayerIdentifier, client: MaimaiClient): Promise<Score[]> {
    return await this.get_scores_all(identifier, client);
  }

  abstract get_scores_all(identifier: PlayerIdentifier, client: MaimaiClient): Promise<Score[]>;
}

export abstract class IScoreUpdateProvider extends IProvider {
  abstract update_scores(identifier: PlayerIdentifier, scores: Iterable<Score>, client: MaimaiClient): Promise<void>;
}

export abstract class ICurveProvider extends IProvider {
  abstract get_curves(client: MaimaiClient): Promise<Record<string, CurveObject[]>>;
}

export abstract class IRegionProvider extends IProvider {
  abstract get_regions(identifier: PlayerIdentifier, client: MaimaiClient): Promise<PlayerRegion[]>;
}

export abstract class IItemListProvider extends IProvider {
  abstract get_icons(client: MaimaiClient): Promise<Record<number, PlayerIcon>>;
  abstract get_nameplates(client: MaimaiClient): Promise<Record<number, PlayerNamePlate>>;
  abstract get_frames(client: MaimaiClient): Promise<Record<number, PlayerFrame>>;
  abstract get_partners(client: MaimaiClient): Promise<Record<number, PlayerPartner>>;
  abstract get_charas(client: MaimaiClient): Promise<Record<number, PlayerChara>>;
  abstract get_trophies(client: MaimaiClient): Promise<Record<number, PlayerTrophy>>;
}

export abstract class IAreaProvider extends IProvider {
  abstract get_areas(lang: string, client: MaimaiClient): Promise<Record<string, Area>>;
}

export abstract class IPlayerIdentifierProvider extends IProvider {
  abstract get_identifier(code: string | Record<string, string>, client: MaimaiClient): Promise<PlayerIdentifier>;
}

export abstract class IRecordProvider extends IProvider {
  abstract get_records(identifier: PlayerIdentifier, client: MaimaiClient): Promise<Score[]>;
}
