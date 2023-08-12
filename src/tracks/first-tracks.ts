import * as fs from 'fs';

const firsTracks: ITrack[] = [
  {
    name: 'Practice Bachata',
    select: {
      youtube: {
        playlistItems: {
          list: {
            part: 'snippet',
            optionalArgs: {
              playlistId: 'UUN2l886RuTZAHGkhpngCWuw',
              maxResults: 25,
            },
          },
        },
        videos: {
          list: {
            part: 'snippet',
            optionalArgs: {
              id: 'CvE0nvyn57w,C6rmpz84aGA,CvzRvpctyaI,QOUadS1FYNc,wlSF0ztk47k,c3QiY_bxU2s,JZw-yYc1bJw,Kl28yQGm1DM,WmtgwdAhEgw,T50f1JcKyvQ,KdwJt3a4Khg,xULxFEtKis8,htdxKWuL4QM,K9fmAh2rTqE,KSd2w72t3xA,7-NSbgdhJ6Q,wzPKWV9LU_Q,zGk9PVQXXo0,GVHiK8ANgkk,updgP09qDHQ,jMFybB_fKks,3yPn9yhTYJU,d9kPiLKb35k,1N4-Nw2k3Hc,NSkWrxFdRCo,ekzGjMZSj5A,UkPukO3M8eQ,yIrQEtMXqNA,p-JlxxcvFng',
            },
          },
        },
      },
      googlePhotos: {
        mediaItems: {
          search: {
            pageSize: 100,
            filters: {mediaTypeFilter: {mediaTypes: ['VIDEO']}},
            pageToken:
              'ClEKRHR5cGUuZ29vZ2xlYXBpcy5jb20vZ29vZ2xlLnBob3Rvcy5saWJyYXJ5LnYxLlNlYXJjaE1lZGlhSXRlbXNSZXF1ZXN0EgkQZCIFGgMKAQESjAFBSF91UTQySFNId1dISjY5MmExOTVacUo0U2tKck5DSU1hZ20ybjM3aFFhUjdLMjMxNWl1M3EtOGE3VVZxZVFsdHN1VjdKUzh5eU5XYXV5bmJ2TV9CMUVBTllCX0QyallOcTc3NkNKSDJsZWRPMnJXZUU1UG4wOHJhWGdVYS1xX3Fjb0dfbnFzSE05bRobdjBib1JTZVBScU1VaENjZ3hMcmNSSHdqdWpr',
          },
        },
      },
    },
    filter: {tagExpression: 'bachata*Brumi*Ancsi'},
    sort: {by: 'random' as SortBy},
    limit: {count: 3},
    // progress: {current: 0},
    schedule: {cron: '0 16 * * *', timezone: 'Europe/Budapest'},
  },
  {
    name: 'Practice Kizomba',
    select: {
      youtube: {
        playlistItems: {
          list: {
            part: 'snippet',
            optionalArgs: {
              playlistId: 'UUN2l886RuTZAHGkhpngCWuw',
              maxResults: 25,
            },
          },
        },
        videos: {
          list: {
            part: 'snippet',
            optionalArgs: {
              id: 'CvE0nvyn57w,C6rmpz84aGA,CvzRvpctyaI,QOUadS1FYNc,wlSF0ztk47k,c3QiY_bxU2s,JZw-yYc1bJw,Kl28yQGm1DM,WmtgwdAhEgw,T50f1JcKyvQ,KdwJt3a4Khg,xULxFEtKis8,htdxKWuL4QM,K9fmAh2rTqE,KSd2w72t3xA,7-NSbgdhJ6Q,wzPKWV9LU_Q,zGk9PVQXXo0,GVHiK8ANgkk,updgP09qDHQ,jMFybB_fKks,3yPn9yhTYJU,d9kPiLKb35k,1N4-Nw2k3Hc,NSkWrxFdRCo,ekzGjMZSj5A,UkPukO3M8eQ,yIrQEtMXqNA,p-JlxxcvFng',
            },
          },
        },
      },
      googlePhotos: {
        mediaItems: {
          search: {
            pageSize: 100,
            filters: {mediaTypeFilter: {mediaTypes: ['VIDEO']}},
            pageToken:
              'ClEKRHR5cGUuZ29vZ2xlYXBpcy5jb20vZ29vZ2xlLnBob3Rvcy5saWJyYXJ5LnYxLlNlYXJjaE1lZGlhSXRlbXNSZXF1ZXN0EgkQZCIFGgMKAQESjAFBSF91UTQySFNId1dISjY5MmExOTVacUo0U2tKck5DSU1hZ20ybjM3aFFhUjdLMjMxNWl1M3EtOGE3VVZxZVFsdHN1VjdKUzh5eU5XYXV5bmJ2TV9CMUVBTllCX0QyallOcTc3NkNKSDJsZWRPMnJXZUU1UG4wOHJhWGdVYS1xX3Fjb0dfbnFzSE05bRobdjBib1JTZVBScU1VaENjZ3hMcmNSSHdqdWpr',
          },
        },
      },
    },
    filter: {tagExpression: 'kizomba/Niki'},
    sort: {by: 'random' as SortBy},
    limit: {count: 3},
    // progress: {current: 0},
    schedule: {cron: '0 16 * * *', timezone: 'Europe/Budapest'},
  },
];

console.log('writing tracks to firs-tracks.json');
fs.writeFileSync('./firs-tracks.json', JSON.stringify(firsTracks));
