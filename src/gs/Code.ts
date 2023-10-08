import YouTube = GoogleAppsScript.YouTube;

interface IApiConfig {
  user: IUserConfig;
  tracks: ITrack[];
  providers: IProviders;
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
  albumId?: string | string[];
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

type IProviders = (IProviderConfig | IYoutubeProviderConfig)[];
interface IProviderConfig {
  type: ProviderType;
  sheet: ISheetConfig;
}
enum ProviderType {
  Youtube = 'youtube',
  GooglePhotos = 'googlePhotos',
  Vimeo = 'vimeo',
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

const idCellMaps: {[sheetName: string]: {[videoId: string]: string}} = {};

//TODO move this to spreadsheet
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
        cron: '0 16 * * *',
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
        cron: '0 16 * * *',
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
        id: '87232840',
        //TODO review to vimeo<>custom
        name: 'custom',
      },
    },
  ],
};

const test = () => {
  Logger.log(`youtube uploads playlist id: ${_getYoutubeUploadsPlaylistId()}`);
  sendDanceDigest(testApiConfig);
  // testApiConfig.tracks.forEach(track => {
  //   Logger.log(JSON.stringify(track));
  //   const videos = _getVideos(track);
  //   videos.forEach(video => {
  //     Logger.log(JSON.stringify(video));
  //   });
  // });
};

function sendDanceDigest(apiConfig?: IApiConfig) {
  apiConfig = apiConfig ? apiConfig : _getApiConfig();
  Logger.log(JSON.stringify(apiConfig));
  const {user, tracks, providers, progresses} = apiConfig;

  _init(providers);
  const {sections, progresses: progressesUpdate} = _getSectionsAndProgress(
    tracks,
    progresses
  );
  _sendSections(sections, user);
  _updateProgress(progressesUpdate);
}

function downloadYoutubeUploadsDetails() {
  const youtubeProvider = _getApiConfig().providers.find(
    provider => provider.type === ProviderType.Youtube
  ) as IYoutubeProviderConfig | undefined;
  if (!youtubeProvider) {
    throw new Error('youtube provider config not found');
  }

  const videos = _getYoutubePlaylistItemsVideos(
    youtubeProvider.uploadsPlaylistId
  );
  SpreadsheetApp.getActiveSpreadsheet()
    .getRange(_getA1Notation(youtubeProvider.sheet.name, videos.length))
    .setValues(
      videos.map(video => [
        video.id,
        video.tags.join(','),
        video.url,
        video.title,
      ])
    );
}

