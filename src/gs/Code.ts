import YouTube = GoogleAppsScript.YouTube;

interface IApiConfig {
  user: IUserConfig;
  tracks: ITrack[];
  providers?: Providers;
  progresses?: ITrackProgress[];
}

interface IUserConfig {
  email: string | string[];
  subject?: string;
  body?: string;
  template?: string;
}

interface ITrack {
  name: string;
  select: ITrackSelect;
  filter?: ITrackFilter;
  sort?: ITrackSort;
  limit?: ITrackLimit;
  schedule?: ITrackSchedule;
}
interface ITrackProgress {
  name: string;
  current: number;
  isStopped?: boolean;
}

interface ITrackSelect {
  youtube?: ISelectYoutube;
  googlePhotos?: ISelectGooglePhotos;
  vimeo?: ISelectVimeo;
}
interface ISelectYoutube {
  playlistId?: string | string[];
  videoId?: string | string[];
}
interface ISelectGooglePhotos {
  albumId?: string;
}
interface ISelectVimeo {
  videoId?: string | string[];
}
interface ITrackFilter {
  tagExpression?: string;
}
interface ITrackSort {
  by: SortBy;
}
interface ITrackLimit {
  offset?: number;
  count?: number;
  progress?: {
    loop?: boolean;
  };
}
interface ITrackSchedule {
  cron: string;
  timezone?: string;
}

type Providers = (IProviderConfig | IYoutubeProviderConfig)[];
interface IProviderConfig {
  type: ProviderType;
  sheet: ISheetConfig;
}
enum ProviderType {
  Youtube = 'youtube',
  GooglePhotos = 'googlePhotos',
  Vimeo = 'vimeo',
  Custom = 'custom',
}
interface ISheetConfig {
  id: string;
  name: string;
}
interface IYoutubeProviderConfig extends IProviderConfig {
  type: ProviderType.Youtube;
  uploadsPlaylistId: string;
}

interface ISection {
  name: string;
  videos: IVideo[];
}
interface IVideo extends IVideoBase {
  pointer?: string;
  custom?: {
    tags?: string[];
    title?: string;
    url?: string;
    pointer?: string;
  };
}
interface IVideoBase {
  id: string;
  tags: string[];
  title: string;
  url: string;
}

enum SortBy {
  None = 'none',
  Title = 'title',
  Date = 'date',
  Random = 'random',
}

const googleTriggerCron = '* 16 * * *';

//TODO create "id details map" videoId: {custom: IVideoBase, cell: string}, apply for vimeo
type IdCellMap = {[videoId: string]: string};

const idCellMaps: {[sheetName: string]: IdCellMap} = {};

const testApiConfig: IApiConfig = {
  user: {
    email: 'szabo.bence.tat@gmail.com',
    subject: 'Daily Dance Digest',
    template: 'default',
  },
  tracks: [
    {
      name: 'Practice Bachata',
      select: {
        youtube: {
          playlistId: 'UUN2l886RuTZAHGkhpngCWuw',
        },
        googlePhotos: {
          albumId: undefined,
        },
        vimeo: {
          videoId: undefined,
        },
      },
      filter: {
        tagExpression: 'bachata/beginner',
      },
      sort: {
        by: SortBy.Random,
      },
      limit: {
        count: 3,
        progress: {
          loop: true,
        },
      },
      schedule: {
        cron: '* 16 * * *',
        timezone: 'Europe/Budapest',
      },
    },
    {
      name: 'Practice Kizomba',
      select: {
        youtube: {
          playlistId: 'UUN2l886RuTZAHGkhpngCWuw',
          videoId: [
            'CvE0nvyn57w',
            'C6rmpz84aGA',
            'CvzRvpctyaI',
            'QOUadS1FYNc',
            'wlSF0ztk47k',
            'c3QiY_bxU2s',
            'JZw-yYc1bJw',
            'Kl28yQGm1DM',
            'WmtgwdAhEgw',
            'T50f1JcKyvQ',
            'KdwJt3a4Khg',
            'xULxFEtKis8',
            'htdxKWuL4QM',
            'K9fmAh2rTqE',
            'KSd2w72t3xA',
            '7-NSbgdhJ6Q',
            'wzPKWV9LU_Q',
            'zGk9PVQXXo0',
            'GVHiK8ANgkk',
            'updgP09qDHQ',
            'jMFybB_fKks',
            '3yPn9yhTYJU',
            'd9kPiLKb35k',
            '1N4-Nw2k3Hc',
            'NSkWrxFdRCo',
            'ekzGjMZSj5A',
            'UkPukO3M8eQ',
            'yIrQEtMXqNA',
            'p-JlxxcvFng',
          ],
        },
        googlePhotos: {
          albumId: undefined,
        },
        vimeo: {
          videoId: undefined,
        },
      },
      filter: {
        tagExpression: 'kizomba',
      },
      sort: {
        by: SortBy.Random,
      },
      limit: {
        count: 3,
      },
      schedule: {
        cron: '* 16 * * *',
        timezone: 'Europe/Budapest',
      },
    },
  ],
  providers: [
    {
      type: ProviderType.Youtube,
      sheet: {
        id: '1190338372',
        name: 'youtubeUploads',
      },
      uploadsPlaylistId: 'UUN2l886RuTZAHGkhpngCWuw',
    },
    {
      type: ProviderType.GooglePhotos,
      sheet: {
        id: '1878936212',
        name: 'googlePhotos',
      },
    },
    {
      type: ProviderType.Vimeo,
      sheet: {
        id: '771704511',
        name: 'vimeo',
      },
    },
    {
      type: ProviderType.Custom,
      sheet: {
        id: '87232840',
        name: 'custom',
      },
    },
  ],
  progresses: [],
};

