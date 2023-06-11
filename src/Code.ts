import YouTube = GoogleAppsScript.YouTube;

interface ISection {
  name: string;
  videos: IVideo[];
}
interface IVideo {
  id: string;
  tags: string[];
  title: string;
  url: string;
  pointer?: string;
  customTags?: string[];
}
interface IUser {
  email: string;
  tracks: ITrack[];
}
interface ITrack {
  name: string;
  schedule?: string;
  select: ITrackSelect;
  filter?: ITrackFilter;
  sort?: ITrackSort;
  limit?: ITrackLimit;
}
interface ITrackSelect {
  youtubePlaylistItems?: ISelectYoutubePlaylistItems;
  youtubeVideos?: ISelectYoutubeVideos;
  googlePhotos?: ISelectGooglePhotos;
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
interface ISelectGooglePhotos {
  albumIds?: string[];
  mediaItemIds?: string[];
}
interface ILesson {
  id: string;
  customTags: string[];
  url: string;
  title: string;
}

enum SortBy {
  Title = 'title',
  Date = 'date',
  Random = 'random',
}

const emailTemplateName = 'template';
const emailSubject = 'Daily Dance Digest';
const activeSpreadSheetId = '1xFqsQfTaTo0UzTXt2Qhl9V1m0Sta1fsxOCjAEr2BH3E';
const usersSheetId = '1345088339';
const youtubeUploadsSheetId = '1190338372';
const lessonsSheetId = '472806840';
const googlePhotosSheetId = '1878936212';
const sheetIdNameMap: {[sheetId: string]: string} = {
  [usersSheetId]: 'users',
  [youtubeUploadsSheetId]: 'youtubeUploads',
  [lessonsSheetId]: 'lessons',
  [googlePhotosSheetId]: 'googlePhotos',
};

const testTrack: ITrack = {
  name: 'Practice Bachata',
  select: {
    youtubePlaylistItems: {
      list: {
        part: 'snippet',
        optionalArgs: {
          playlistId: _getYoutubeUploadsPlaylistId(),
          maxResults: 25,
        },
      },
    },
    youtubeVideos: {
      list: {
        part: 'snippet',
        optionalArgs: {
          id: 'CvE0nvyn57w,C6rmpz84aGA,CvzRvpctyaI,QOUadS1FYNc,wlSF0ztk47k,c3QiY_bxU2s,JZw-yYc1bJw,Kl28yQGm1DM,WmtgwdAhEgw,T50f1JcKyvQ,KdwJt3a4Khg,xULxFEtKis8,htdxKWuL4QM,K9fmAh2rTqE,KSd2w72t3xA,7-NSbgdhJ6Q,wzPKWV9LU_Q,zGk9PVQXXo0,GVHiK8ANgkk,updgP09qDHQ,jMFybB_fKks,3yPn9yhTYJU,d9kPiLKb35k,1N4-Nw2k3Hc,NSkWrxFdRCo,ekzGjMZSj5A,UkPukO3M8eQ,yIrQEtMXqNA,p-JlxxcvFng',
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
};

const test = () => {
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
      const sections = _getSections(user);
      _sendEmail(user, sections);
    }
  } catch (err: any) {
    Logger.log(
      `sendDanceDigestEmail() API failed with error ${err.toString()}`
    );
  }
}

function downloadYoutubeUploadsDetails() {
  const videos = _getYoutubePlaylistItemsVideos({
    list: {
      part: 'snippet',
      optionalArgs: {
        playlistId: _getYoutubeUploadsPlaylistId(),
        maxResults: 25,
      },
    },
  });
  SpreadsheetApp.getActiveSpreadsheet()
    .getRange(_getSheetRange(youtubeUploadsSheetId, videos.length))
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
  const videos = _getYoutubePlaylistItemsVideos({
    list: {
      part: 'snippet',
      optionalArgs: {
        playlistId: _getYoutubeUploadsPlaylistId(),
        maxResults: 25,
      },
    },
  });
  const results = SpreadsheetApp.getActiveSpreadsheet()
    .getRange(_getSheetRange(youtubeUploadsSheetId))
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
  const videos = _getGooglePhotosVideos();
  SpreadsheetApp.getActiveSpreadsheet()
    .getRange(_getSheetRange(googlePhotosSheetId, videos.length))
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
  const videos = _getGooglePhotosVideos();
  const results = SpreadsheetApp.getActiveSpreadsheet()
    .getRange(_getSheetRange(googlePhotosSheetId))
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
  menu.addItem('Upload Google Photos details', 'uploadGooglePhotosDetails');
  menu.addToUi();
}

function _getUsers(): IUser[] {
  const userValues = SpreadsheetApp.getActiveSpreadsheet()
    .getRange(_getSheetRange(usersSheetId))
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

function _getSections(user: IUser) {
  const sections: ISection[] = [];
  for (const track of user.tracks) {
    const {name, schedule} = track;
    sections.push({
      name,
      videos: _getVideos(track),
    });
  }
  return sections;
}

function _getVideos(track: ITrack): IVideo[] {
  const {select, filter, sort, limit} = track;
  let videos: IVideo[] = _selectVideos(select);
  if (filter) {
    videos = _filterVideos(videos, filter);
  }
  if (sort) {
    videos = _sortVideos(videos, sort);
  }
  if (limit) {
    videos = _limitVideos(videos, limit);
  }
  return videos;
}

function _selectVideos(select: ITrackSelect): IVideo[] {
  const videos: IVideo[] = [];
  if (select.youtubePlaylistItems) {
    videos.push(..._getYoutubePlaylistItemsVideos(select.youtubePlaylistItems));
  }
  if (select.youtubeVideos) {
    videos.push(..._getYoutubeVideos(select.youtubeVideos));
  }
  if (select.googlePhotos) {
    videos.push(..._getGooglePhotosVideos());
  }
  return videos;
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
    case SortBy.Random:
      return _shuffle(videos);
    default:
      throw new Error(`unknown sort by: ${sort.by}`);
  }
}

function _limitVideos(videos: IVideo[], limit: ITrackLimit): IVideo[] {
  return videos.slice(limit.offset ? limit.offset : 0, limit.count);
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

function _getGooglePhotosVideos(tagExpression?: string): IVideo[] {
  let mediaItems: IMediaItem[] = [];
  let pageToken = '';
  do {
    const mediaItemsSearchUrl =
      'https://photoslibrary.googleapis.com/v1/mediaItems:search';
    const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: 'post',
      headers: {
        Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
      },
      contentType: 'application/json',
      payload: JSON.stringify({
        pageSize: 100,
        pageToken,
        filters: {
          mediaTypeFilter: {
            mediaTypes: ['VIDEO'],
          },
        },
      }),
    };
    const response = UrlFetchApp.fetch(mediaItemsSearchUrl, params);
    const result = JSON.parse(response.getContentText());
    mediaItems = mediaItems.concat(result.mediaItems);
    pageToken = result.nextPageToken;
  } while (pageToken);

  const videos: IVideo[] = mediaItems.map(item => {
    return {
      id: item.id,
      tags: item.description
        ? item.description.split(',').map(tag => tag.trim())
        : [],
      title: item.filename,
      url: item.productUrl,
    };
  });

  return tagExpression
    ? _filterVideosByTagExpression(videos, tagExpression)
    : videos;
}

//TODO refactor lessons to "custom tagging" and merge into youtube uploads
function _getLessons(tagExpression?: string): IVideo[] {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const lessonValues = spreadsheet
    .getRange(_getSheetRange(lessonsSheetId))
    .getValues()
    .filter(row => row[0]);
  const lessons: ILesson[] = [];
  for (const lessonValue of lessonValues) {
    lessons.push({
      id: lessonValue[0],
      customTags: lessonValue[1].split(',').map((tag: string) => tag.trim()),
      url: lessonValue[2],
      title: lessonValue[3],
    });
  }
  const selectYoutubeVideos: ISelectYoutubeVideos = {
    list: {
      part: 'snippet',
      optionalArgs: {
        id: lessons.map(lesson => lesson.id).join(','),
      },
    },
  };
  const videos = _getYoutubeVideos(selectYoutubeVideos).map(video => {
    video.customTags = lessons.find(
      lesson => lesson.id === video.id
    ).customTags;
    return video;
  });
  const lessonsNotFoundOnYoutube = lessons.filter(
    lesson => !videos.find(video => video.id === lesson.id)
  );
  if (lessonsNotFoundOnYoutube.length > 0) {
    const idCellMap = _createIdCellMap(lessonsSheetId);
    for (const lesson of lessonsNotFoundOnYoutube) {
      videos.push({
        ...lesson,
        tags: [],
        pointer: idCellMap[lesson.id]
          ? _getSpreadSheetUrl(lessonsSheetId, idCellMap[lesson.id])
          : undefined,
      });
    }
  }
  return tagExpression
    ? _filterVideosByTagExpression(videos, tagExpression)
    : videos;
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
          return video.customTags
            ? video.customTags.includes(tag)
            : video.tags.includes(tag);
        } else if (operations[index] === '/') {
          return !(video.customTags
            ? video.customTags.includes(tag)
            : video.tags.includes(tag));
        } else {
          return video.customTags
            ? video.customTags.includes(tag)
            : video.tags.includes(tag);
        }
      });
    })
  );
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
  const uploadsIdCellMap = _createIdCellMap(youtubeUploadsSheetId);
  const lessonsIdCellMap = _createIdCellMap(lessonsSheetId);
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
                youtubeUploadsSheetId,
                uploadsIdCellMap[item.id]
              )
            : lessonsIdCellMap[item.id]
            ? _getSpreadSheetUrl(lessonsSheetId, lessonsIdCellMap[item.id])
            : undefined,
        };
      })
    );
  }
  return videos;
}

function _sendEmail(user: IUser, sections: ISection[]): void {
  if (sections.length > 0) {
    const template = HtmlService.createTemplateFromFile(emailTemplateName);
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
  return `${emailSubject}: ${user.tracks.map(track => track.name).join(', ')}`;
}
function _getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
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

const youtubeUrl = 'https://www.youtube.com/watch?v=';
const _getYoutubeVideoUrl = (videoId: string) => youtubeUrl + videoId;
const _getSpreadSheetUrl = (sheetId: string, range?: string) =>
  `https://docs.google.com/spreadsheets/d/${activeSpreadSheetId}/edit#gid=${sheetId}${
    range ? `&range=${range}` : ''
  }`;
const _getSheetRange = (sheetId: string, count?: number) =>
  `${sheetIdNameMap[sheetId]}!A2:D${count ? count + 1 : ''}`;

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
