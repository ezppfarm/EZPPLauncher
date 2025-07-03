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