const test = () => {
  Logger.log(`youtube uploads playlist id: ${_getYoutubeUploadsPlaylistId()}`);
  sendDanceDigest(testApiConfig);
};

//TODO https://developers.google.com/apps-script/guides/triggers/events
const run = (event: GoogleAppsScript.Events.TimeDriven) => {
  sendDanceDigest();
};

function sendDanceDigest(apiConfig?: IApiConfig | IApiConfig[]) {
  const apiConfigs = apiConfig
    ? Array.isArray(apiConfig)
      ? apiConfig
      : [apiConfig]
    : _getApiConfigs();

  for (const apiConfig of apiConfigs) {
    _sendDanceDigest(apiConfig);
  }
}

function _sendDanceDigest(apiConfig: IApiConfig) {
  Logger.log(
    `sending tracks: "${apiConfig.tracks
      .map(track => track.name)
      .join('", "')}" to user: ${apiConfig.user.email}`
  );
  const {user, tracks, providers, progresses} = apiConfig;
  if (providers) {
    _init(providers);
  }
  const {sections, progresses: progressesUpdate} = _getSectionsAndProgress(
    tracks,
    providers,
    progresses
  );
  if (sections.length > 0) {
    Logger.log(`sending ${sections.length} sections to ${user.email}`);
    _sendSections(sections, user);
  } else {
    Logger.log(`no sections found for ${user.email}`);
  }
  _updateProgress(progressesUpdate);
}

function downloadYoutubeUploadsDetails() {
  const {provider, videos} = _getProviderAndVideos(ProviderType.Youtube);
  _setVideos(provider, videos);
}

function downloadGooglePhotosDetails() {
  const {provider, videos} = _getProviderAndVideos(ProviderType.GooglePhotos);
  _setVideos(provider, videos);
}

function uploadYoutubeUploadsDetails() {
  const {provider, videos} = _getProviderAndVideos(ProviderType.Youtube);
  const results = SpreadsheetApp.getActiveSpreadsheet()
    .getRange(_getA1Notation(provider.sheet.name))
    .getValues()
    .filter(row => row[0]);

  for (const result of results) {
    const videoId = result[0];
    const tags = result[1].split(',').map((tag: string) => tag.trim());
    const url = result[2];
    const title = result[3];
    const video = videos.find(video => video.id === videoId);
    if (
      JSON.stringify(tags) !== JSON.stringify(video.tags) ||
      JSON.stringify(title) !== JSON.stringify(video.title)
    ) {
      Logger.log(
        `updating ${videoId} title: "${title}", tags: ${JSON.stringify(
          tags
        )} from title: "${video.title}", tags: ${JSON.stringify(video.tags)})`
      );
      const vid = YouTube.Videos.list('snippet', {id: videoId}).items[0];
      vid.snippet.tags = tags;
      vid.snippet.title = title;
      YouTube.Videos.update(vid, 'snippet');
    }
  }
}