function uploadYoutubeUploadsDetails() {
  const youtubeProvider = _getApiConfig().providers.find(
    provider => provider.type === ProviderType.Youtube
  ) as IYoutubeProviderConfig | undefined;
  if (!youtubeProvider) {
    throw new Error('youtube provider config not found');
  }

  const videos = _getYoutubePlaylistItemsVideos(
    youtubeProvider.uploadsPlaylistId
  );
  const results = SpreadsheetApp.getActiveSpreadsheet()
    .getRange(_getA1Notation(youtubeProvider.sheet.name))
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

function downloadGooglePhotosDetails() {
  const googlePhotosProvider = _getApiConfig().providers.find(
    provider => provider.type === ProviderType.GooglePhotos
  ) as IProviderConfig | undefined;
  if (!googlePhotosProvider) {
    throw new Error('google photos provider config not found');
  }

  const videos = _getGooglePhotosVideos();
  SpreadsheetApp.getActiveSpreadsheet()
    .getRange(_getA1Notation(googlePhotosProvider.sheet.name, videos.length))
    .setValues(
      videos.map(video => [
        video.id,
        video.tags.join(','),
        video.url,
        video.title,
      ])
    );
}

function uploadGooglePhotosDetails() {
  const googlePhotosProvider = _getApiConfig().providers.find(
    provider => provider.type === ProviderType.GooglePhotos
  ) as IProviderConfig | undefined;
  if (!googlePhotosProvider) {
    throw new Error('google photos provider config not found');
  }

  const videos = _getGooglePhotosVideos();
  const results = SpreadsheetApp.getActiveSpreadsheet()
    .getRange(_getA1Notation(googlePhotosProvider.sheet.name))
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

function _getApiConfig(): IApiConfig {
  const configValues = SpreadsheetApp.getActiveSpreadsheet()
    .getRange('config!A2:D')
    .getValues()
    .filter(row => row[0]);
  const apiConfigs: IApiConfig[] = [];
  for (const configValue of configValues) {
    if (!configValue[0] || !configValue[1] || !configValue[2]) {
      throw new Error(`invalid api config, ${JSON.stringify(configValue)}`);
    }
    apiConfigs.push({
      user: JSON.parse(configValue[0]),
      tracks: JSON.parse(configValue[1]),
      providers: JSON.parse(configValue[2]),
      progresses: JSON.parse(configValue[3] || '[]'),
    });
  }
  if (apiConfigs.length > 1) {
    console.warn('more than one api config found, using the first one');
  } else if (apiConfigs.length < 1) {
    throw new Error('no api config found');
  } else {
    return apiConfigs[0];
  }
}

function _updateProgress(progresses: ITrackProgress[]): void {
  SpreadsheetApp.getActiveSpreadsheet()
    .getRange('config!D2')
    .setValue(JSON.stringify(progresses));
}

function _init(providerConfigs: IProviderConfig[]) {
  for (const providerConfig of providerConfigs) {
    switch (providerConfig.type) {
      case ProviderType.Youtube:
      case ProviderType.GooglePhotos:
      case ProviderType.Vimeo:
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
  progresses: ITrackProgress[]
): {
  sections: ISection[];
  progresses: ITrackProgress[];
} {
  const sections: ISection[] = [];
  for (const track of tracks) {
    let progress: ITrackProgress | undefined = progresses.find(
      progress => progress.name === track.name
    );
    if (!progress && track.limit.progress) {
      progress = {
        name: track.name,
        current: 0,
        isStopped: false,
      };
      progresses.push(progress);
    }
    const videos = _getVideos(track, progress?.current);
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

function _getVideos(track: ITrack, current?: number): IVideo[] {
  const {select, filter, sort, limit} = track;
  let videos: IVideo[] = _selectVideos(select);
  videos = _addCustomData(videos);
  if (filter) {
    videos = _filterVideos(videos, filter);
  }
  if (sort) {
    videos = _sortVideos(videos, sort);
  }
  videos = _limitVideos(videos, limit, current);
  return videos;
}

function _selectVideos(select: ITrackSelect): IVideo[] {
  const selectedVideos: IVideo[] = [];
  const {youtube, googlePhotos, vimeo} = select;
  if (youtube) {
    const {playlistId, videoId} = youtube;
    if (playlistId) {
      const playlistIds = Array.isArray(playlistId) ? playlistId : [playlistId];
      for (const playlistId of playlistIds) {
        selectedVideos.push(..._getYoutubePlaylistItemsVideos(playlistId));
      }
    }
    if (videoId) {
      selectedVideos.push(..._getYoutubeVideos(videoId));
    }
  }
  if (googlePhotos) {
    selectedVideos.push(..._getGooglePhotosVideos());
  }
  if (vimeo) {
    selectedVideos.push(..._getVimeoVideos(vimeo));
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

function _addCustomData(videos: IVideo[]): IVideo[] {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const customValues = spreadsheet
    .getRange(_getA1Notation(testApiConfig.spreadsheet.custom.name))
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

function _getYoutubePlaylistItemsVideos(playlistId: string): IVideo[] {
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
  return _getYoutubeVideos(videoIds);
}

function _getYoutubeVideos(videoId: string | string[]): IVideo[] {
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
          pointer: getPointer(
            item.id,
            testApiConfig.spreadsheet.youtubeUploads.id,
            testApiConfig.spreadsheet.youtubeUploads.name
          ),
        };
      })
    );
  }
  return videos;
}

function _getGooglePhotosVideos(): IVideo[] {
  let mediaItems: IMediaItem[] = [];
  let pageToken = '';
  const {search} = _getGooglePhotosParams().mediaItems;

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
      pointer: getPointer(
        item.id,
        testApiConfig.spreadsheet.googlePhotos.id,
        testApiConfig.spreadsheet.googlePhotos.name
      ),
    };
  });
}

function _getVimeoVideos(selectVimeo: ISelectVimeo): IVideo[] {
  //TODO connect to vimeo API
  const {videoIds} = selectVimeo;
  return videoIds.map(id => {
    return {
      id,
      //TODO add tags and title from custom sheet
      tags: [],
      title: '',
      url: _getVimeoVideoUrl(id),
      pointer: getPointer(
        id,
        testApiConfig.spreadsheet.custom.id,
        testApiConfig.spreadsheet.custom.name
      ),
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

function getPointer(videoId: string, sheetId: string, sheetName: string) {
  const sheetIdCellMap = _getIdCellMap(sheetName);
  if (sheetName === testApiConfig.spreadsheet.custom.name) {
    return sheetIdCellMap[videoId]
      ? _getSpreadSheetUrl(sheetId, sheetIdCellMap[videoId])
      : undefined;
  } else {
    const customIdCellMap = _getIdCellMap(
      testApiConfig.spreadsheet.custom.name
    );
    return sheetIdCellMap[videoId]
      ? _getSpreadSheetUrl(sheetId, sheetIdCellMap[videoId])
      : customIdCellMap[videoId]
      ? _getSpreadSheetUrl(
          testApiConfig.spreadsheet.custom.id,
          customIdCellMap[videoId]
        )
      : undefined;
  }
}

function _getIdCellMap(sheetName: string) {
  if (!idCellMaps[sheetName]) {
    idCellMaps[sheetName] = _createIdCellMap(sheetName);
  }
  return idCellMaps[sheetName];
}

function _createIdCellMap(sheetName: string): {[videoId: string]: string} {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);

  const values = sheet.getDataRange().getValues();
  const idCellMap: {[videoId: string]: string} = {};
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

function _getGooglePhotosParams(): {mediaItems: ISelectGooglePhotosMediaItems} {
  return {
    mediaItems: {
      search: {
        pageSize: 100,
        filters: {
          mediaTypeFilter: {
            mediaTypes: ['VIDEO'],
          },
        },
      },
    },
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
