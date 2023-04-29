import YouTube = GoogleAppsScript.YouTube;

interface IVideo {
  id: string;
  tags: string[];
  title: string;
  url: string;
}
interface IUser {
  email: string;
  tags: string[];
  count: number;
}
interface IYoutubeLesson {
  id: string;
  tags: string[];
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

const emailTemplateName = 'template';
const emailSubject = 'Daily Dance Digest';
const youtubeUrl = 'https://www.youtube.com/watch?v=';
const configSpreadSheetId = '1xFqsQfTaTo0UzTXt2Qhl9V1m0Sta1fsxOCjAEr2BH3E';
const tagsSheetId = '1190338372';
const usersRange = 'users!A2:C';
const photosAlbumNameToIdMap: {[albumName: string]: string} = {
  bachata:
    'AB0dA_1B4FrJJ5axjP2gIbiT7U_o71YH9uIL0H_6FSzEj5VLb5Pwnl007jFpKI7g9vyfVY7K0k5G',
  kizomba:
    'AB0dA_243Vlkg8GXGdVJYxWurWdx8wJhbRiy71DEAmf0ZfDMrDvT6RrxYvWrdLKo6bPZzr8K9Po0',
  salsa:
    'AB0dA_0FkOSUdjFy2OrLR80mMGAGA2qEV257dlTELzYJX7pt2FLMSmxbXcBNu4oFqO5PHiQ8AOUx',
  reggaeton:
    'AB0dA_0Fh2-aYxcvsIuGQUWrIKsFNwOkAJWLTLZvf6ptQxeBaFvdc5fW3IGZVU-82yhAbuIrCj-B',
};

const test = () => {
  const results = getYoutubeLessons(['kizomba']);
  results.forEach(result => {
    Logger.log(JSON.stringify(result));
  });
};

const getYoutubeVideoUrl = (videoId: string) => youtubeUrl + videoId;
const getSpreadSheetUrl = (
  spreadsheetId: string,
  sheetId: string,
  range?: string
) =>
  `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}${
    range ? `&range=${range}` : ''
  }`;
const getConfigSpreadSheetRange = (range: string) =>
  getSpreadSheetUrl(configSpreadSheetId, tagsSheetId, range);

function sendDanceDigestEmail() {
  try {
    const users = getUsers();
    Logger.log(JSON.stringify(users));

    for (const user of users) {
      sendEmail(user, getVideos(user.tags, user.count));
    }
  } catch (err: any) {
    Logger.log(
      `sendDanceDigestEmail() API failed with error ${err.toString()}`
    );
  }
}

function downloadYoutubeTags() {
  const videos = getYoutubeUploads();
  SpreadsheetApp.openById(configSpreadSheetId)
    .getRange(`tags!A2:B${videos.length + 1}`)
    .setValues(videos.map(video => [video.id, video.tags.join(',')]));
}

function uploadYoutubeTags() {
  const videos = getYoutubeUploads();
  const results = SpreadsheetApp.openById(configSpreadSheetId)
    .getRange('tags!A2:B')
    .getValues()
    .filter(row => row[0]);

  for (const result of results) {
    const videoId = result[0];
    const tags = result[1].split(',').map((tag: string) => tag.trim());
    const video = videos.find(video => video.id === videoId);
    if (JSON.stringify(tags) !== JSON.stringify(video.tags)) {
      Logger.log(
        `updating tags of ${videoId} to ${JSON.stringify(
          tags
        )} (previous: ${JSON.stringify(video.tags)})`
      );
      const vid = YouTube.Videos.list('snippet', {id: videoId}).items[0];
      vid.snippet.tags = tags;
      YouTube.Videos.update(vid, 'snippet');
    }
  }
}

function getUsers(): IUser[] {
  const userValues = SpreadsheetApp.openById(configSpreadSheetId)
    .getRange(usersRange)
    .getValues()
    .filter(row => row[0]);
  const users: IUser[] = [];
  for (const userValue of userValues) {
    users.push({
      email: userValue[0],
      tags: userValue[1].split(',').map((tag: string) => tag.trim()),
      count: userValue[2],
    });
  }
  return users;
}

function getVideos(tags: string[], count: number): IVideo[] {
  const selectedVideos: IVideo[] = [];
  const videos: IVideo[] = [
    ...getYoutubeUploads(tags),
    ...getYoutubeLessons(tags),
    ...(tags.length === 1 ? getGooglePhotosVideos(tags[0]) : []),
  ];
  for (let i = 0; i < count; i++) {
    //TODO implement more robust selection
    selectedVideos.push(videos[getRandomInt(videos.length)]);
  }
  return selectedVideos;
}

function getYoutubeUploads(tags?: string[]): IVideo[] {
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
        const uploadVideos: IVideo[] = getVideosOfPlaylist(
          item.contentDetails.relatedPlaylists.uploads
        );
        videos.push(...uploadVideos);
      }
      //TODO create more robust filtering (use expressions and set operations)
      return videos.filter(video =>
        tags ? tags.every(tag => video.tags.includes(tag)) : true
      );
    }
  } catch (err: any) {
    Logger.log(`Error - getYoutubeUploads(): ${err.message}`);
    return [];
  }
}