function uploadGooglePhotosDetails() {
  const {provider, videos} = _getProviderAndVideos(ProviderType.GooglePhotos);
  const results = SpreadsheetApp.getActiveSpreadsheet()
    .getRange(_getA1Notation(provider.sheet.name))
    .getValues()
    .filter(row => row[0]);

  for (const result of results) {
    const videoId = result[0];
    const tags: string[] = result[1]
      ? result[1].split(',').map((tag: string) => tag.trim())
      : [];
    const url = result[2];
    const title = result[3];
    const video = videos.find(video => video.id === videoId);
    if (
      JSON.stringify(tags) !== JSON.stringify(video.tags) ||
      JSON.stringify(title) !== JSON.stringify(video.title)
    ) {
      Logger.log(
        `updating ${videoId} title: "${title}", tags: ${JSON.stringify(
          tags
        )} from title: "${video.title}", tags: ${JSON.stringify(video.tags)})`
      );

      const mediaItemsUpdateUrl = `https://photoslibrary.googleapis.com/v1/mediaItems/${videoId}?updateMask=description`;
      const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
        method: 'patch',
        headers: {
          Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
        },
        contentType: 'application/json',
        payload: JSON.stringify({
          description: tags.join(','),
        }),
      };
      const response = UrlFetchApp.fetch(mediaItemsUpdateUrl, params);
    }
  }
}

function _getProviderAndVideos(type: ProviderType) {
  const apiConfigs = _getApiConfigs();
  if (apiConfigs.length > 1) {
    console.warn('more than one api config found, using the first one');
  }
  const apiConfig = apiConfigs[0];

  const provider = apiConfig.providers.find(
    provider => provider.type === type
  ) as IYoutubeProviderConfig | undefined;
  if (!provider) {
    throw new Error(`provider config ${type} not found`);
  }
  const fallbackProvider = apiConfig.providers.find(
    provider => provider.type === ProviderType.Custom
  ) as IProviderConfig | undefined;

  let videos: IVideo[] = [];
  switch (type) {
    case ProviderType.Youtube:
      videos = _getYoutubePlaylistItemsVideos(
        provider.uploadsPlaylistId,
        provider,
        fallbackProvider
      );
      break;
    case ProviderType.GooglePhotos:
      videos = _getGooglePhotosVideos(provider, fallbackProvider);
      break;
    default:
      throw new Error(`provider type is not supported: ${type}`);
  }
  return {provider, videos};
}

function _setVideos(provider: IProviderConfig, videos: IVideo[]) {
  SpreadsheetApp.getActiveSpreadsheet()
    .getRange(_getA1Notation(provider.sheet.name, videos.length))
    .setValues(
      videos.map(video => [
        video.id,
        video.tags.join(','),
        video.url,
        video.title,
      ])
    );
}

function onOpen() {
  addMenu();
}

function addMenu() {
  const menu = SpreadsheetApp.getUi().createMenu('Script');
  menu.addItem('Download Youtube details', 'downloadYoutubeDetails');
  menu.addItem('Upload Youtube details', 'uploadYoutubeDetails');
  menu.addItem('Download Google Photos details', 'downloadGooglePhotosDetails');
  menu.addItem(
    'Upload Google Photos details (#FIXME)',
    'uploadGooglePhotosDetails'
  );
  menu.addToUi();
}

function _getApiConfigs(): IApiConfig[] {
  const configValues = SpreadsheetApp.getActiveSpreadsheet()
    .getRange('config!A2:D')
    .getValues()
    .filter(row => row[0]);
  const apiConfigs: IApiConfig[] = [];
  for (const configValue of configValues) {
    if (!configValue[0]) {
      throw new Error(`invalid api config, ${JSON.stringify(configValue)}`);
    }
    apiConfigs.push({
      user: JSON.parse(configValue[0]),
      tracks: JSON.parse(configValue[1] || '[]'),
      providers: JSON.parse(configValue[2] || '[]'),
      progresses: JSON.parse(configValue[3] || '[]'),
    });
  }
  if (apiConfigs.length < 1) {
    throw new Error('no api config was found');
  } else {
    return apiConfigs;
  }
}

function _updateProgress(progresses: ITrackProgress[]): void {
  SpreadsheetApp.getActiveSpreadsheet()
    //TODO literal
    .getRange('config!D2')
    .setValue(JSON.stringify(progresses));
}

function _init(providerConfigs: IProviderConfig[]) {
  for (const providerConfig of providerConfigs) {
    switch (providerConfig.type) {
      case ProviderType.Youtube:
      case ProviderType.GooglePhotos:
      case ProviderType.Vimeo:
      case ProviderType.Custom:
        idCellMaps[providerConfig.sheet.name] = _createIdCellMap(
          providerConfig.sheet.name
        );
        break;
      default:
        throw new Error(
          `provider type is not supported: ${providerConfig.type}`
        );
    }
  }
}

