export enum Version {
  MAIMAI = 10000,
  MAIMAI_PLUS = 11000,
  MAIMAI_GREEN = 12000,
  MAIMAI_GREEN_PLUS = 13000,
  MAIMAI_ORANGE = 14000,
  MAIMAI_ORANGE_PLUS = 15000,
  MAIMAI_PINK = 16000,
  MAIMAI_PINK_PLUS = 17000,
  MAIMAI_MURASAKI = 18000,
  MAIMAI_MURASAKI_PLUS = 18500,
  MAIMAI_MILK = 19000,
  MAIMAI_MILK_PLUS = 19500,
  MAIMAI_FINALE = 19900,
  MAIMAI_DX = 20000,
  MAIMAI_DX_PLUS = 20500,
  MAIMAI_DX_SPLASH = 21000,
  MAIMAI_DX_SPLASH_PLUS = 21500,
  MAIMAI_DX_UNIVERSE = 22000,
  MAIMAI_DX_UNIVERSE_PLUS = 22500,
  MAIMAI_DX_FESTIVAL = 23000,
  MAIMAI_DX_FESTIVAL_PLUS = 23500,
  MAIMAI_DX_BUDDIES = 24000,
  MAIMAI_DX_BUDDIES_PLUS = 24500,
  MAIMAI_DX_PRISM = 25000,
  MAIMAI_DX_PRISM_PLUS = 25500,
  MAIMAI_DX_CIRCLE = 26000,
  MAIMAI_DX_CIRCLE_PLUS = 26500,
  MAIMAI_DX_FUTURE = 30000,
}

export namespace Version {
  export const reversedValues = (): Version[] => {
    const values = Object.values(Version).filter(v => typeof v === 'number') as Version[];
    return values.sort((a, b) => b - a);
  };

  export const fromValue = (val: number): Version | undefined => {
    for (const v of reversedValues()) {
      if (val >= v) return v;
    }
    return undefined;
  };
}

export enum Genre {
  POPS_ANIME = "POPSアニメ",
  NICONICO_VOCALOID = "niconicoボーカロイド",
  TOUHOU = "東方Project",
  GAME_VARIETY = "ゲームバラエティ",
  MAIMAI = "maimai",
  ONGEKI_CHUNITHM = "オンゲキCHUNITHM",
  UTAGE = "宴会場",
}

export const all_versions = Object.values(Version).filter(v => typeof v === 'number') as Version[];
export const current_version = Version.MAIMAI_DX_PRISM;
export const current_version_jp = Version.MAIMAI_DX_CIRCLE_PLUS;

export const plate_to_version: Record<string, Version> = {
  "初": Version.MAIMAI,
  "真": Version.MAIMAI_PLUS,
  "超": Version.MAIMAI_GREEN,
  "檄": Version.MAIMAI_GREEN_PLUS,
  "橙": Version.MAIMAI_ORANGE,
  "晓": Version.MAIMAI_ORANGE_PLUS,
  "桃": Version.MAIMAI_PINK,
  "樱": Version.MAIMAI_PINK_PLUS,
  "紫": Version.MAIMAI_MURASAKI,
  "堇": Version.MAIMAI_MURASAKI_PLUS,
  "白": Version.MAIMAI_MILK,
  "雪": Version.MAIMAI_MILK_PLUS,
  "辉": Version.MAIMAI_FINALE,
  "熊": Version.MAIMAI_DX,
  "华": Version.MAIMAI_DX,
  "爽": Version.MAIMAI_DX_SPLASH,
  "煌": Version.MAIMAI_DX_SPLASH,
  "星": Version.MAIMAI_DX_UNIVERSE,
  "宙": Version.MAIMAI_DX_UNIVERSE,
  "祭": Version.MAIMAI_DX_FESTIVAL,
  "祝": Version.MAIMAI_DX_FESTIVAL,
  "双": Version.MAIMAI_DX_BUDDIES,
  "宴": Version.MAIMAI_DX_BUDDIES,
  "镜": Version.MAIMAI_DX_PRISM,
  "彩": Version.MAIMAI_DX_PRISM,
  "未": Version.MAIMAI_DX_FUTURE,
};

export const plate_to_version_jp: Record<string, Version> = {
  ...plate_to_version,
  "华": Version.MAIMAI_DX_PLUS,
  "煌": Version.MAIMAI_DX_SPLASH_PLUS,
  "宙": Version.MAIMAI_DX_UNIVERSE_PLUS,
  "祝": Version.MAIMAI_DX_FESTIVAL_PLUS,
  "宴": Version.MAIMAI_DX_BUDDIES_PLUS,
  "彩": Version.MAIMAI_DX_PRISM_PLUS,
  "丸": Version.MAIMAI_DX_CIRCLE,
};

