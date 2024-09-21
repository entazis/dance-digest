function _sendDanceDigests(apiConfig?: IApiConfig | IApiConfig[]) {
  const apiConfigs = apiConfig
    ? Array.isArray(apiConfig)
      ? apiConfig
      : [apiConfig]
    : _getApiConfigs();

  for (const [index, apiConfig] of Object.entries(apiConfigs)) {
    _sendDanceDigest(apiConfig, index);
  }
}

function _sendDanceDigest(apiConfig: IApiConfig, index: string) {
  Logger.log(
    `processing tracks: "${apiConfig.tracks
      .map(track => track.name)
      .join('", "')}" of user with email(s): ${
      Array.isArray(apiConfig.user.email)
        ? apiConfig.user.email.join(', ')
        : apiConfig.user.email
    }`
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
    Logger.log(
      `sending "${sections
        .map(section => section.name)
        .join('", "')}" sections to ${
        Array.isArray(apiConfig.user.email)
          ? apiConfig.user.email.join(', ')
          : apiConfig.user.email
      }`
    );
    _sendSections(sections, user);
  } else {
    Logger.log('no sections found for config');
  }
  _updateProgress(progressesUpdate, index);
}

//TODO refactor getting provider and videos for youtube and google photos upload/download
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

function _updateProgress(progresses: ITrackProgress[], index: string): void {
  SpreadsheetApp.getActiveSpreadsheet()
    //TODO literal
    .getRange(`config!D${2 + parseInt(index)}`)
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
      Logger.log(
        `cron ${cron} does not match current time, skipping track: ${track.name}`
      );
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
    const provider = providers.find(
      provider => provider.type === ProviderType.GooglePhotos
    ) as IProviderConfig | undefined;
    selectedVideos.push(
      ..._getGooglePhotosVideos(provider, fallbackProvider, googlePhotos)
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
  const {tagExpression, playlistIds, dateFilter} = filter;
  if (tagExpression) {
    videos = _filterVideosByTagExpression(videos, tagExpression);
  }
  if (playlistIds) {
    videos = videos.filter(
      video =>
        video.playlistIds &&
        video.playlistIds.some(id => playlistIds.includes(id))
    );
  }
  if (dateFilter) {
    videos = videos.filter(video => {
      const createdAt = new Date(video.createdAt);
      const year = createdAt.getFullYear();
      const month = createdAt.getMonth();
      const day = createdAt.getDate();
      if (dateFilter.dates) {
        return dateFilter.dates.some(
          date => date.year === year && date.month === month && date.day === day
        );
      }
      if (dateFilter.ranges) {
        return dateFilter.ranges.some(range => {
          const {startDate, endDate} = range;
          return (
            (!startDate ||
              (startDate &&
                year >= startDate.year &&
                month >= startDate.month &&
                day >= startDate.day)) &&
            (!endDate ||
              (endDate &&
                year <= endDate.year &&
                month <= endDate.month &&
                day <= endDate.day))
          );
        });
      }
      return true;
    });
  }

  return videos;
}

function _sortVideos(videos: IVideo[], sort: ITrackSort): IVideo[] {
  const {by, order} = sort;
  switch (by) {
    case SortBy.None:
      return videos;
    case SortBy.Title:
      return videos.sort((a, b) =>
        order === AscOrDesc.Desc
          ? -1 * a.title.localeCompare(b.title)
          : a.title.localeCompare(b.title)
      );
    case SortBy.CreatedAt:
      return videos.sort((a, b) =>
        order === AscOrDesc.Desc
          ? -1 * a.createdAt.localeCompare(b.createdAt)
          : a.createdAt.localeCompare(b.createdAt)
      );
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
  //TODO fix bug: Exception: Too many simultaneous invocations: Spreadsheets
  // at _addCustomData(Code:498:10)
  // at _getVideos(Code:395:18)
  // at _getSectionsAndProgress(Code:363:24)
  // at _sendDanceDigest(Code:182:56)
  // at _sendDanceDigests(Code:169:9)
  // at run(Code:160:5)
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
  const videos = _getYoutubeVideos(videoIds, provider, fallbackProvider);
  return videos.map(video => {
    if (!video.playlistIds) {
      video.playlistIds = [playlistId];
    } else {
      video.playlistIds.push(playlistId);
    }
    return video;
  });
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
          createdAt: item.recordingDetails?.recordingDate,
          pointer: provider
            ? _getPointer(item.id, provider.sheet, fallbackProvider.sheet)
            : undefined,
        };
      })
    );
  }
  return videos;
}

//TODO refactor providers, use searchGooglePhotos as first param
function _getGooglePhotosVideos(
  provider?: IProviderConfig,
  fallbackProvider?: IProviderConfig,
  searchGooglePhotos?: SearchGooglePhotos
): IVideo[] {
  let mediaItems: IMediaItem[] = [];
  let pageToken = '';

  if (searchGooglePhotos) {
    do {
      searchGooglePhotos.pageToken = pageToken;
      const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
        method: 'post',
        headers: {
          Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
        },
        contentType: 'application/json',
        payload: JSON.stringify(searchGooglePhotos),
      };
      const response = UrlFetchApp.fetch(mediaItemsSearchUrl, params);
      const result = JSON.parse(response.getContentText());
      if (result.mediaItems) {
        mediaItems = mediaItems.concat(result.mediaItems);
      }
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
      createdAt: item.mediaMetadata.creationTime,
      pointer: provider
        ? _getPointer(item.id, provider.sheet, fallbackProvider.sheet)
        : undefined,
    };
  });
}

function _createNewAlbum(): string {
  const requestData: ICreateNewAlbumRequest = {
    album: {
      title: 'taxi test',
    },
  };
  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    headers: {
      Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
    },
    contentType: 'application/json',
    payload: JSON.stringify(requestData),
  };

  const response = UrlFetchApp.fetch(createAlbumUrl, params);
  const result: ICreateNewAlbumResult = JSON.parse(response.getContentText());

  return result.id;
}

function _shareAlbum(albumId: string): string {
  const requestData: IShareAlbumRequest = {
    sharedAlbumOptions: {
      isCollaborative: 'true',
      isCommentable: 'true',
    },
  };
  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    headers: {
      Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
    },
    contentType: 'application/json',
    payload: JSON.stringify(requestData),
  };

  const response = UrlFetchApp.fetch(getShareAlbumUrl(albumId), params);
  const result: IShareAlbumResponse = JSON.parse(response.getContentText());

  return result.shareInfo.shareToken;
}

function _getSharedAlbums() {
  let sharedAlbums: ISharedAlbum[] = [];
  let pageToken = '';
  const query = {
    pageSize: 50,
    pageToken,
  };

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
  GmailApp.sendEmail(undefined, userConfig.subject, userConfig.body, {
    htmlBody: template.evaluate().getContent(),
    bcc: emails.join(','),
  });
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
