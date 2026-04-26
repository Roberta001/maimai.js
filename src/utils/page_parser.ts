import * as cheerio from 'cheerio';

const link_dx_score = [372, 522, 942, 924, 1425];

export interface HTMLScore {
  title: string;
  level: string;
  level_index: number;
  type: string;
  achievements: number;
  dx_score: number;
  play_time?: Date;
  rate: string;
  fc: string;
  fs: string;
  ds: number;
}

export interface HTMLPlayer {
  name: string;
  friend_code: number;
  rating: number;
  star: number;
  token?: string;
  trophy_text?: string;
  trophy_rarity?: string;
}

function get_level_index(src: string): number {
  if (src.includes("remaster")) return 4;
  if (src.includes("master")) return 3;
  if (src.includes("expert")) return 2;
  if (src.includes("advanced")) return 1;
  if (src.includes("basic")) return 0;
  return -1;
}

function get_music_icon(src: string): string {
  const matched = src.match(/((?:[dcbas]{1,3}|fc|ap|sync|fs|fdx)p?)(?:lus)?\.png/);
  return matched ? matched[1] : "";
}

function get_dx_score(element: cheerio.Cheerio<any> | null): [number, number] {
  if (!element || element.length === 0) return [0, 0];
  const elem_text = element.text() || "";
  const parts = elem_text.trim().split("/");
  if (parts.length !== 2) return [0, 0];
  
  try {
    const score = parseInt(parts[0].replace(/ /g, "").replace(/,/g, ""), 10);
    const full_score = parseInt(parts[1].replace(/ /g, "").replace(/,/g, ""), 10);
    return isNaN(score) || isNaN(full_score) ? [0, 0] : [score, full_score];
  } catch (e) {
    return [0, 0];
  }
}

function get_score_from_elems(
  title_elem: cheerio.Cheerio<any>, 
  level_elem: cheerio.Cheerio<any> | null, 
  score_elems: cheerio.Cheerio<any>, 
  icon_elems: cheerio.Cheerio<any>, 
  level_index: number, 
  type_: string
): HTMLScore {
  let title = title_elem.length > 0 ? title_elem.text() : "";
  if (title !== "\u3000") title = title.trim();
  
  const level = level_elem && level_elem.length > 0 ? level_elem.text().trim() : "";
  
  let achievements = 0.0;
  if (score_elems.length > 0) {
    const achvText = score_elems.eq(0).text().trim();
    if (achvText.endsWith("%")) {
      achievements = parseFloat(achvText.slice(0, -1));
    } else {
      achievements = parseFloat(achvText) || 0.0;
    }
  }
  
  const [dx_score, full_dx_score] = get_dx_score(score_elems.length > 1 ? score_elems.eq(1) : null);
  
  let fs = "", fc = "", rate = "";
  if (icon_elems.length >= 3) {
    fs = get_music_icon(icon_elems.eq(0).attr("src") || "");
    fc = get_music_icon(icon_elems.eq(1).attr("src") || "");
    rate = get_music_icon(icon_elems.eq(2).attr("src") || "");
  }

  if (title === "Link" && full_dx_score !== link_dx_score[level_index]) {
    title = "Link(CoF)";
  }

  return {
    title,
    level,
    level_index,
    type: type_,
    achievements,
    dx_score,
    rate,
    fc,
    fs,
    ds: 0
  };
}