function getYoutubeLessons(tags: string[]): IVideo[] {
  const spreadsheet = SpreadsheetApp.openById(configSpreadSheetId);
  const lessonValues = spreadsheet
    .getRange('lessons!A2:B')
    .getValues()
    .filter(row => row[0]);
  const youtubeLessons: IYoutubeLesson[] = [];
  for (const lessonValue of lessonValues) {
    youtubeLessons.push({
      id: lessonValue[0],
      tags: lessonValue[1].split(',').map((tag: string) => tag.trim()),
    });
  }
  const videos = getVideoDetails(youtubeLessons.map(lesson => lesson.id)).map(
    video => {
      video.tags = video.tags.concat(
        youtubeLessons.find(lesson => lesson.id === video.id).tags
      );
      return video;
    }
  );
  return videos.filter(video => tags.every(tag => video.tags.includes(tag)));
}

function getVideosOfPlaylist(playlistId: string): IVideo[] {
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

  return getVideoDetails(videoIds);
}

function getVideoDetails(videoIds: string[]): IVideo[] {
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
  for (const response of responses) {
    videos.push(
      ...response.items.map(item => {
        return {
          id: item.id,
          tags: item.snippet.tags,
          title: item.snippet.title,
          url: getYoutubeVideoUrl(item.id),
        };
      })
    );
  }
  return videos;
}

function sendEmail(user: IUser, videos: IVideo[]): void {
  const template = HtmlService.createTemplateFromFile(emailTemplateName);
  template.videos = videos;
  GmailApp.sendEmail(user.email, getEmailSubject(user), '', {
    htmlBody: template.evaluate().getContent(),
  });
}

function getEmailSubject(user: IUser): string {
  return `${emailSubject}: ${user.tags.join(', ')}`;
}
function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function findCellWithId(id: string) {
  const spreadsheet = SpreadsheetApp.openById(configSpreadSheetId);
  const sheet = spreadsheet.getSheetByName('tags');
  const values = sheet.getDataRange().getValues();
  Logger.log(JSON.stringify(values));

  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === id) {
      const row = i + 1;
      const column = 1;
      const cell = sheet.getRange(row, column);
      return cell.getA1Notation();
    }
  }

  return null;
}

function getGooglePhotosVideos(albumName: string): IVideo[] {
  if (!photosAlbumNameToIdMap[albumName]) {
    return [];
  }
  const photosParams = getPhotosParams(
    ScriptApp.getOAuthToken(),
    photosAlbumNameToIdMap[albumName]
  );
  let response: {mediaItems: IMediaItem[]; nextPageToken?: string} = JSON.parse(
    UrlFetchApp.fetch(`${mediaItemsSearchUrl}`, photosParams).getContentText()
  );
  let danceVideos: IVideo[] = response.mediaItems.map(item => {
    return {id: null, tags: [], title: item.filename, url: item.productUrl};
  });
  while (response.nextPageToken) {
    if (photosParams.payload) {
      (photosParams.payload as {[key: string]: any}).pageToken =
        response.nextPageToken;
    }
    response = JSON.parse(
      UrlFetchApp.fetch(`${mediaItemsSearchUrl}`, photosParams).getContentText()
    );
    danceVideos = danceVideos.concat(
      response.mediaItems.map(item => {
        return {id: null, tags: [], title: item.filename, url: item.productUrl};
      })
    );
  }
  return danceVideos;
}
const mediaItemsSearchUrl =
  'https://photoslibrary.googleapis.com/v1/mediaItems:search';
const getPhotosParams = (
  scriptOAuthToken: string,
  albumId: string
): GoogleAppsScript.URL_Fetch.URLFetchRequestOptions => {
  return {
    headers: {
      Authorization: `Bearer ${scriptOAuthToken}`,
    },
    method: 'post',
    payload: {
      pageSize: '100',
      albumId: albumId,
    },
  };
};
