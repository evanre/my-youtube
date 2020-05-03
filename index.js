const { spawn } = require("child_process");
const { parsed: conf } = require('dotenv').config();
const axios = require('axios').default;

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
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
  subscriptions: {
    part: 'snippet',
    maxResults: '50', // 0 to 50 max, 5 is default
    channelId: conf.MY_CHANNEL_ID,
  },
  channels: {
    part: 'contentDetails',
    maxResults: '50', // 0 to 50 max, 5 is default
  }
}

const download = ({ url }) => new Promise((resolve, reject) => {
  const params = [
    url,
    '--ignore-errors', // Continue on download errors, for example to skip unavailable videos in a playlist
    '--continue', // Force resume of partially downloaded files.
    '--stopatfirst', // Stop downloading of further videos when the first video is not in daterange (custom feature, not implemented in official build)
    '--dateafter now-1week', // Download only videos uploaded on or after this date (i.e. inclusive)
    // '--restrict-filenames', // splits cyrillic symbols
    '--output videos/%(upload_date)s--%(uploader)s--%(title)s--%(id)s.%(ext)s', // be careful with spaces!
    '--format best',
  ].join(' ').split(' ');

  const ytdl = spawn('./youtube-dl', params);

  ytdl.stdout.on("data", data => {
    process.stdout.write(data.toString())
  });

  ytdl.stderr.on("data", data => {
    console.log(`stderr: ${data}`);
    reject();
  });

  ytdl.on('error', (error) => {
    console.log(`error: ${error.message}`);
    reject();
  });

  ytdl.on("close", (code) => {
    console.log(`child process exited with code ${code}`);
    resolve();
  });
});

const go = async () => {
  const getRequest = async (type, customParams = {}) => {
    const url = `${r.url}/${type}`;
    const items = [];

    let counter = 0;

    const params = {
      ...r[type],
      ...customParams,
      key: conf.API_KEY,
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

  let subscriptions = await getRequest('subscriptions');
  subscriptions = subscriptions.map(channel => ({
    title: channel.snippet.title,
    id: channel.snippet.resourceId.channelId,
    url: `https://youtube.com/channel/${channel.snippet.resourceId.channelId}/videos`,
  }));

  console.log( `Got ${subscriptions.length} channels user subscribed on` );

  asyncForEach(subscriptions, async (item, i, arr) => {
    console.log( '----------------------------------------------' );
    console.log( `Get videos from [${i + 1}/${arr.length}] "${item.title}", url: ${item.url}` );
    await download(item)
  })

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
}

go();
