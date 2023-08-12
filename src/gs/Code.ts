import YouTube = GoogleAppsScript.YouTube;

interface IUser {
  email: string;
  tracks: ITrack[];
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
interface ITrack {
  name: string;
  select: ITrackSelect;
  filter?: ITrackFilter;
  sort?: ITrackSort;
  limit?: ITrackLimit;
  progress?: ITrackProgress;
  schedule?: ITrackSchedule;
}
interface ITrackSelect {
  youtube?: ISelectYoutube;
  googlePhotos?: ISelectGooglePhotos;
  vimeo?: ISelectVimeo;
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
}
interface ITrackProgress {
  current: number;
  loop?: boolean;
  isStopped?: boolean;
}
interface ITrackSchedule {
  cron: string;
  timezone?: string;
}
interface ISelectYoutube {
  playlistItems?: ISelectYoutubePlaylistItems;
  videos?: ISelectYoutubeVideos;
}
interface ISelectGooglePhotos {
  mediaItems: ISelectGooglePhotosMediaItems;
  //TODO implement albums, sharedAlbums apis (GET)
  albums?: any;
  sharedAlbums?: any;
}
interface ISelectVimeo {
  videoIds: string[];
}

enum SortBy {
  None = 'none',
  Title = 'title',
  Date = 'date',
  Random = 'random',
}

const apiConfig = {
  email: {
    templateName: 'template',
    subject: 'Daily Dance Digest',
  },
  spreadsheet: {
    activeSpreadSheetId: '1xFqsQfTaTo0UzTXt2Qhl9V1m0Sta1fsxOCjAEr2BH3E',
    usersSheetId: '1668639876',
    customSheetId: '87232840',
    youtubeUploadsSheetId: '1190338372',
    googlePhotosSheetId: '1878936212',
  },
};

const sheetIdNameMap: {[sheetId: string]: string} = {
  [apiConfig.spreadsheet.usersSheetId]: 'users',
  [apiConfig.spreadsheet.customSheetId]: 'custom',
  [apiConfig.spreadsheet.youtubeUploadsSheetId]: 'youtubeUploads',
  [apiConfig.spreadsheet.googlePhotosSheetId]: 'googlePhotos',
};

const selectYoutubeUploadsPlaylistItems: ISelectYoutubePlaylistItems = {
  list: {
    part: 'snippet',
    optionalArgs: {
      playlistId: _getYoutubeUploadsPlaylistId(),
      maxResults: 25,
    },
  },
};

const selectGooglePhotosUploads: ISelectGooglePhotos = {
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

const testTrack: ITrack = {
  name: 'Practice Bachata',
  select: {
    youtube: {
      playlistItems: {
        list: {
          part: 'snippet',
          optionalArgs: {
            playlistId: _getYoutubeUploadsPlaylistId(),
            maxResults: 25,
          },
        },
      },
      videos: {
        list: {
          part: 'snippet',
          optionalArgs: {
            id: 'CvE0nvyn57w,C6rmpz84aGA,CvzRvpctyaI,QOUadS1FYNc,wlSF0ztk47k,c3QiY_bxU2s,JZw-yYc1bJw,Kl28yQGm1DM,WmtgwdAhEgw,T50f1JcKyvQ,KdwJt3a4Khg,xULxFEtKis8,htdxKWuL4QM,K9fmAh2rTqE,KSd2w72t3xA,7-NSbgdhJ6Q,wzPKWV9LU_Q,zGk9PVQXXo0,GVHiK8ANgkk,updgP09qDHQ,jMFybB_fKks,3yPn9yhTYJU,d9kPiLKb35k,1N4-Nw2k3Hc,NSkWrxFdRCo,ekzGjMZSj5A,UkPukO3M8eQ,yIrQEtMXqNA,p-JlxxcvFng',
          },
        },
      },
    },
    googlePhotos: {
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
    },
  },
  filter: {
    tagExpression: 'bachata',
  },
  sort: {
    by: SortBy.Random,
  },
  limit: {
    count: 3,
  },
  progress: {
    current: 0,
  },
  schedule: {
    cron: '0 16 * * *',
    timezone: 'Europe/Budapest',
  },
};

const test = () => {
  Logger.log(`youtube uploads playlist id: ${_getYoutubeUploadsPlaylistId()}`);
  const results = _getVideos(testTrack);
  results.forEach(result => {
    Logger.log(JSON.stringify(result));
  });
};

function sendDanceDigestEmail() {
  try {
    const users = _getUsers();
    Logger.log(JSON.stringify(users));

    for (const user of users) {
      const {sections, tracks} = _getSections(user);
      _sendEmail(user, sections);
      user.tracks = tracks;
    }

    _saveUsers(users);
  } catch (err: any) {
    Logger.log(
      `sendDanceDigestEmail() API failed with error ${err.toString()}`
    );
  }
}

function downloadYoutubeUploadsDetails() {
  const videos = _getYoutubePlaylistItemsVideos(
    selectYoutubeUploadsPlaylistItems
  );
  SpreadsheetApp.getActiveSpreadsheet()
    .getRange(
      _getSheetRange(apiConfig.spreadsheet.youtubeUploadsSheetId, videos.length)
    )
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
  const videos = _getYoutubePlaylistItemsVideos(
    selectYoutubeUploadsPlaylistItems
  );
  const results = SpreadsheetApp.getActiveSpreadsheet()
    .getRange(_getSheetRange(apiConfig.spreadsheet.youtubeUploadsSheetId))
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
  const videos = _getGooglePhotosVideos(selectGooglePhotosUploads);
  SpreadsheetApp.getActiveSpreadsheet()
    .getRange(
      _getSheetRange(apiConfig.spreadsheet.googlePhotosSheetId, videos.length)
    )
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
  const videos = _getGooglePhotosVideos(selectGooglePhotosUploads);
  const results = SpreadsheetApp.getActiveSpreadsheet()
    .getRange(_getSheetRange(apiConfig.spreadsheet.googlePhotosSheetId))
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

function _getUsers(): IUser[] {
  const userValues = SpreadsheetApp.getActiveSpreadsheet()
    .getRange(_getSheetRange(apiConfig.spreadsheet.usersSheetId))
    .getValues()
    .filter(row => row[0]);
  const users: IUser[] = [];
  for (const userValue of userValues) {
    users.push({
      email: userValue[0],
      tracks: JSON.parse(userValue[1]),
    });
  }
  return users;
}

function _saveUsers(users: IUser[]): void {
  SpreadsheetApp.getActiveSpreadsheet()
    .getRange(_getUsersSheetRange(users.length))
    .setValues(users.map(user => [user.email, JSON.stringify(user.tracks)]));
}

function _getSections(user: IUser) {
  const sections: ISection[] = [];
  for (const trackIndex in user.tracks) {
    //TODO implement scheduling
    const track = user.tracks[trackIndex];
    const {name, schedule, progress, limit} = track;
    const videos = _getVideos(track);
    if (progress) {
      if (!progress.isStopped) {
        let current = progress.current + (limit.offset ? limit.offset : 0);
        if (videos.length < 1) {
          if (progress.loop) {
            current = limit.offset ? limit.offset : 0;
          } else {
            progress.isStopped = true;
          }
        } else {
          sections.push({
            name,
            videos,
          });
        }
        user.tracks[trackIndex].progress.current = current + videos.length;
      }
    } else {
      sections.push({
        name,
        videos,
      });
    }
  }
  return {sections, tracks: user.tracks};
}

function _getVideos(track: ITrack): IVideo[] {
  const {select, filter, sort, limit, progress} = track;
  let videos: IVideo[] = _selectVideos(select);
  videos = _addCustomData(videos);
  if (filter) {
    videos = _filterVideos(videos, filter);
  }
  if (sort) {
    videos = _sortVideos(videos, sort);
  }
  videos = _limitVideos(videos, limit, progress);

  return videos;
}

function _selectVideos(select: ITrackSelect): IVideo[] {
  const selectedVideos: IVideo[] = [];
  const {youtube, googlePhotos, vimeo} = select;
  if (youtube) {
    const {playlistItems, videos} = youtube;
    if (playlistItems) {
      selectedVideos.push(..._getYoutubePlaylistItemsVideos(playlistItems));
    }
    if (videos) {
      selectedVideos.push(..._getYoutubeVideos(videos));
    }
  }
  if (googlePhotos) {
    selectedVideos.push(..._getGooglePhotosVideos(googlePhotos));
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
  progress: ITrackProgress = {current: 0, loop: true, isStopped: false}
): IVideo[] {
  let offset = progress.current + (limit.offset ? limit.offset : 0);
  const count = limit.count ? limit.count : 1;
  let nextVideos = videos.slice(offset, offset + count);
  if (nextVideos.length < 1) {
    if (progress.loop) {
      offset = limit.offset ? limit.offset : 0;
      nextVideos = videos.slice(offset, count);
    } else {
      nextVideos = [];
    }
  }
  return nextVideos;
}

function _addCustomData(videos: IVideo[]): IVideo[] {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const customValues = spreadsheet
    .getRange(_getSheetRange(apiConfig.spreadsheet.customSheetId))
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
  selectYoutubePlaylistItems: ISelectYoutubePlaylistItems
): IVideo[] {
  const {part, optionalArgs} = selectYoutubePlaylistItems.list;
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
  const selectYoutubeVideos: ISelectYoutubeVideos = {
    list: {
      part: 'snippet',
      optionalArgs: {
        id: videoIds.join(','),
      },
    },
  };
  return _getYoutubeVideos(selectYoutubeVideos);
}

function _getYoutubeVideos(youtubeVideos: ISelectYoutubeVideos): IVideo[] {
  const {part, optionalArgs} = youtubeVideos.list;
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
  const uploadsIdCellMap = _createIdCellMap(
    apiConfig.spreadsheet.youtubeUploadsSheetId
  );
  const customIdCellMap = _createIdCellMap(apiConfig.spreadsheet.customSheetId);
  for (const response of responses) {
    videos.push(
      ...response.items.map(item => {
        return {
          id: item.id,
          tags: item.snippet.tags,
          title: item.snippet.title,
          url: _getYoutubeVideoUrl(item.id),
          pointer: uploadsIdCellMap[item.id]
            ? _getSpreadSheetUrl(
                apiConfig.spreadsheet.youtubeUploadsSheetId,
                uploadsIdCellMap[item.id]
              )
            : customIdCellMap[item.id]
            ? _getSpreadSheetUrl(
                apiConfig.spreadsheet.customSheetId,
                customIdCellMap[item.id]
              )
            : undefined,
        };
      })
    );
  }
  return videos;
}

function _getGooglePhotosVideos(
  selectGooglePhotos: ISelectGooglePhotos
): IVideo[] {
  let mediaItems: IMediaItem[] = [];
  let pageToken = '';
  const {search} = selectGooglePhotos.mediaItems;
  const googlePhotosIdCellMap = _createIdCellMap(
    apiConfig.spreadsheet.googlePhotosSheetId
  );
  const customIdCellMap = _createIdCellMap(apiConfig.spreadsheet.customSheetId);

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
      pointer: googlePhotosIdCellMap[item.id]
        ? _getSpreadSheetUrl(
            apiConfig.spreadsheet.googlePhotosSheetId,
            googlePhotosIdCellMap[item.id]
          )
        : customIdCellMap[item.id]
        ? _getSpreadSheetUrl(
            apiConfig.spreadsheet.customSheetId,
            customIdCellMap[item.id]
          )
        : undefined,
    };
  });
}

function _getVimeoVideos(selectVimeo: ISelectVimeo): IVideo[] {
  //TODO connect to vimeo API
  const {videoIds} = selectVimeo;
  const customIdCellMap = _createIdCellMap(apiConfig.spreadsheet.customSheetId);
  return videoIds.map(id => {
    return {
      id,
      //TODO add tags and title from custom sheet
      tags: [],
      title: '',
      url: _getVimeoVideoUrl(id),
      pointer: customIdCellMap[id]
        ? _getSpreadSheetUrl(
            apiConfig.spreadsheet.customSheetId,
            customIdCellMap[id]
          )
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

function _sendEmail(user: IUser, sections: ISection[]): void {
  if (sections.length > 0) {
    const template = HtmlService.createTemplateFromFile(
      apiConfig.email.templateName
    );
    template.sections = sections;
    GmailApp.sendEmail(user.email, _getEmailSubject(user), '', {
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

function _getEmailSubject(user: IUser): string {
  return `${apiConfig.email.subject}: ${user.tracks
    .map(track => track.name)
    .join(', ')}`;
}

function _shuffle([...arr]) {
  let m = arr.length;
  while (m) {
    const i = Math.floor(Math.random() * m--);
    [arr[m], arr[i]] = [arr[i], arr[m]];
  }
  return arr;
}

function _createIdCellMap(sheetId: string) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetIdNameMap[sheetId]);

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
  `https://docs.google.com/spreadsheets/d/${
    apiConfig.spreadsheet.activeSpreadSheetId
  }/edit#gid=${sheetId}${range ? `&range=${range}` : ''}`;
const _getSheetRange = (sheetId: string, count?: number) =>
  `${sheetIdNameMap[sheetId]}!A2:D${count ? count + 1 : ''}`;
const _getUsersSheetRange = (count?: number) =>
  `${sheetIdNameMap[apiConfig.spreadsheet.usersSheetId]}!A2:B${
    count ? count + 1 : ''
  }`;

// https://developers.google.com/youtube/v3/docs/playlistItems/list
interface ISelectYoutubePlaylistItems {
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
interface ISelectYoutubeVideos {
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