function get_data_from_div(div: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): HTMLScore | null {
  const form = div.find("form");
  if (form.length === 0) return null;

  const img = form.find("img").first();
  if (img.length === 0) return null;

  const img_src = img.attr("src") || "";

  let type_ = "DX";
  const diffMatch = img_src.match(/diff_(.*)\.png/);
  if (!diffMatch) {
    const musicMatch = img_src.match(/music_(.*)\.png/);
    type_ = (musicMatch && musicMatch[1] === "standard") ? "SD" : "DX";
  } else {
    // Equivalent of form.getparent().getparent().get("id")
    const parentId = form.parent().parent().attr("id");
    if (parentId) {
      type_ = parentId.startsWith("sta") ? "SD" : "DX";
    } else {
      const nextSibling = form.parent().next();
      if (nextSibling.length > 0) {
        const src = nextSibling.attr("src") || "";
        const m = src.match(/_(.*)\.png/);
        type_ = (m && m[1] === "standard") ? "SD" : "DX";
      }
    }
  }

  try {
    const title_elem = form.find(".music_name_block");
    const level_elem = form.find(".music_lv_block");
    const score_elem = form.find(".music_score_block");
    const icon_elems = form.find("img[src*='music_icon']");
    const level_index = get_level_index(img_src);

    return get_score_from_elems(title_elem, level_elem, score_elem, icon_elems, level_index, type_);
  } catch (e) {
    return null;
  }
}

export function wmdx_html2score(html: string): HTMLScore[] {
  const $ = cheerio.load(html);
  const divs = $("div.w_450.m_15.p_r.f_0");
  const results: HTMLScore[] = [];

  divs.each((_, elem) => {
    const score = get_data_from_div($(elem), $);
    if (score) results.push(score);
  });

  return results;
}

export function wmdx_html2record(html: string): HTMLScore[] {
  const $ = cheerio.load(html);
  const divs = $("div.t_l.v_b.p_10.f_0");
  const results: HTMLScore[] = [];

  divs.each((_, elem) => {
    const div = $(elem);
    const children = div.children("div");
    if (children.length < 2) return;
    const top = children.eq(0);
    const main = children.eq(1);
    
    const topClass = top.attr("class") || "";
    if (topClass.indexOf("playlog_top_container") === -1) return;

    const mainClass = main.attr("class") || "";
    const mainClassMatch = mainClass.match(/playlog_(\w+)_container/);
    if (!mainClassMatch) return;
    const level_index = get_level_index(mainClassMatch[1]);

    const playTimeSpan = top.find(".sub_title span").eq(1);
    const play_time_str = playTimeSpan.text().trim();
    // Expected format: YYYY/MM/DD HH:mm
    const play_time = new Date(play_time_str);

    const type_src = main.find("img.playlog_music_kind_icon").attr("src") || "";
    const typeMatch = type_src.match(/_(.*)\.png/);
    const type_ = typeMatch && typeMatch[1] === "standard" ? "SD" : "DX";

    const title_elem = main.find("div.basic_block.break");
    const score_elem1 = main.find(".playlog_achievement_txt");
    const score_elem2 = main.find(".playlog_score_block");
    const score_elems = cheerio.load((score_elem1 as any).prop('outerHTML') + (score_elem2 as any).prop('outerHTML'))("*").children();
    
    // Instead of doing combine, we create a fake cheerio container.
    const fakeScoreElems = $("<div/>").append(score_elem1.clone()).append(score_elem2.clone()).children();

    const iconsReverse = main.find("img.h_35.m_5.f_l").toArray().reverse() as any as any[];
    const achievement_elem = main.find("img.playlog_scorerank").toArray() as any as any[];
    const allIcons = [...iconsReverse, ...achievement_elem];
    
    // Convert array of elements back to a cheerio object.
    const icon_elems = $(allIcons as any);

    const score = get_score_from_elems(title_elem, null, fakeScoreElems, icon_elems, level_index, type_);
    score.play_time = play_time;
    if (score) results.push(score);
  });

  return results;
}

export function wmdx_html2player(html: string): HTMLPlayer {
  const $ = cheerio.load(html);

  const name_elements = $("div.name_block.f_l.f_16");
  const friend_code_elements = $("div.see_through_block.m_t_5.m_b_5.p_5.t_c.f_15");
  const rating_elements = $("div.rating_block");
  const trophy_elements = $("div.trophy_inner_block.f_13");
  const star_elements = $("div.p_l_10.f_l.f_14");

  return extract_player_info(name_elements, friend_code_elements, rating_elements, trophy_elements, star_elements, null, false, $);
}