function _getSectionsAndProgress(
  tracks: ITrack[],
  providers?: Providers,
  progresses: ITrackProgress[] = []
): {
  sections: ISection[];
  progresses: ITrackProgress[];
} {
  const sections: ISection[] = [];
  for (const track of tracks) {
    const cron = track.schedule?.cron;
    if (cron && !_checkCron(cron)) {
      continue;
    }

    let progress: ITrackProgress | undefined = progresses.find(
      progress => progress.name === track.name
    );
    if (!progress && track.limit?.progress) {
      progress = {
        name: track.name,
        current: 0,
        isStopped: false,
      };
      progresses.push(progress);
    }
    const videos = _getVideos(track, providers, progress?.current);
    const {name, limit} = track;

    //TODO refactor progress handling
    if (progress) {
      if (progress.isStopped) {
        continue;
      } else if (videos.length < 1) {
        if (limit.progress.loop) {
          progress.current = limit.offset ? limit.offset : 0;
        } else {
          progress.isStopped = true;
        }
      } else {
        progress.current =
          progress.current + (limit.offset ? limit.offset : 0) + videos.length;
      }
    }

    sections.push({
      name,
      videos,
    });
  }
  return {sections, progresses};
}

function _getVideos(
  track: ITrack,
  providers: Providers = [],
  current?: number
): IVideo[] {
  const {select, filter, sort, limit} = track;
  let videos: IVideo[] = _selectVideos(select, providers);

  const customProvider = providers.find(
    provider => provider.type === ProviderType.Custom
  ) as IProviderConfig | undefined;
  if (customProvider) {
    videos = _addCustomData(videos, customProvider);
  }

  if (filter) {
    videos = _filterVideos(videos, filter);
  }
  if (sort) {
    videos = _sortVideos(videos, sort);
  }
  videos = _limitVideos(videos, limit, current);
  return videos;
}

function _selectVideos(
  select: ITrackSelect,
  providers: Providers = []
): IVideo[] {
  const selectedVideos: IVideo[] = [];
  const {youtube, googlePhotos, vimeo} = select;
  const fallbackProvider = providers.find(
    provider => provider.type === ProviderType.Custom
  );
  if (youtube) {
    const provider = providers.find(
      provider => provider.type === ProviderType.Youtube
    ) as IYoutubeProviderConfig | undefined;
    const {playlistId, videoId} = youtube;
    if (playlistId) {
      const playlistIds = Array.isArray(playlistId) ? playlistId : [playlistId];
      for (const playlistId of playlistIds) {
        selectedVideos.push(
          ..._getYoutubePlaylistItemsVideos(
            playlistId,
            provider,
            fallbackProvider
          )
        );
      }
    }
    if (videoId) {
      selectedVideos.push(
        ..._getYoutubeVideos(videoId, provider, fallbackProvider)
      );
    }
  }
  if (googlePhotos) {
    const {albumId} = googlePhotos;
    const provider = providers.find(
      provider => provider.type === ProviderType.GooglePhotos
    ) as IProviderConfig | undefined;
    selectedVideos.push(
      ..._getGooglePhotosVideos(provider, fallbackProvider, albumId)
    );
  }
  if (vimeo) {
    const provider = providers.find(
      provider => provider.type === ProviderType.Vimeo
    ) as IProviderConfig | undefined;
    selectedVideos.push(..._getVimeoVideos(vimeo, provider, fallbackProvider));
  }
  return selectedVideos;
}

function _filterVideos(videos: IVideo[], filter: ITrackFilter): IVideo[] {
  const {tagExpression} = filter;
  if (tagExpression) {
    videos = _filterVideosByTagExpression(videos, tagExpression);
  }
  return videos;
}

function _sortVideos(videos: IVideo[], sort: ITrackSort): IVideo[] {
  switch (sort.by) {
    case SortBy.None:
      return videos;
    //TODO implement sorting methods
    // case SortBy.Title:
    //     return videos.sort((a, b) => a.title.localeCompare(b.title));
    // case SortBy.Date:
    //     return videos.sort((a, b) => a.date.localeCompare(b.date));
    case SortBy.Random:
      return _shuffle(videos);
    default:
      throw new Error(`sort is not supported by ${sort.by}`);
  }
}

function _limitVideos(
  videos: IVideo[],
  limit?: ITrackLimit,
  current = 0
): IVideo[] {
  const offset = (limit.offset ? limit.offset : 0) + current;
  const count = limit.count ? limit.count : 1;
  return videos.slice(offset, offset + count);
}

