export type EZPPUserResponse = {
  code: number;
  message: string;
  user?: EZPPUser;
};

export type EZPPUser = {
  id: number;
  donor: boolean;
  name: string;
  email: string;
};

export type EZPPUserInfoResponse = {
  status: string;
  player: EZPPUserInfo;
};

export type EZPPUserInfo = {
  info: {
    id: number;
    name: string;
    safe_name: string;
    priv: number;
    country: string;
    silence_end: number;
    donor_end: number;
    creation_time: number;
    latest_activity: number;
    clan_id: number;
    clan_priv: number;
    preferred_mode: number;
    preferred_type: number;
    play_style: number;
    custom_badge_enabled: number;
    custom_badge_name: string;
    custom_badge_icon: string;
    custom_badge_color: string;
    userpage_content: string;
    recentFailed: number;
    social_discord: string;
    social_youtube: string;
    social_twitter: string;
    social_twitch: string;
    social_github: string;
    social_osu: string;
    clan: {
      id: number;
      name: string;
      tag: string;
      owner: number;
      created_at: Date;
    };
    username_history: string[];
  };
  stats: {
    [key: string]: {
      id: number;
      mode: number;
      tscore: number;
      rscore: number;
      pp: number;
      plays: number;
      playtime: number;
      acc: number;
      max_combo: number;
      total_hits: number;
      replay_views: number;
      xh_count: number;
      x_count: number;
      sh_count: number;
      s_count: number;
      a_count: number;
      level: number;
      level_progress: number;
      rank: number;
      country_rank: number;
      history: {
        pp: number[];
      };
    };
  };
  events: {
    userId: number;
    name: string;
    mapId: number;
    setId: number;
    artist: string;
    title: string;
    version: string;
    mode: number;
    rank: number;
    grade: string;
    event: 'GAINED' | 'LOST';
    time: Date;
  }[];
};

export type StreamsResult = {
  streams: {
    id: number;
    name: string;
    display_name: string;
    is_featured: boolean;
    latest_build: {
      created_at: Date;
      display_version: string;
      id: number;
      users: number;
      version: string;
      youtube_id: null | string;
      update_stream: {
        id: number;
        name: string;
        display_name: string;
        is_featured: boolean;
      };
    };
    user_count: number;
  }[];
};

export type UpdateFile = {
  folder: string;
  md5: string;
  name: string;
  size: number;
  url: string;
};

export type UpdateStatus = {
  fileName: string;
  downloaded: number;
  size: number;
  progress: number;
};

export type Release = {
  id: number;
  tag_name: string;
  target_commitish: string;
  name: string;
  body: string;
  url: string;
  html_url: string;
  tarball_url: string;
  zipball_url: string;
  upload_url: string;
  draft: boolean;
  prerelease: boolean;
  created_at: Date;
  published_at: Date;
  author: {
    id: number;
    login: string;
    login_name: string;
    source_id: number;
    full_name: string;
    email: string;
    avatar_url: string;
    html_url: string;
    language: string;
    is_admin: boolean;
    last_login: Date;
    created: Date;
    restricted: boolean;
    active: boolean;
    prohibit_login: boolean;
    location: string;
    website: string;
    description: string;
    visibility: string;
    followers_count: number;
    following_count: number;
    starred_repos_count: number;
    username: string;
  };
  assets: {
    id: number;
    name: string;
    size: number;
    download_count: number;
    created_at: Date;
    uuid: string;
    browser_download_url: string;
  }[];
};

export type EZPPUSerStatusResponse = EZPPUserOfflineStatus | EZPPUserOnlineStatus;

type EZPPUserOfflineStatus = {
  status: string;
  player_status: {
    online: false;
    last_seen: number;
  };
};

type EZPPUserOnlineStatus = {
  status: string;
  player_status: {
    online: true;
    login_time: number;
    status: {
      action: EZPPActionStatus;
      info_text: string;
      mode: number;
      mods: number;
      beatmap: EZPPUserBeatmapStatus | null;
    };
  };
};

type EZPPUserBeatmapStatus = {
  md5: string;
  id: number;
  set_id: number;
  artist: string;
  title: string;
  version: string;
  creator: string;
  last_update: string;
  total_length: number;
  max_combo: number;
  status: number;
  plays: number;
  passes: number;
  mode: number;
  bpm: number;
  cs: number;
  od: number;
  ar: number;
  hp: number;
  diff: number;
};

export enum EZPPActionStatus {
  AFK = 1,
  PLAYING = 2,
  EDITING = 3,
  MODDING = 4,
  MULTIPLAYER_SELECT = 5,
  WATCHING = 6,
  TESTING = 8,
  SUBMITTING = 9,
  MULTIPLAYER_IDLE = 11,
  MULTIPLAYER_PLAYING = 12,
  DIRECT = 13,
}
