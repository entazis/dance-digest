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
  const results = getYoutubeUploads(['bachata']);
  results.forEach(result => {
    Logger.log(JSON.stringify(result));
  });
};

const getYoutubeVideoUrl = (videoId: string) => youtubeUrl + videoId;

function sendDanceDigestEmail() {
  try {
    const users = getUsers();
    Logger.log(JSON.stringify(users));

    for (const user of users) {
      sendEmail(
        {
          to: user.email,
          subject: 'Daily Dance Digest',
          templateName: 'template',
        },
        getVideos(user.tags, user.count)
      );
    }
  } catch (err: any) {
    Logger.log(
      `sendDanceDigestEmail() API failed with error ${err.toString()}`
    );
  }
}

function getVideos(tags: string[], count: number): IVideo[] {
  const selectedVideos: IVideo[] = [];
  const videos: IVideo[] = [
    ...getYoutubeUploads(tags),
    ...getGooglePhotosVideos(tags[0]),
  ];
  for (let i = 0; i < count; i++) {
    //TODO implement more robust selection
    selectedVideos.push(videos[getRandomInt(videos.length)]);
  }
  return selectedVideos;
}

function getYoutubeUploads(tags: string[]): IVideo[] {
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
        //TODO optimize to get all video details in one call
        const videoIds: string[] = getVideoIdsOfPlaylist(
          item.contentDetails.relatedPlaylists.uploads
        );
        for (const videoId of videoIds) {
          videos.push(getVideoDetails(videoId));
        }
      }
      //TODO create more robust filtering
      return videos.filter(video => video.tags.some(tag => tags.includes(tag)));
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
  videos: IVideo[]
): void {
  const template = HtmlService.createTemplateFromFile(
    emailPayload.templateName
  );
  template.videos = videos;
  GmailApp.sendEmail(emailPayload.to, emailPayload.subject, '', {
    htmlBody: template.evaluate().getContent(),
  });
}

function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function getUsers(): IUser[] {
  const spreadsheet = SpreadsheetApp.openById(configSpreadSheetId);
  const userValues = spreadsheet
    .getRange('users!A2:C')
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
