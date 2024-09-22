const mediaItemsSearchUrl =
  'https://photoslibrary.googleapis.com/v1/mediaItems:search';
const createAlbumUrl = 'https://photoslibrary.googleapis.com/v1/albums';
const getShareAlbumUrl = (albumId: string) =>
  `https://photoslibrary.googleapis.com/v1/albums/${albumId}:share`;
const listSharedAlbumsUrl =
  'https://photoslibrary.googleapis.com/v1/sharedAlbums';
const getMediaItemsUpdateUrl = (videoId: string) =>
  `https://photoslibrary.googleapis.com/v1/mediaItems/${videoId}?updateMask=description`;

const logMediaItemsOfAlbumIdDefault =
  'AB0dA_0EYUlq89WTVimhuSPl-mwOiaP6DIloSoO-krlOcb-ZxsTRNJDLGjjM2CY2udbBfQwQWES_h7mg9zg32Y_3kfWc13oXOQ';
const logFieldsOfMediaItemsDefault: (keyof IMediaItem)[] = [
  'filename',
  'id',
  'productUrl',
  'description',
];

const googleTriggerCron = '* 16 * * *';
const idCellMaps: {[sheetName: string]: IdCellMap} = {};
const testApiConfig: IApiConfig = {
  user: {
    email: 'szabo.bence.tat@gmail.com',
    subject: 'Daily Dance Digest',
    template: 'default',
  },
  tracks: [
    {
      name: 'Practice Bachata',
      select: {
        youtube: {
          playlistId: 'UUN2l886RuTZAHGkhpngCWuw',
        },
        googlePhotos: {
          albumId: undefined,
        },
        vimeo: {
          videoId: undefined,
        },
      },
      filter: {
        tagExpression: 'bachata/beginner',
      },
      sort: {
        by: 'random',
      },
      limit: {
        count: 3,
        progress: {
          loop: true,
        },
      },
      schedule: {
        cron: '* 16 * * *',
        timezone: 'Europe/Budapest',
      },
    },
    {
      name: 'Practice Kizomba',
      select: {
        youtube: {
          playlistId: 'UUN2l886RuTZAHGkhpngCWuw',
          videoId: [
            'CvE0nvyn57w',
            'C6rmpz84aGA',
            'CvzRvpctyaI',
            'QOUadS1FYNc',
            'wlSF0ztk47k',
            'c3QiY_bxU2s',
            'JZw-yYc1bJw',
            'Kl28yQGm1DM',
            'WmtgwdAhEgw',
            'T50f1JcKyvQ',
            'KdwJt3a4Khg',
            'xULxFEtKis8',
            'htdxKWuL4QM',
            'K9fmAh2rTqE',
            'KSd2w72t3xA',
            '7-NSbgdhJ6Q',
            'wzPKWV9LU_Q',
            'zGk9PVQXXo0',
            'GVHiK8ANgkk',
            'updgP09qDHQ',
            'jMFybB_fKks',
            '3yPn9yhTYJU',
            'd9kPiLKb35k',
            '1N4-Nw2k3Hc',
            'NSkWrxFdRCo',
            'ekzGjMZSj5A',
            'UkPukO3M8eQ',
            'yIrQEtMXqNA',
            'p-JlxxcvFng',
          ],
        },
        googlePhotos: {
          albumId: undefined,
        },
        vimeo: {
          videoId: undefined,
        },
      },
      filter: {
        tagExpression: 'kizomba',
      },
      sort: {
        by: 'random',
      },
      limit: {
        count: 3,
      },
      schedule: {
        cron: '* 16 * * *',
        timezone: 'Europe/Budapest',
      },
    },
  ],
  providers: [
    {
      type: 'youtube',
      sheet: {
        id: '1190338372',
        name: 'youtubeUploads',
      },
      uploadsPlaylistId: 'UUN2l886RuTZAHGkhpngCWuw',
    } as IYoutubeProviderConfig,
    {
      type: 'googlePhotos',
      sheet: {
        id: '1878936212',
        name: 'googlePhotos',
      },
    },
    {
      type: 'vimeo',
      sheet: {
        id: '771704511',
        name: 'vimeo',
      },
    },
    {
      type: 'custom',
      sheet: {
        id: '87232840',
        name: 'custom',
      },
    },
  ],
  progresses: [],
};
