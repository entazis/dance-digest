const categoryToAlbumIdMap = {
  bachata: 'AB0dA_1B4FrJJ5axjP2gIbiT7U_o71YH9uIL0H_6FSzEj5VLb5Pwnl007jFpKI7g9vyfVY7K0k5G',
  kizomba: 'AB0dA_243Vlkg8GXGdVJYxWurWdx8wJhbRiy71DEAmf0ZfDMrDvT6RrxYvWrdLKo6bPZzr8K9Po0',
  salsa: 'AB0dA_0FkOSUdjFy2OrLR80mMGAGA2qEV257dlTELzYJX7pt2FLMSmxbXcBNu4oFqO5PHiQ8AOUx',
  reggaeton: 'AB0dA_0Fh2-aYxcvsIuGQUWrIKsFNwOkAJWLTLZvf6ptQxeBaFvdc5fW3IGZVU-82yhAbuIrCj-B'
};
const configSpreadSheetId = '1xFqsQfTaTo0UzTXt2Qhl9V1m0Sta1fsxOCjAEr2BH3E';

function sendDanceDigestEmail() {
  try {
    const config = getConfig();

    for (const email in config) {
      const selected = config[email];
      const selectedTitleUrls = {};
      for (const category in selected) {
        selectedTitleUrls[category] = [];
        const titleUrls = getAndParseVideos(category);
        for (let i = 0; i < selected[category]; i++) {
          const selectedVideo = titleUrls[getRandomInt(titleUrls.length)];
          selectedTitleUrls[category].push({
            title: selectedVideo.title,
            url: selectedVideo.url,
          });
        }
      }
      sendEmail(
        {
          to: email,
          subject: 'Daily Dance Digest',
          templateName: 'template'
        }, 
        selectedTitleUrls
        );
    }
  } catch (err) {
    Logger.log(`sendDanceDigestEmail() API failed with error ${err.toString()}`);
  }
}

function sendEmail(emailPayload, categoryTitleUrls){
  const template = HtmlService.createTemplateFromFile(emailPayload.templateName);
  template.categoryTitleUrls = categoryTitleUrls
  GmailApp.sendEmail(
    emailPayload.to, 
    emailPayload.subject, 
    '', 
    {
      htmlBody: template.evaluate().getContent()
    }
  );
}

function getAndParseVideos(category) {
  const photosParams = getPhotosParams(ScriptApp.getOAuthToken(), categoryToAlbumIdMap[category]);
  let response = JSON.parse(UrlFetchApp.fetch(`${mediaItemsSearchUrl}`, photosParams).getContentText());
  let titleUrls = response.mediaItems.map(item => {return {title: item.filename, url: item.productUrl}});
  while (response.nextPageToken) {
    photosParams.payload.pageToken = response.nextPageToken;
    response = JSON.parse(UrlFetchApp.fetch(`${mediaItemsSearchUrl}`, photosParams).getContentText());
    titleUrls = titleUrls.concat(response.mediaItems.map(item => {return {title: item.filename, url: item.productUrl}}));
  }
  return titleUrls;
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function getConfig() {
  const spreadsheet = SpreadsheetApp.openById(configSpreadSheetId);
  const emailCount = spreadsheet.getRange('metadata!A2').getValue();
  const genreCount = spreadsheet.getRange('metadata!B2').getValue();

  const letter = columnToLetter(genreCount);

  const config = {};
  const categories = spreadsheet.getRange(`config!B1:${columnToLetter(1 + genreCount)}1`).getValues()[0];
  const emails = spreadsheet.getRange(`config!A2:A${1 + emailCount}`).getValues();
  const selections = spreadsheet.getRange('config!B2:E2').getValues();

  for (const [i, email] of emails.entries()) {
    config[email[0]] = {
      [categories[0]]: selections[i][0],
      [categories[1]]: selections[i][1],
      [categories[2]]: selections[i][2],
      [categories[3]]: selections[i][3],
    }
  }

  return config;
}

function columnToLetter(column)
{
  var temp, letter = '';
  while (column > 0)
  {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

const getDriveExportUrl = (emailTemplateId) => `https://docs.google.com/feeds/download/documents/export/Export?id=${emailTemplateId}&exportFormat=html`;
const mediaItemsSearchUrl = 'https://photoslibrary.googleapis.com/v1/mediaItems:search';
const getPhotosParams = (scriptOAuthToken, albumId) => {return {
  headers: {
    Authorization: `Bearer ${scriptOAuthToken}`
  },
  method: 'post',
  payload: {
    pageSize: '100',
    albumId: albumId
  }
}};
const getDocsParams = (scriptOAuthToken) => {return {
  method: 'get',
  headers: {
    Authorization: `Bearer ${scriptOAuthToken}`
  },
  muteHttpExceptions: true,
}};
const getPhotoUrl = (photoId) => `https://photos.google.com/photo/${photoId}`;