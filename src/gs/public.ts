function run(event: GoogleAppsScript.Events.TimeDriven) {
  //https://developers.google.com/apps-script/guides/triggers/events
  _sendDanceDigests();
}
function runTestApiConfig() {
  _sendDanceDigests(testApiConfig);
}
function logYoutubeUploadsPlaylistId() {
  Logger.log(`youtube uploads playlist id: ${_getYoutubeUploadsPlaylistId()}`);
}
function logSharedAlbums() {
  _getSharedAlbums().forEach(album => {
    Logger.log(album);
  });
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