function _addCustomData(videos: IVideo[], provider: IProviderConfig): IVideo[] {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const customValues = spreadsheet
    .getRange(_getA1Notation(provider.sheet.name))
    .getValues()
    .filter(row => row[0]);
  const customVideos: IVideoBase[] = [];
  for (const customValue of customValues) {
    customVideos.push({
      id: customValue[0],
      tags: customValue[1].split(',').map((tag: string) => tag.trim()),
      url: customValue[2],
      title: customValue[3],
    });
  }
  return videos.map(video => {
    const customVideo = customVideos.find(custom => custom.id === video.id);
    if (customVideo) {
      delete customVideo.id;
      video.custom = {...customVideo};
    }
    return video;
  });
}

function _getYoutubePlaylistItemsVideos(
  playlistId: string,
  provider?: IYoutubeProviderConfig,
  fallbackProvider?: IProviderConfig
): IVideo[] {
  const {part, optionalArgs} =
    _getYoutubePlaylistItemsListParams(playlistId).list;
  const videoIds: string[] = [];
  let nextPageToken = null;
  do {
    const playlistResponse: YouTube.Schema.PlaylistItemListResponse =
      YouTube.PlaylistItems.list(part, {
        ...optionalArgs,
        pageToken: nextPageToken,
      });
    if (!playlistResponse || playlistResponse.items.length === 0) {
      Logger.log('no playlist found');
      break;
    } else {
      for (const item of playlistResponse.items || []) {
        videoIds.push(item.snippet.resourceId.videoId);
      }
    }
    nextPageToken = playlistResponse.nextPageToken;
  } while (nextPageToken);
  return _getYoutubeVideos(videoIds, provider, fallbackProvider);
}

function _getYoutubeVideos(
  videoId: string | string[],
  provider?: IYoutubeProviderConfig,
  fallbackProvider?: IProviderConfig
): IVideo[] {
  const {part, optionalArgs} = _getYoutubeVideosListParams(
    Array.isArray(videoId) ? videoId.join(',') : videoId
  ).list;
  const videos: IVideo[] = [];
  const responses: YouTube.Schema.VideoListResponse[] = [];
  const chunkSize = 50;
  const videoIds = optionalArgs.id.split(',');
  for (let i = 0; i < videoIds.length; i += chunkSize) {
    const vIds = videoIds.slice(i, i + chunkSize);
    responses.push(
      YouTube.Videos.list(part, {
        id: vIds.join(','),
      })
    );
  }
  for (const response of responses) {
    videos.push(
      ...response.items.map(item => {
        return {
          id: item.id,
          tags: item.snippet.tags,
          title: item.snippet.title,
          url: _getYoutubeVideoUrl(item.id),
          pointer: provider
            ? _getPointer(item.id, provider.sheet, fallbackProvider.sheet)
            : undefined,
        };
      })
    );
  }
  return videos;
}

function _getGooglePhotosVideos(
  provider?: IProviderConfig,
  fallbackProvider?: IProviderConfig,
  albumId?: string
): IVideo[] {
  let mediaItems: IMediaItem[] = [];
  let pageToken = '';
  const {search} = _getGooglePhotosParams(albumId).mediaItems;

  if (search) {
    const mediaItemsSearchUrl =
      'https://photoslibrary.googleapis.com/v1/mediaItems:search';
    do {
      search.pageToken = pageToken;
      const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
        method: 'post',
        headers: {
          Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
        },
        contentType: 'application/json',
        payload: JSON.stringify(search),
      };
      const response = UrlFetchApp.fetch(mediaItemsSearchUrl, params);
      const result = JSON.parse(response.getContentText());
      mediaItems = mediaItems.concat(result.mediaItems);
      pageToken = result.nextPageToken;
    } while (pageToken);
  }

  return mediaItems.map(item => {
    return {
      id: item.id,
      tags: item.description
        ? item.description.split(',').map(tag => tag.trim())
        : [],
      title: item.filename,
      url: item.productUrl,
      pointer: provider
        ? _getPointer(item.id, provider.sheet, fallbackProvider.sheet)
        : undefined,
    };
  });
}

function _getSharedAlbums() {
  let sharedAlbums: ISharedAlbum[] = [];
  let pageToken = '';
  const query = {
    pageSize: 50,
    pageToken,
  };

  const listSharedAlbumsUrl =
    'https://photoslibrary.googleapis.com/v1/sharedAlbums';
  do {
    query.pageToken = pageToken;
    const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: 'get',
      headers: {
        Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
      },
      contentType: 'application/json',
    };
    const response = UrlFetchApp.fetch(
      listSharedAlbumsUrl +
        '?' +
        Object.entries(query)
          .map(([key, value]) => `${key}=${value}`)
          .join('&'),
      params
    );
    const result: {sharedAlbums: ISharedAlbum[]; nextPageToken: string} =
      JSON.parse(response.getContentText());
    sharedAlbums = sharedAlbums.concat(result.sharedAlbums);
    pageToken = result.nextPageToken;
  } while (pageToken);

  sharedAlbums.forEach(album => {
    Logger.log(album);
  });

  return sharedAlbums;
}

