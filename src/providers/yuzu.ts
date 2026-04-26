import { IAliasProvider } from './base';
import type { MaimaiClient } from '../maimai';
import { InvalidJsonError, MaimaiJsError } from '../exceptions';

export class YuzuProvider extends IAliasProvider {
  base_url = "https://www.yuzuchan.moe/api/";

  _hash(): string {
    return "yuzu";
  }

  async _check_response(resp: Response): Promise<any> {
    if (!resp.ok) {
      throw new MaimaiJsError(`HTTP Error ${resp.status}: ${resp.statusText}`);
    }
    try {
      return await resp.json();
    } catch (exc) {
      throw new InvalidJsonError(await resp.text());
    }
  }

  async get_aliases(client: MaimaiClient): Promise<Record<number, string[]>> {
    // using global fetch, we don't need client._client assuming we rely on native fetch,
    // though maimai_py passes requests through the client. We'll use fetch directly or through client if implemented.
    // Assuming client.fetch is available or just use native fetch.
    const fetchFn = (client as any)._client?.get ? (url: string) => (client as any)._client.get(url) : (url: string) => fetch(url);
    const resp = await fetchFn(this.base_url + "maimaidx/maimaidxalias");
    const resp_json = await this._check_response(resp);
    const grouped: Record<number, string[]> = {};
    for (const item of resp_json["content"]) {
      const songId = item["SongID"] % 10000;
      if (!grouped[songId]) grouped[songId] = [];
      grouped[songId].push(...item["Alias"]);
    }
    return grouped;
  }
}
