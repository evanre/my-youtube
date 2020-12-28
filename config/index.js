const fs = require('fs');
const path = require('path');
const readline = require('readline');
const glob = require('glob');
const { spawn } = require('child_process');
const { env } = process;
const axios = require('axios').default;
const download = require('./download');
const { asyncForEach } = require('./helpers');

const publishedAfter = (days) => {
  const now = new Date();
  now.setDate(now.getDate() - days);

  return now.toISOString();
}

const chunk = (arr, len) => {
  const chunks = [];
  let i = 0;

  while (i < arr.length) {
    chunks.push(arr.slice(i, i += len));
  }

  return chunks;
}

const r = {
  url: 'https://www.googleapis.com/youtube/v3',
  globalLimit: 100,
  channelsFile: `${__dirname}/channels.json`,
  skipLengthCheck: true,
  subscriptions: {
    maxResults: '50', // 0 to 50 max, 5 is default
    channelId: env.MY_CHANNEL_ID,
  },
  activities: {
    part: 'snippet',
    publishedAfter: publishedAfter(1),
    maxResults: '50', // 0 to 50 max, 5 is default
  }
}

const getRequest = async (type, customParams = {}) => {
  console.log('REQUESTING DATA!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!', type);
  const url = `${r.url}/${type}`;
  const items = [];

  let counter = 0;

  const params = {
    ...r[type],
    ...customParams,
    key: env.API_KEY,
  };

  do {
    await axios.get(url, { params })
      .then(({ data }) => {
        items.push(...data.items);

        counter++;
        params.pageToken = data.nextPageToken;
      })
      .catch(function (error) {
        console.log('Error', error);
      })
  } while (params.pageToken && counter < r.globalLimit);

  return items;
}

const getIfFromThumb = (url) => {
  return /vi\/(.+)\//g.exec(url)[1];
}

const fetchChannels = async (type) => {
  console.log( `Fetch subscriptions for part: ${type}` );
  return await getRequest('subscriptions', { part: type })
    .then(async (channels) => {
      return type !== 'snippet' ? channels : channels.map((channel, idx) => ({
        idx: idx + 1,
        title: channel.snippet.title,
        id: channel.snippet.resourceId.channelId,
        // url: `https://youtube.com/channel/${channel.snippet.resourceId.channelId}/videos`,
      }));
    });
};

const go = async () => {
  // Get subscribed channels
  const checkFile = async () => {
    // Exit if file doesn't exist
    if (!fs.existsSync(r.channelsFile)) return false;

    // Read the file
    let stored = await fs.readFileSync(r.channelsFile, { encoding: 'utf-8' });

    try {
      // Parse content to JSON
      stored = JSON.parse(stored);
    } catch (e) {
      // Exit if file can't be parsed
      return false;
    }

    // Exit if amount of subscribed channels changed
    if (!r.skipLengthCheck && stored.length !== (await fetchChannels('id')).length) return false;

    console.log( 'Got list from file' );
    return stored;
  }

  // Check file, fetch new list and update file if something is wrong
  let subscriptions = await checkFile();
  /*
  if (!subscriptions) {
      console.log( 'Get new list and store it' );
      subscriptions = await fetchChannels('snippet');
      fs.writeFileSync(r.channelsFile, JSON.stringify(subscriptions, null, 2));
  }
*/
  console.log( `Got ${subscriptions.length} channels user subscribed on` );

  // Get uploaded videos playlists
  // let playlists = await Promise.all(chunk(subscriptions, 50).map(async(chunk) => {
  //   const id = chunk.map(({ id }) => id).join(',');
  //   const results = await getRequest('channels', { id });
  //   return results.map((result) => result.contentDetails.relatedPlaylists.uploads);
  // }));
  // playlists = playlists
  //   .flat(2)
  //   .map((id) => ({ id, link: `https://youtube.com/playlist?list=${id}` }))
  // ;

  // Get list of uploaded videos // commented and filter already downloaded ones
  const activities = await Promise.all(subscriptions.map(async(subscription, idx) => {
    return getRequest('activities', { channelId: subscription.id })
  }))
    .then((arr) => arr
      .reduce((acc, els) => {
        if (els.length) {
          const filteredItems = els
            .filter(({ snippet }) => snippet.type === 'upload')
            .map(({ snippet }) => ({
              id: getIfFromThumb(snippet.thumbnails.default.url),
              title: snippet.title,
              channelId: snippet.channelId,
              channelTitle: snippet.channelTitle,
            }));
          acc.push(...filteredItems);
        }
        return acc;
      }, [])
      // Filter if already downloaded
      //.filter(f => !(glob.sync(`${env.VIDEOS_PATH}/!*${f.id}.mp4`)).length)
    );

  console.log( activities );
  console.log( activities.length );
  console.log( (new Set (...activities.map(i => i.id))).size );

  videos = [
    {
      id: 'k7Gn4ZCmAd8',
      title: 'Я ЗАБРАЛ ВСЕ ВИДЕОКАРТЫ',
      channelId: 'UC6bTF68IAV1okfRfwXIP1Cg',
      channelTitle: 'itpedia'
    },
    {
      id: 'PJSFi0MQe8E',
      title: 'Google, StackOverflow та їда за столом. ІТ-меми українською | #ITLIFE 003',
      channelId: 'UCexHkTLEPpB9QrAA9G3KGcg',
      channelTitle: 'Yuriy Detsyk'
    }
  ];

  asyncForEach(videos, async (item, i, arr) => {
    // console.log( '----------------------------------------------' );
    // console.log( `Get videos from [${i + 1}/${arr.length}] "${item.title}", url: ${item.url}` );

    /*ytpl(item.url, { limit: 5 }, function(err, playlist) {
      if(err) throw err;
      console.log( playlist );
    });*/
    // await download(item)
  })
  // download(videos[0])
}

go();