function _getVimeoVideos(
  selectVimeo: ISelectVimeo,
  provider?: IProviderConfig,
  fallbackProvider?: IProviderConfig
): IVideo[] {
  //TODO connect to vimeo API
  const {videoId} = selectVimeo;
  return (Array.isArray(videoId) ? videoId : [videoId]).map(id => {
    return {
      id,
      //TODO add tags and title from custom sheet
      tags: [],
      title: '',
      url: _getVimeoVideoUrl(id),
      pointer: provider
        ? _getPointer(id, provider.sheet, fallbackProvider.sheet)
        : undefined,
    };
  });
}

function _filterVideosByTagExpression(videos: IVideo[], tagExpression: string) {
  const terms = tagExpression.split('+');
  return videos.filter(video =>
    terms.some(term => {
      const tags = term.split(/[*/]/g);
      const matches = term.match(/[*/]/g) ? term.match(/[*/]/g) : [];
      const operations =
        matches.length < tags.length ? ['*'].concat(matches) : matches;
      if (operations.length !== tags.length) {
        throw new Error('invalid tag expression');
      }
      return tags.every((tag, index) => {
        if (operations[index] === '*') {
          return video.custom && video.custom.tags
            ? video.custom.tags.includes(tag)
            : video.tags.includes(tag);
        } else if (operations[index] === '/') {
          return !(video.custom && video.custom.tags
            ? video.custom.tags.includes(tag)
            : video.tags.includes(tag));
        } else {
          return video.custom && video.custom.tags
            ? video.custom.tags.includes(tag)
            : video.tags.includes(tag);
        }
      });
    })
  );
}

function _sendSections(sections: ISection[], userConfig: IUserConfig): void {
  const template = HtmlService.createTemplateFromFile(
    userConfig.template || 'default'
  );
  template.sections = sections;
  const emails = Array.isArray(userConfig.email)
    ? userConfig.email
    : [userConfig.email];
  for (const email of emails) {
    GmailApp.sendEmail(email, userConfig.subject, userConfig.body, {
      htmlBody: template.evaluate().getContent(),
    });
  }
}

function _getYoutubeUploadsPlaylistId(): string {
  const selectYoutubeChannels: ISelectYoutubeChannels = {
    list: {
      part: 'contentDetails',
      optionalArgs: {
        mine: true,
      },
    },
  };
  const {part, optionalArgs} = selectYoutubeChannels.list;
  const result = YouTube.Channels.list(part, optionalArgs);
  if (!result || result.items.length === 0) {
    Logger.log(
      `no channels found with uploads playlist, ${JSON.stringify(
        selectYoutubeChannels
      )}`
    );
    throw new Error('no channels found with uploads playlist');
  } else if (result.items.length > 1) {
    Logger.log(
      `more than one channel found with uploads playlist, using the first one, ${JSON.stringify(
        selectYoutubeChannels
      )}`
    );
  }
  return result.items[0].contentDetails.relatedPlaylists.uploads;
}

function _shuffle([...arr]) {
  let m = arr.length;
  while (m) {
    const i = Math.floor(Math.random() * m--);
    [arr[m], arr[i]] = [arr[i], arr[m]];
  }
  return arr;
}

function _getPointer(
  videoId: string,
  sheetConfig: ISheetConfig,
  fallbackSheetConfig?: ISheetConfig
): string | undefined {
  const sheetIdCellMap = _getIdCellMap(sheetConfig.name);
  const fallbackSheetIdCellMap = fallbackSheetConfig
    ? _getIdCellMap(fallbackSheetConfig.name)
    : {};
  return sheetIdCellMap[videoId]
    ? _getSpreadSheetUrl(sheetConfig.id, sheetIdCellMap[videoId])
    : fallbackSheetIdCellMap[videoId]
    ? _getSpreadSheetUrl(
        fallbackSheetConfig.id,
        fallbackSheetIdCellMap[videoId]
      )
    : undefined;
}

function _getIdCellMap(sheetName: string) {
  if (!idCellMaps[sheetName]) {
    idCellMaps[sheetName] = _createIdCellMap(sheetName);
  }
  return idCellMaps[sheetName];
}