export const divingfish_to_version: Record<string, Version> = {
  "maimai": Version.MAIMAI,
  "maimai PLUS": Version.MAIMAI_PLUS,
  "maimai GreeN": Version.MAIMAI_GREEN,
  "maimai GreeN PLUS": Version.MAIMAI_GREEN_PLUS,
  "maimai ORANGE": Version.MAIMAI_ORANGE,
  "maimai ORANGE PLUS": Version.MAIMAI_ORANGE_PLUS,
  "maimai PiNK": Version.MAIMAI_PINK,
  "maimai PiNK PLUS": Version.MAIMAI_PINK_PLUS,
  "maimai MURASAKi": Version.MAIMAI_MURASAKI,
  "maimai MURASAKi PLUS": Version.MAIMAI_MURASAKI_PLUS,
  "maimai MiLK": Version.MAIMAI_MILK,
  "MiLK PLUS": Version.MAIMAI_MILK_PLUS,
  "maimai FiNALE": Version.MAIMAI_FINALE,
  "maimai でらっくす": Version.MAIMAI_DX,
  "maimai でらっくす Splash": Version.MAIMAI_DX_SPLASH,
  "maimai でらっくす UNiVERSE": Version.MAIMAI_DX_UNIVERSE,
  "maimai でらっくす FESTiVAL": Version.MAIMAI_DX_FESTIVAL,
  "maimai でらっくす BUDDiES": Version.MAIMAI_DX_BUDDIES,
  "maimai でらっくす PRiSM": Version.MAIMAI_DX_PRISM,
  "maimai でらっくす CiRCLE": Version.MAIMAI_DX_CIRCLE,
};

export const name_to_genre: Record<string, Genre> = {
  "POPSアニメ": Genre.POPS_ANIME,
  "流行&动漫": Genre.POPS_ANIME,
  "niconicoボーカロイド": Genre.NICONICO_VOCALOID,
  "niconico & VOCALOID": Genre.NICONICO_VOCALOID,
  "東方Project": Genre.TOUHOU,
  "东方Project": Genre.TOUHOU,
  "ゲームバラエティ": Genre.GAME_VARIETY,
  "其他游戏": Genre.GAME_VARIETY,
  "maimai": Genre.MAIMAI,
  "舞萌": Genre.MAIMAI,
  "オンゲキCHUNITHM": Genre.ONGEKI_CHUNITHM,
  "音击&中二节奏": Genre.ONGEKI_CHUNITHM,
  "宴会場": Genre.UTAGE,
};

export const plate_aliases: Record<string, string> = {
  "暁": "晓",
  "櫻": "樱",
  "菫": "堇",
  "輝": "辉",
  "華": "华",
  "鏡": "镜",
  "極": "极",
  "將": "将",
};

export enum LevelIndex {
  BASIC = 0,
  ADVANCED = 1,
  EXPERT = 2,
  MASTER = 3,
  ReMASTER = 4,
}

export enum FCType {
  APP = 0,
  AP = 1,
  FCP = 2,
  FC = 3,
}

export enum FSType {
  SYNC = 0,
  FS = 1,
  FSP = 2,
  FSD = 3,
  FSDP = 4,
}

export enum RateType {
  SSSP = 0,
  SSS = 1,
  SSP = 2,
  SS = 3,
  SP = 4,
  S = 5,
  AAA = 6,
  AA = 7,
  A = 8,
  BBB = 9,
  BB = 10,
  B = 11,
  C = 12,
  D = 13,
}

export namespace RateType {
  export const fromAchievement = (achievement: number): RateType => {
      if (achievement >= 100.5) return RateType.SSSP;
      if (achievement >= 100) return RateType.SSS;
      if (achievement >= 99.5) return RateType.SSP;
      if (achievement >= 99) return RateType.SS;
      if (achievement >= 98) return RateType.SP;
      if (achievement >= 97) return RateType.S;
      if (achievement >= 94) return RateType.AAA;
      if (achievement >= 90) return RateType.AA;
      if (achievement >= 80) return RateType.A;
      if (achievement >= 75) return RateType.BBB;
      if (achievement >= 70) return RateType.BB;
      if (achievement >= 60) return RateType.B;
      if (achievement >= 50) return RateType.C;
      return RateType.D;
  };
}

export enum SongType {
  STANDARD = "standard",
  DX = "dx",
  UTAGE = "utage",
}

export namespace SongType {
  export const fromId = (id: number | string): SongType => {
      const numId = typeof id === 'number' ? id : parseInt(id, 10);
      if (numId > 100000) return SongType.UTAGE;
      if (numId > 10000) return SongType.DX;
      return SongType.STANDARD;
  };

  export const toAbbr = (type: SongType): string => {
      if (type === SongType.STANDARD) return "SD";
      if (type === SongType.DX) return "DX";
      return "UTAGE";
  };
}
