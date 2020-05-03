const fs = require('fs');
const { parsed: conf } = require('dotenv').config();
const axios = require('axios').default;
// const youtubedl = require('youtube-dl');
const memoize = require('./memoize');

const publishedAfter = (days) => {
  const now = new Date();
  now.setDate(now.getDate() - days);

  return now.toISOString();
}

const getParams = memoize((type) => {
  const params = Object.assign({}, r[type], { key: conf.API_KEY });
  return Object
    .entries(params)
    .map(([key, val]) => `${key}=${val}`)
    .join('&');
});

const r = {
  url: 'https://www.googleapis.com/youtube/v3',
  subscriptions: {
    part: 'snippet',
    maxResults: '3', // 0 to 50 max, 5 is default
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
    maxResults: '3', // 0 to 50 max, 5 is default
  }
}

const getRequest = (type, done, arr = [], customParams = '', limit = 0) => {
  const params = getParams(type);
  console.log( `${r.url}/${type}?${params}${customParams}` );
  axios.get(`${r.url}/${type}?${params}${customParams}`)
    .then(({ data }) => {
      arr.push(...data.items);

      if ( data.nextPageToken && limit < 1 ) {
        getRequest(type, done, arr, `&pageToken=${data.nextPageToken}`, limit + 1);
      } else {
        done(arr);
      }
    })
    .catch(function (error) {
      console.log('Error', error);
    })
}

// console.log( publishedAfter(30) );
// function requireLatestVideos(ids) {
// }

getRequest('subscriptions', (channels) => {
  channels
    .map(channel => ({title: channel.snippet.title, id: channel.snippet.resourceId.channelId}))
    .forEach((channel) => {
    console.log( channel );
    // getRequest('search', (videos) => {
    //   console.log( videos );
      // requireLatestVideos(arr)
    // }, [], `&channelId=${id}`);
  });
});

