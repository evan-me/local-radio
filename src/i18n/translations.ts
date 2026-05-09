// src/i18n/translations.ts
// 所有 UI 文案的双语翻译

export type Lang = 'zh' | 'en'

export interface Translations {
  // LoadingScreen
  all_label: string
  loading_init: string
  loading_connecting: string
  loading_db: string
  loading_map: string
  loading_ready: string
  data_label: string

  // TitleBar
  status_ok: string
  status_offline: string
  lang_toggle: string   // 点击后切换到另一种语言的标签

  // MapPanel
  online_count: (n: number | string) => string
  map_label: string
  filter_country: string
  filter_genre: string
  no_favorites: string
  search_placeholder: string
  favorites_title: string
  search_title: string
  close: string

  // PlayerHud
  scanning: string
  plays: string
  votes: string
  codec: string
  kbps: string
  trend: string
  play_label: string
  no_stream_url: string
  stream_error: string
  fallback_stream: string
  removed_fav: string
  saved_fav: string
  shuffle_toast: (n: number) => string
  copy_ok: string
  copy_fail: string
  no_url: string
  no_location: string
  locate_title: string
  shuffle_title: string
  fav_title: string
  app_version: (version: string) => string
  version_unavailable: string

  // App / filter
  no_stations_filter: string
  no_stations: string
  fav_not_found: string
  data_load_failed: string
  data_reload_failed: string
  data_filter_failed: string
}

export const zh: Translations = {
  loading_init: '正在启动',
  all_label: '全部',
  loading_connecting: '检查本地资源',
  loading_db: '读取电台数据',
  loading_map: '准备地图',
  loading_ready: '准备完成',
  data_label: '本地数据',

  status_ok: '在线',
  status_offline: '离线',
  lang_toggle: 'English',

  online_count: (n) => `电台: ${n}`,
  map_label: '地图',
  filter_country: '国家',
  filter_genre: '类型',
  no_favorites: '还没有收藏电台',
  search_placeholder: '搜索电台...',
  favorites_title: '收藏',
  search_title: '搜索',
  close: '关闭',

  scanning: '准备播放中...',
  plays: '播放',
  votes: '投票',
  codec: '编码',
  kbps: '码率',
  trend: '趋势',
  play_label: '播放',
  no_stream_url: '⚠ 无流地址',
  stream_error: '⚠ 流加载失败',
  fallback_stream: '⚠ 使用备用流',
  removed_fav: '已取消收藏',
  saved_fav: '已加入收藏',
  shuffle_toast: (n) => `已切换到电台 ${n}`,
  copy_ok: '⎘ 已复制',
  copy_fail: '⚠ 复制失败',
  no_url: '⚠ 无地址',
  no_location: '⚠ 该电台无位置信息',
  locate_title: '定位电台',
  shuffle_title: '随机',
  fav_title: '收藏',
  app_version: (version) => `当前版本 ${version}`,
  version_unavailable: '无法读取版本信息',

  no_stations_filter: '没有符合当前筛选条件的电台',
  no_stations: '当前没有本地电台数据',
  fav_not_found: '收藏电台不在当前数据中',
  data_load_failed: '本地数据加载失败',
  data_reload_failed: '本地数据刷新失败',
  data_filter_failed: '筛选本地数据失败',
}

export const en: Translations = {
  loading_init: 'Starting',
  all_label: 'ALL',
  loading_connecting: 'Checking local files',
  loading_db: 'Loading station data',
  loading_map: 'Preparing map',
  loading_ready: 'Ready',
  data_label: 'LOCAL DATA',

  status_ok: 'OK',
  status_offline: 'OFFLINE',
  lang_toggle: '中文',

  online_count: (n) => `Stations: ${n}`,
  map_label: 'MAP',
  filter_country: 'CNT',
  filter_genre: 'GENRE',
  no_favorites: 'No favorite stations yet',
  search_placeholder: 'SEARCH STATION...',
  favorites_title: 'Favorites',
  search_title: 'Search',
  close: 'Close',

  scanning: 'Preparing playback...',
  plays: 'PLAYS',
  votes: 'VOTES',
  codec: 'CODEC',
  kbps: 'KBPS',
  trend: 'TREND',
  play_label: 'PLAY',
  no_stream_url: '⚠ NO STREAM URL',
  stream_error: '⚠ STREAM ERROR',
  fallback_stream: '⚠ USING FALLBACK STREAM',
  removed_fav: 'Removed from favorites',
  saved_fav: 'Saved to favorites',
  shuffle_toast: (n) => `Switched to station ${n}`,
  copy_ok: '⎘ COPIED',
  copy_fail: '⚠ COPY FAILED',
  no_url: '⚠ NO URL',
  no_location: '⚠ STATION LOCATION NOT AVAILABLE',
  locate_title: 'Locate station',
  shuffle_title: 'Random [S]',
  fav_title: 'Favorite [F]',
  app_version: (version) => `Version ${version}`,
  version_unavailable: 'Version information unavailable',

  no_stations_filter: 'No stations match the current filters',
  no_stations: 'No local station data available',
  fav_not_found: 'Favorite station is not available in the current data',
  data_load_failed: 'Failed to load local data',
  data_reload_failed: 'Failed to refresh local data',
  data_filter_failed: 'Failed to filter local data',
}

export const translations: Record<Lang, Translations> = { zh, en }
