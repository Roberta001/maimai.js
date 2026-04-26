import { IPlayerIdentifierProvider, IScoreProvider } from './base';
import { PlayerIdentifier, Score, Song } from '../models';
import type { MaimaiClient } from '../maimai';
import { ArcadeError } from '../exceptions';

export class ArcadeProvider implements IScoreProvider, IPlayerIdentifierProvider {
  _http_proxy?: string;

  constructor(http_proxy?: string) {
    this._http_proxy = http_proxy;
  }

  _hash(): string {
    return "arcade";
  }

  async get_scores_all(identifier: PlayerIdentifier, client: MaimaiClient): Promise<Score[]> {
    throw new ArcadeError("Arcade provider is not implemented in the JS port due to its reliance on the closed-source maimai_ffi library.");
  }

  async get_scores_best(identifier: PlayerIdentifier, client: MaimaiClient): Promise<Score[]> {
    return this.get_scores_all(identifier, client);
  }

  async get_scores_one(identifier: PlayerIdentifier, song: Song, client: MaimaiClient): Promise<Score[]> {
    return this.get_scores_all(identifier, client);
  }

  async get_identifier(code: string | Record<string, string>, client: MaimaiClient): Promise<PlayerIdentifier> {
    throw new ArcadeError("Arcade provider is not implemented in the JS port due to its reliance on the closed-source maimai_ffi library.");
  }
}
