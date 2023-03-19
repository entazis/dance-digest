import YouTube = GoogleAppsScript.YouTube;

interface ICategoryVideos {
  [category: string]: IVideo[];
}
interface IVideo {
  id: string;
  tags: string[];
  title: string;
  url: string;
}
interface IConfigs {
  [email: string]: {[category: string]: number};
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

const categoryToAlbumIdMap: {[category: string]: string} = {
  bachata:
    'AB0dA_1B4FrJJ5axjP2gIbiT7U_o71YH9uIL0H_6FSzEj5VLb5Pwnl007jFpKI7g9vyfVY7K0k5G',
  kizomba:
    'AB0dA_243Vlkg8GXGdVJYxWurWdx8wJhbRiy71DEAmf0ZfDMrDvT6RrxYvWrdLKo6bPZzr8K9Po0',
  salsa:
    'AB0dA_0FkOSUdjFy2OrLR80mMGAGA2qEV257dlTELzYJX7pt2FLMSmxbXcBNu4oFqO5PHiQ8AOUx',
  reggaeton:
    'AB0dA_0Fh2-aYxcvsIuGQUWrIKsFNwOkAJWLTLZvf6ptQxeBaFvdc5fW3IGZVU-82yhAbuIrCj-B',
};
const configSpreadSheetId = '1xFqsQfTaTo0UzTXt2Qhl9V1m0Sta1fsxOCjAEr2BH3E';
const youtubeUrl = 'https://www.youtube.com/watch?v=';

const test = () => {
  const results = getYoutubeUploads();
  results.forEach(result => {
    Logger.log(JSON.stringify(result));
  });
};

const getYoutubeVideoUrl = (videoId: string) => youtubeUrl + videoId;

function sendDanceDigestEmail() {
  try {
    const config = getConfig();

    for (const email in config) {
      const selected = config[email];
      const categoryVideos: ICategoryVideos = {};
      for (const category in selected) {
        categoryVideos[category] = getVideos(category, selected[category]);
      }
      sendEmail(
        {
          to: email,
          subject: 'Daily Dance Digest',
          templateName: 'template',
        },
        categoryVideos
      );
    }
  } catch (err: any) {
    Logger.log(
      `sendDanceDigestEmail() API failed with error ${err.toString()}`
    );
  }
}

function getVideos(category: string, count: number): IVideo[] {
  const selectedVideos: IVideo[] = [];
  const videos: IVideo[] = [
    ...getYoutubeUploads(),
    ...getGooglePhotosVideos(category),
  ];
  for (let i = 0; i < count; i++) {
    //TODO implement more robust selection
    selectedVideos.push(videos[getRandomInt(videos.length)]);
  }
  return selectedVideos;
}

function getYoutubeUploads(): IVideo[] {
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
        const videoIds: string[] = getVideoIdsOfPlaylist(
          item.contentDetails.relatedPlaylists.uploads
        );
        for (const videoId of videoIds) {
          videos.push(getVideoDetails(videoId));
        }
      }
      return videos;
    }
  } catch (err: any) {
    Logger.log(`Error - getYoutubeUploads(): ${err.message}`);
    return [];
  }
}

function getVideoIdsOfPlaylist(playlistId: string): string[] {
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
  return videoIds;
}

function getVideoDetails(videoId: string): IVideo {
  const videoResponse: YouTube.Schema.VideoListResponse = YouTube.Videos.list(
    'snippet',
    {
      id: videoId,
    }
  );
  if (!videoResponse || videoResponse.items.length === 0) {
    Logger.log(`no video found for ${videoId}`);
    throw new Error(`no video found for id ${videoId}`);
  } else {
    if (videoResponse.items.length > 1) {
      Logger.log(`more than one video found for id ${videoId}`);
      throw new Error(`more than one video found for id ${videoId}`);
    } else {
      const item = videoResponse.items[0];
      return {
        id: item.id,
        tags: item.snippet.tags,
        title: item.snippet.title,
        url: getYoutubeVideoUrl(videoId),
      };
    }
  }
}

function getGooglePhotosVideos(category: string): IVideo[] {
  const photosParams = getPhotosParams(
    ScriptApp.getOAuthToken(),
    categoryToAlbumIdMap[category]
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

function sendEmail(
  emailPayload: {to: string; subject: string; templateName: string},
  categoryVideos: ICategoryVideos
): void {
  const template = HtmlService.createTemplateFromFile(
    emailPayload.templateName
  );
  template.categoryVideos = categoryVideos;
  GmailApp.sendEmail(emailPayload.to, emailPayload.subject, '', {
    htmlBody: template.evaluate().getContent(),
  });
}

function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function getConfig(): IConfigs {
  const spreadsheet = SpreadsheetApp.openById(configSpreadSheetId);
  const emailCount = spreadsheet.getRange('metadata!A2').getValue();
  const genreCount = spreadsheet.getRange('metadata!B2').getValue();

  const letter = columnToLetter(genreCount);

  const config: IConfigs = {};
  const categories = spreadsheet
    .getRange(`config!B1:${columnToLetter(1 + genreCount)}1`)
    .getValues()[0];
  const emails = spreadsheet
    .getRange(`config!A2:A${1 + emailCount}`)
    .getValues();
  const selections = spreadsheet.getRange('config!B2:E2').getValues();

  for (const [i, email] of emails.entries()) {
    config[email[0]] = {
      [categories[0]]: selections[i][0],
      [categories[1]]: selections[i][1],
      [categories[2]]: selections[i][2],
      [categories[3]]: selections[i][3],
    };
  }

  return config;
}

function columnToLetter(column: number) {
  let temp,
    letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

const getDriveExportUrl = (emailTemplateId: string) =>
  `https://docs.google.com/feeds/download/documents/export/Export?id=${emailTemplateId}&exportFormat=html`;
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
const getDocsParams = (scriptOAuthToken: string) => {
  return {
    method: 'get',
    headers: {
      Authorization: `Bearer ${scriptOAuthToken}`,
    },
    muteHttpExceptions: true,
  };
};
const getPhotoUrl = (photoId: string) =>
  `https://photos.google.com/photo/${photoId}`;
