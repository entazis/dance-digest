import YouTube = GoogleAppsScript.YouTube;

interface ISection {
  title: string;
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
  tagExpressions: string[];
  count: number;
}
interface ILesson {
  id: string;
  customTags: string[];
  url: string;
  title: string;
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

const test = () => {
  const results = _getVideos('kizomba/beginner/Niki*Viktor/dance+Balázs', 10);
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

//TODO refactor, download(service)
function downloadYoutubeDetails() {
  const videos = _getYoutubeUploads();
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

//TODO refactor, upload(service)
function uploadYoutubeDetails() {
  const videos = _getYoutubeUploads();
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

      //TODO FIXME "invalid media item ID"
      // const mediaItemsUpdateUrl = `https://photoslibrary.googleapis.com/v1/mediaItems/${videoId}?updateMask=description`;
      // const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      //   method: 'patch',
      //   headers: {
      //     Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
      //   },
      //   contentType: 'application/json',
      //   payload: JSON.stringify({
      //     description: tags.join(','),
      //   }),
      // };
      // const response = UrlFetchApp.fetch(mediaItemsUpdateUrl, params);
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
  menu.addToUi();
}

function _getSections(user: IUser) {
  const sections: ISection[] = [];
  for (const tagExpression of user.tagExpressions) {
    const videos = _getVideos(tagExpression, user.count);
    sections.push({
      title: tagExpression,
      videos,
    });
  }
  return sections;
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
      tagExpressions: userValue[1].split(',').map((te: string) => te.trim()),
      count: userValue[2],
    });
  }
  return users;
}

function _getVideos(tagExpression: string, count: number): IVideo[] {
  const selectedVideos: IVideo[] = [];
  const videos: IVideo[] = [
    ..._getYoutubeUploads(tagExpression),
    ..._getLessons(tagExpression),
    ..._getGooglePhotosVideos(tagExpression),
  ];
  for (let i = 0; i < count; i++) {
    //TODO implement more robust selection
    selectedVideos.push(videos[_getRandomInt(videos.length)]);
  }
  return selectedVideos;
}

function _getYoutubeUploads(tagExpression?: string): IVideo[] {
  try {
    const results = YouTube.Channels.list('contentDetails', {
      mine: true,
    });
    if (!results || results.items.length === 0) {
      Logger.log('no channels found');
      return [];
    } else {
      const videos: IVideo[] = [];
      for (const item of results.items || []) {
        const uploadVideos: IVideo[] = _getVideosOfPlaylist(
          item.contentDetails.relatedPlaylists.uploads
        );
        videos.push(...uploadVideos);
      }
      return tagExpression
        ? _filterVideosByTagExpression(videos, tagExpression)
        : videos;
    }
  } catch (err: any) {
    Logger.log(`Error - getYoutubeUploads(): ${err.message}`);
    return [];
  }
}

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
  const videos = _getYoutubeDetails(lessons.map(lesson => lesson.id)).map(
    video => {
      video.customTags = lessons.find(
        lesson => lesson.id === video.id
      ).customTags;
      return video;
    }
  );
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

function _getVideosOfPlaylist(playlistId: string): IVideo[] {
  const videoIds: string[] = [];
  let nextPageToken = null;
  do {
    const playlistResponse: YouTube.Schema.PlaylistItemListResponse =
      YouTube.PlaylistItems.list('snippet', {
        playlistId: playlistId,
        maxResults: 25,
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

  return _getYoutubeDetails(videoIds);
}

function _getYoutubeDetails(videoIds: string[]): IVideo[] {
  const videos: IVideo[] = [];
  const responses: YouTube.Schema.VideoListResponse[] = [];
  const chunkSize = 50;
  for (let i = 0; i < videoIds.length; i += chunkSize) {
    const vIds = videoIds.slice(i, i + chunkSize);
    responses.push(
      YouTube.Videos.list('snippet', {
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

function _getEmailSubject(user: IUser): string {
  return `${emailSubject}: ${user.tagExpressions.join(', ')}`;
}
function _getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
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