export function wmdx_html2players(html: string): [number, HTMLPlayer[]] {
  const $ = cheerio.load(html);

  let friend_count = 0;
  const friend_count_elems = $("div.basic_block:contains('好友数')");
  if (friend_count_elems.length > 0) {
    const friend_count_text = friend_count_elems.text();
    const match = friend_count_text.match(/好友数\s*\n?\s*(\d+)\/\d+/);
    if (match) {
      friend_count = parseInt(match[1], 10);
    }
  }

  const friend_divs = $("div.see_through_block.p_r.m_15.m_t_5.p_10.t_l.f_0");
  const players: HTMLPlayer[] = [];

  friend_divs.each((_, divElem) => {
    const div = $(divElem);
    const name_elements = div.find("div.name_block.f_l.f_16");
    const friend_code_elements = div.find("input[name='idx']");
    const rating_elements = div.find("div.rating_block");
    const trophy_elements = div.find("div.trophy_inner_block.f_13");
    const star_elements = div.find("div.p_l_10.f_l.f_14");
    const token_elements = div.find("input[name='token']");

    const player = extract_player_info(
      name_elements, friend_code_elements, rating_elements, trophy_elements, star_elements, token_elements, true, $
    );
    players.push(player);
  });

  return [friend_count, players];
}

function extract_player_info(
  name_elements: cheerio.Cheerio<any>,
  friend_code_elements: cheerio.Cheerio<any>,
  rating_elements: cheerio.Cheerio<any>,
  trophy_elements: cheerio.Cheerio<any>,
  star_elements: cheerio.Cheerio<any>,
  token_elements: cheerio.Cheerio<any> | null,
  friend_code_is_input: boolean,
  $: cheerio.CheerioAPI
): HTMLPlayer {
  let player_name = "";
  let friend_code = 0;
  let rating = 0;
  let trophy_text: string | undefined;
  let trophy_rarity = "Normal";
  let star = 0;
  let token: string | undefined;

  if (name_elements.length > 0) {
    player_name = name_elements.first().text().trim();
  }

  if (friend_code_elements.length > 0) {
    if (friend_code_is_input) {
      const friend_code_text = friend_code_elements.first().attr("value") || "";
      if (friend_code_text) friend_code = parseInt(friend_code_text, 10);
    } else {
      const friend_code_text = friend_code_elements.first().text().trim();
      const friend_code_numeric = friend_code_text.replace(/\D/g, "");
      if (friend_code_numeric) friend_code = parseInt(friend_code_numeric, 10);
    }
  }

  if (rating_elements.length > 0) {
    const rating_text = rating_elements.first().text().trim();
    const rating_numeric = rating_text.replace(/\D/g, "");
    if (rating_numeric) rating = parseInt(rating_numeric, 10);
  }

  if (trophy_elements.length > 0) {
    const trophy_inner = trophy_elements.first();
    const span_elements = trophy_inner.find("span");
    if (span_elements.length > 0) {
      trophy_text = span_elements.first().text().trim();
    } else {
      trophy_text = trophy_inner.text().trim();
    }

    const trophy_block = trophy_inner.parent();
    if (trophy_block.length > 0) {
      const trophy_class = trophy_block.attr("class") || "";
      const rarity_keywords = ["Rainbow", "Gold", "Silver", "Bronze", "Normal"];
      for (const rarity of rarity_keywords) {
        if (trophy_class.includes(`trophy_${rarity}`)) {
          trophy_rarity = rarity;
          break;
        }
      }
    }
  }

  if (star_elements.length > 0) {
    const star_text = star_elements.first().text().trim();
    const star_match = star_text.match(/×?(\d+)/);
    if (star_match) {
      star = parseInt(star_match[1], 10);
    } else {
      const star_numeric = star_text.replace(/\D/g, "");
      if (star_numeric) star = parseInt(star_numeric, 10);
    }
  }

  if (token_elements && token_elements.length > 0) {
    token = token_elements.first().attr("value");
  }

  return {
    name: player_name,
    friend_code,
    rating,
    trophy_text,
    trophy_rarity,
    star,
    token
  };
}