function _createIdCellMap(sheetName: string): IdCellMap {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);

  const values = sheet.getDataRange().getValues();
  const idCellMap: IdCellMap = {};
  for (let i = 0; i < values.length; i++) {
    const row = i + 1;
    const column = 1;
    const id = sheet.getRange(row, column).getValue();
    const cell = sheet.getRange(row, column);
    idCellMap[id] = cell.getA1Notation();
  }
  return idCellMap;
}

const _getYoutubeVideoUrl = (videoId: string) =>
  'https://www.youtube.com/watch?v=' + videoId;
const _getVimeoVideoUrl = (videoId: string) =>
  'https://player.vimeo.com/video/' + videoId;
const _getSpreadSheetUrl = (sheetId: string, range?: string) =>
  `https://docs.google.com/spreadsheets/d/${SpreadsheetApp.getActiveSpreadsheet().getId()}/edit#gid=${sheetId}${
    range ? `&range=${range}` : ''
  }`;
const _getA1Notation = (sheetName: string, count?: number) =>
  `${sheetName}!A2:D${count ? count + 1 : ''}`;

function _getYoutubePlaylistItemsListParams(
  playlistId: string
): IYoutubePlaylistItemsList {
  return {
    list: {
      part: 'snippet',
      optionalArgs: {
        playlistId,
        maxResults: 25,
      },
    },
  };
}

function _getYoutubeVideosListParams(videoId: string): IYoutubeVideosList {
  return {
    list: {
      part: 'snippet',
      optionalArgs: {
        id: videoId,
      },
    },
  };
}

function _getGooglePhotosParams(albumId?: string): {
  mediaItems: ISelectGooglePhotosMediaItems;
} {
  return {
    mediaItems: {
      search: {
        albumId,
        pageSize: 100,
        filters: albumId
          ? undefined
          : {
              mediaTypeFilter: {
                mediaTypes: ['VIDEO'],
              },
            },
      },
    },
  };
}

interface IParsedCron {
  minute?: number;
  hour?: number;
  dayOfMonth?: number;
  month?: number;
  dayOfWeek?: number;
}

function _checkCron(cronExpression: string): boolean {
  const now = new Date();
  const cron = _parseCron(cronExpression);
  return (
    (cron.minute === undefined || cron.minute === now.getMinutes()) &&
    (cron.hour === undefined || cron.hour === now.getHours()) &&
    (cron.dayOfMonth === undefined || cron.dayOfMonth === now.getDate()) &&
    (cron.month === undefined || cron.month === now.getMonth()) &&
    (cron.dayOfWeek === undefined || cron.dayOfWeek === now.getDay())
  );
}

function _parseCron(cronExpression = googleTriggerCron): IParsedCron {
  const fields = cronExpression.split(' ');
  const minute = parseInt(fields[0]);
  const hour = parseInt(fields[1]);
  const dayOfMonth = parseInt(fields[2]);
  const month = parseInt(fields[3]);
  const dayOfWeek = parseInt(fields[4]);
  return {
    minute: minute ? minute : undefined,
    hour: hour ? hour : undefined,
    dayOfMonth: dayOfMonth ? dayOfMonth : undefined,
    month: month ? month : undefined,
    dayOfWeek: dayOfWeek ? dayOfWeek : undefined,
  };
}

// https://developers.google.com/youtube/v3/docs/playlistItems/list
interface IYoutubePlaylistItemsList {
  list: {
    part: 'contentDetails' | 'id' | 'snippet' | 'status';
    optionalArgs: {
      id?: string;
      maxResults?: number;
      onBehalfOfContentOwner?: string;
      pageToken?: string;
      playlistId?: string;
      videoId?: string;
    };
  };
}

// https://developers.google.com/youtube/v3/docs/videos/list
interface IYoutubeVideosList {
  list: {
    part:
      | 'contentDetails'
      | 'fileDetails'
      | 'id'
      | 'liveStreamingDetails'
      | 'localizations'
      | 'player'
      | 'processingDetails'
      | 'recordingDetails'
      | 'snippet'
      | 'statistics'
      | 'status'
      | 'suggestions'
      | 'topicDetails';
    optionalArgs: {
      chart?: 'mostPopular';
      id?: string;
      myRating?: 'like' | 'dislike';

      hl?: string;
      maxHeight?: number;
      maxResults?: number;
      maxWidth?: number;
      onBehalfOfContentOwner?: string;
      pageToken?: string;
      regionCode?: string;
      videoCategoryId?: string;
    };
  };
}

