import YouTube = GoogleAppsScript.YouTube;

YouTube;

//TODO create "id details map" videoId: {custom: IVideoBase, cell: string}, apply for vimeo
type IdCellMap = {[videoId: string]: string};

interface IApiConfig {
  user: IUserConfig;
  tracks: ITrack[];
  providers?: Providers;
  progresses?: ITrackProgress[];
}

interface IUserConfig {
  email: string | string[];
  subject?: string;
  body?: string;
  template?: string;
}

interface ITrack {
  name: string;
  select: ITrackSelect;
  filter?: ITrackFilter;
  sort?: ITrackSort;
  limit?: ITrackLimit;
  schedule?: ITrackSchedule;
}
interface ITrackProgress {
  name: string;
  current: number;
  isStopped?: boolean;
}

interface ITrackSelect {
  youtube?: ISelectYoutube;
  googlePhotos?: SearchGooglePhotos;
  vimeo?: ISelectVimeo;
}
interface ISelectYoutube {
  playlistId?: string | string[];
  videoId?: string | string[];
}
interface ISelectVimeo {
  videoId?: string | string[];
}
interface ITrackFilter {
  tagExpression?: string;
  playlistIds?: string[];
  dateFilter?: {
    dates?: IDate[];
    ranges?: {
      startDate?: IDate;
      endDate?: IDate;
    }[];
  };
}
interface ITrackSort {
  by: 'none' | 'title' | 'createdAt' | 'random';
  order?: AscOrDesc;
}
enum AscOrDesc {
  Asc = 'asc',
  Desc = 'desc',
}
interface ITrackLimit {
  offset?: number;
  count?: number;
  progress?: {
    loop?: boolean;
  };
}
interface ITrackSchedule {
  cron: string;
  timezone?: string;
}

type Providers = (IProviderConfig | IYoutubeProviderConfig)[];
interface IProviderConfig {
  type: 'youtube' | 'googlePhotos' | 'vimeo' | 'custom';
  sheet: ISheetConfig;
}
enum ProviderType {
  Youtube = 'youtube',
  GooglePhotos = 'googlePhotos',
  Vimeo = 'vimeo',
  Custom = 'custom',
}
interface ISheetConfig {
  id: string;
  name: string;
}
interface IYoutubeProviderConfig extends IProviderConfig {
  type: ProviderType.Youtube;
  uploadsPlaylistId: string;
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
  playlistIds?: string[];
  createdAt?: string;
}

enum SortBy {
  None = 'none',
  Title = 'title',
  CreatedAt = 'createdAt',
  Random = 'random',
}

interface IParsedCron {
  minute?: number;
  hour?: number;
  dayOfMonth?: number;
  month?: number;
  dayOfWeek?: number;
}

// https://developers.google.com/youtube/v3/docs/playlistItems/list
interface IYoutubePlaylistItemsList {
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
interface IYoutubeVideosList {
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
  search: SearchGooglePhotos;
  //TODO implement list, get, batchGet apis (GET)
  list?: any;
  get?: any;
  batchGet?: any;
}

type SearchGooglePhotos = {
  // albumId can't set in conjunction with any filters.
  albumId?: string;
  pageSize?: number;
  pageToken?: string;
  // filters can't be set in conjunction with an albumId
  filters?: {
    dateFilter?: {
      dates?: IDate[];
      ranges?: {
        startDate?: IDate;
        endDate?: IDate;
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
  // orderBy field only works when a dateFilter is used
  // when orderBy field is not specified, results are displayed newest first, oldest last by their creationTime
  // providing MediaMetadata.creation_time displays search results in the opposite order, oldest first then newest last
  // to display results newest first then oldest last, include the desc argument as follows: MediaMetadata.creation_time desc
  orderBy?: string;
};

interface IDate {
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

interface ISharedAlbum {
  id: string;
  title: string;
  productUrl: string;
  isWriteable: boolean;
  shareInfo: {
    sharedAlbumOptions: {
      isCollaborative: boolean;
      isCommentable: boolean;
    };
    shareableUrl: string;
    shareToken: string;
    isJoined: boolean;
    isOwned: boolean;
    isJoinable: boolean;
  };
  mediaItemsCount: string;
  coverPhotoBaseUrl: string;
  coverPhotoMediaItemId: string;
}

interface ICreateNewAlbumRequest {
  album: {
    title: string;
  };
}

interface ICreateNewAlbumResult {
  productUrl: string;
  id: string;
  title: string;
  isWriteable: string;
}

interface IShareAlbumRequest {
  sharedAlbumOptions: {
    isCollaborative: string;
    isCommentable: string;
  };
}

interface IShareAlbumResponse {
  shareInfo: {
    sharedAlbumOptions: {
      isCollaborative: string;
      isCommentable: string;
    };
    shareableUrl: string;
    shareToken: string;
    isJoinable: string;
    isJoined: string;
    isOwned: string;
  };
}
