import YouTube = GoogleAppsScript.YouTube;

interface IVideo {
  id: string;
  tags: string[];
  title: string;
  url: string;
  pointer?: string;
}
interface IUser {
  email: string;
  tags: string[];
  count: number;
}
interface ILesson {
  id: string;
  tags: string[];
  url: string;
  title: string;
}

const emailTemplateName = 'template';
const emailSubject = 'Daily Dance Digest';
const configSpreadSheetId = '1xFqsQfTaTo0UzTXt2Qhl9V1m0Sta1fsxOCjAEr2BH3E';
const usersSheetId = '1345088339';
const uploadsSheetId = '1190338372';
const lessonsSheetId = '472806840';
const sheetIdNameMap: {[sheetId: string]: string} = {
  [usersSheetId]: 'users',
  [uploadsSheetId]: 'uploads',
  [lessonsSheetId]: 'lessons',
};
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
  const results = getLessons(['bachata']);
  results.forEach(result => {
    Logger.log(JSON.stringify(result));
  });
};

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

function downloadYoutubeDetails() {
  const videos = getYoutubeUploads();
  SpreadsheetApp.openById(configSpreadSheetId)
    .getRange(getSheetRange(uploadsSheetId, videos.length))
    .setValues(
      videos.map(video => [
        video.id,
        video.tags.join(','),
        video.url,
        video.title,
      ])
    );
}

function uploadYoutubeDetails() {
  const videos = getYoutubeUploads();
  const results = SpreadsheetApp.openById(configSpreadSheetId)
    .getRange(getSheetRange(uploadsSheetId))
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

function getUsers(): IUser[] {
  const userValues = SpreadsheetApp.openById(configSpreadSheetId)
    .getRange(getSheetRange(usersSheetId))
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
    ...getLessons(tags),
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

function getLessons(tags: string[]): IVideo[] {
  const spreadsheet = SpreadsheetApp.openById(configSpreadSheetId);
  const lessonValues = spreadsheet
    .getRange(getSheetRange(lessonsSheetId))
    .getValues()
    .filter(row => row[0]);
  const lessons: ILesson[] = [];
  for (const lessonValue of lessonValues) {
    lessons.push({
      id: lessonValue[0],
      tags: lessonValue[1].split(',').map((tag: string) => tag.trim()),
      url: lessonValue[2],
      title: lessonValue[3],
    });
  }
  const videos = getYoutubeDetails(lessons.map(lesson => lesson.id)).map(
    video => {
      video.tags = video.tags.concat(
        lessons.find(lesson => lesson.id === video.id).tags
      );
      return video;
    }
  );
  const lessonsNotFoundOnYoutube = lessons.filter(
    lesson => !videos.find(video => video.id === lesson.id)
  );
  if (lessonsNotFoundOnYoutube.length > 0) {
    const idCellMap = createIdCellMap(lessonsSheetId);
    for (const lesson of lessonsNotFoundOnYoutube) {
      videos.push({
        ...lesson,
        pointer: idCellMap[lesson.id]
          ? getSheetPointer(lessonsSheetId, idCellMap[lesson.id])
          : undefined,
      });
    }
  }
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

  return getYoutubeDetails(videoIds);
}

function getYoutubeDetails(videoIds: string[]): IVideo[] {
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
  const uploadsIdCellMap = createIdCellMap(uploadsSheetId);
  const lessonsIdCellMap = createIdCellMap(lessonsSheetId);
  for (const response of responses) {
    videos.push(
      ...response.items.map(item => {
        return {
          id: item.id,
          tags: item.snippet.tags,
          title: item.snippet.title,
          url: getYoutubeVideoUrl(item.id),
          pointer: uploadsIdCellMap[item.id]
            ? getSheetPointer(uploadsSheetId, uploadsIdCellMap[item.id])
            : lessonsIdCellMap[item.id]
            ? getSheetPointer(lessonsSheetId, lessonsIdCellMap[item.id])
            : undefined,
        };
      })
    );
  }
  return videos;
}

function sendEmail(user: IUser, videos: IVideo[]): void {
  if (videos.length > 0) {
    const template = HtmlService.createTemplateFromFile(emailTemplateName);
    template.videos = videos;
    GmailApp.sendEmail(user.email, getEmailSubject(user), '', {
      htmlBody: template.evaluate().getContent(),
    });
  }
}

function getEmailSubject(user: IUser): string {
  return `${emailSubject}: ${user.tags.join(', ')}`;
}
function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function createIdCellMap(sheetId: string) {
  const spreadsheet = SpreadsheetApp.openById(configSpreadSheetId);
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

const youtubeUrl = 'https://www.youtube.com/watch?v=';
const getYoutubeVideoUrl = (videoId: string) => youtubeUrl + videoId;
const getSpreadSheetUrl = (
  spreadsheetId: string,
  sheetId: string,
  range?: string
) =>
  `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}${
    range ? `&range=${range}` : ''
  }`;
const getSheetPointer = (sheetId: string, range: string) =>
  getSpreadSheetUrl(configSpreadSheetId, sheetId, range);
const getSheetRange = (sheetId: string, count?: number) =>
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