// https://developers.google.com/youtube/v3/docs/channels/list
interface ISelectYoutubeChannels {
  list: {
    part:
      | 'auditDetails'
      | 'brandingSettings'
      | 'contentDetails'
      | 'contentOwnerDetails'
      | 'id'
      | 'localizations'
      | 'snippet'
      | 'statistics'
      | 'status'
      | 'topicDetails';
    optionalArgs: {
      categoryId?: string; //deprecated
      forUsername?: string;
      id?: string;
      managedByMe?: boolean;
      mine?: boolean;

      hl?: string;
      maxResults?: number;
      onBehalfOfContentOwner?: string;
      pageToken?: string;
    };
  };
  playlistIds?: string[];
  query?: string;
  videoIds?: string[];
}

// https://developers.google.com/photos/library/reference/rest/v1/mediaItems/search
interface ISelectGooglePhotosMediaItems {
  search: {
    albumId?: string;
    pageSize?: number;
    pageToken?: string;
    filters?: {
      dateFilter?: {
        dates?: IGooglePhotosDate[];
        ranges?: {
          startDate?: IGooglePhotosDate;
          endDate?: IGooglePhotosDate;
        }[];
      };
      contentFilter?: {
        includedContentCategories?: GooglePhotosContentCategory[];
        excludedContentCategories?: GooglePhotosContentCategory[];
      };
      mediaTypeFilter?: {
        mediaTypes: GooglePhotosMediaType[];
      };
      featureFilter?: {
        includedFeatures: GooglePhotosFeature[];
      };
      includeArchivedMedia?: boolean;
      excludeNonAppCreatedData?: boolean;
    };
    orderBy?: string;
  };
  //TODO implement list, get, batchGet apis (GET)
  list?: any;
  get?: any;
  batchGet?: any;
}

interface IGooglePhotosDate {
  year: number;
  month: number;
  day: number;
}

enum GooglePhotosContentCategory {
  None = 'NONE',
  Landscapes = 'LANDSCAPES',
  Receipts = 'RECEIPTS',
  Cityscapes = 'CITYSCAPES',
  Landmarks = 'LANDMARKS',
  Selfies = 'SELFIES',
  People = 'PEOPLE',
  Pets = 'PETS',
  Weddings = 'WEDDINGS',
  Birthdays = 'BIRTHDAYS',
  Documents = 'DOCUMENTS',
  Travel = 'TRAVEL',
  Animals = 'ANIMALS',
  Food = 'FOOD',
  Sports = 'SPORTS',
  Night = 'NIGHT',
  Performances = 'PERFORMANCES',
  Whiteboards = 'WHITEBOARDS',
  Screenshots = 'SCREENSHOTS',
  Utility = 'UTILITY',
  Arts = 'ARTS',
  Crafts = 'CRAFTS',
  Fashion = 'FASHION',
  Houses = 'HOUSES',
  Gardens = 'GARDENS',
  Flowers = 'FLOWERS',
  Holidays = 'HOLIDAYS',
}

type GooglePhotosMediaType = 'ALL_MEDIA' | 'VIDEO' | 'PHOTO';

enum GooglePhotosFeature {
  None = 'NONE',
  Favorites = 'FAVORITES',
}

// https://developers.google.com/photos/library/reference/rest/v1/mediaItems
interface IMediaItem {
  id: string;
  description: string;
  productUrl: string;
  baseUrl: string;
  mimeType: string;
  mediaMetadata: {
    creationTime: string;
    width: string;
    height: string;
    photo: {
      cameraMake: string;
      cameraModel: string;
      focalLength: number;
      apertureFNumber: number;
      isoEquivalent: number;
      exposureTime: string;
    };
    video: {
      cameraMake: string;
      cameraModel: string;
      fps: number;
      status: 'UNSPECIFIED' | 'PROCESSING' | 'READY' | 'FAILED';
    };
  };
  contributorInfo: {
    profilePictureBaseUrl: string;
    displayName: string;
  };
  filename: string;
}

interface ISharedAlbum {
  id: string;
  title: string;
  productUrl: string;
  isWriteable: boolean;
  shareInfo: {
    sharedAlbumOptions: {
      isCollaborative: boolean;
      isCommentable: boolean;
    };
    shareableUrl: string;
    shareToken: string;
    isJoined: boolean;
    isOwned: boolean;
    isJoinable: boolean;
  };
  mediaItemsCount: string;
  coverPhotoBaseUrl: string;
  coverPhotoMediaItemId: string;
}
