const fs = require('fs');
const { parsed: conf } = require('dotenv').config();
const axios = require('axios').default;
const youtubedl = require('youtube-dl');

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
  subscriptions: {
    part: 'snippet',
    maxResults: '2', // 0 to 50 max, 5 is default
    channelId: conf.MY_CHANNEL_ID,
  },
  search: {
    part: 'snippet',
    // part: 'id',
    // channelId: 'UCoy0duz0ZzVzL91-E75Mw7w',
    order: 'date',
    publishedAfter: publishedAfter(1),
    type: 'video',
  },
  channels: {
    part: 'contentDetails',
    maxResults: '50', // 0 to 50 max, 5 is default
  }
}

const go = async () => {
  const getRequest = async (type, customParams = {}) => {
    const url = `${r.url}/${type}`;
    const items = [];

    let pageToken = false;
    let limit = 0;

    const params = {
      ...r[type],
      ...customParams,
      key: conf.API_KEY,
    };

    do {
      await axios.get(url, { params })
        .then(({ data }) => {
          items.push(...data.items);

          limit++;
          params.pageToken = data.nextPageToken;
        })
        .catch(function (error) {
          console.log('Error', error);
        })
    } while (params.pageToken && limit < 3);

    return items;
  }

  let subs = await getRequest('subscriptions');
  subs = subs.map(channel => ({
    title: channel.snippet.title,
    id: channel.snippet.resourceId.channelId,
    link: `https://youtube.com/channel/${channel.snippet.resourceId.channelId}/videos`
  }));

  console.log( `Got ${subs.length} channels user subscribed on` );

  // Get uploaded videos playlists
  // let playlists = await Promise.all(chunk(subs, 50).map(async(chunk) => {
  //   const id = chunk.map(({ id }) => id).join(',');
  //   const results = await getRequest('channels', { id });
  //   return results.map((result) => result.contentDetails.relatedPlaylists.uploads);
  // }));
  // playlists = playlists
  //   .flat(2)
  //   .map((id) => ({ id, link: `https://youtube.com/playlist?list=${id}` }))
  // ;
}

go();
