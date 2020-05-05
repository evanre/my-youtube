const fs = require('fs')
const { spawn } = require("child_process");
const { parsed: conf } = require('dotenv').config({ path: __dirname + '/.env' });
const axios = require('axios').default;
const ytpl = require('ytpl');

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

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
  globalLimit: 2,
  channelsFile: './channels.json',
  skipLengthCheck: true,
  subscriptions: {
    part: 'snippet',
    maxResults: '2', // 0 to 50 max, 5 is default
    channelId: conf.MY_CHANNEL_ID,
  },
  channels: {
    part: 'contentDetails',
    maxResults: '50', // 0 to 50 max, 5 is default
  },
  search: {
    part: 'id',
    order: 'date',
    publishedAfter: publishedAfter(7),
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
    `--output ${conf.VIDEOS_PATH}/%(upload_date)s--%(uploader)s--%(title)s--%(id)s.%(ext)s`, // be careful with spaces!
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

  const fetchChannels = async (type) => {
    console.log( `Fetch subscriptions for part: ${type}` );
    return await getRequest('subscriptions', { part: type })
      .then((channels) => {
        return type !== 'snippet' ? channels : channels.map(channel => ({
          title: channel.snippet.title,
          id: channel.snippet.resourceId.channelId,
          url: `https://youtube.com/channel/${channel.snippet.resourceId.channelId}/videos`,
        }));
      });
  };

  // Get subscribed channels
  const checkFile = async () => {
    // Exit if file doesn't exist
    if (!fs.existsSync(r.channelsFile)) return false;

    let stored = await fs.readFileSync(r.channelsFile, { encoding: 'utf-8' });

    try {
      stored = JSON.parse(stored);
    } catch (e) {
      // Exit if file can't be parsed
      return false;
    }

    // const fetched = await fetchChannels('id');

    // Exit if amount of subscription channels changed
    if (!r.skipLengthCheck && stored.length !== (await fetchChannels('id')).length) return false;

    return stored;
  }

  // Check file, fetch new list and update file if something wrong
  let subscriptions = await checkFile();
  if (!subscriptions) {
      console.log( 'Get new list and store it' );
      subscriptions = await fetchChannels('snippet');
      fs.writeFileSync(r.channelsFile, JSON.stringify(subscriptions, null, 2));
  }

  console.log( subscriptions );

  // console.log( `Got ${subscriptions.length} channels user subscribed on` );

  // asyncForEach(subscriptions, async (item, i, arr) => {
  //   console.log( '----------------------------------------------' );
  //   console.log( `Get videos from [${i + 1}/${arr.length}] "${item.title}", url: ${item.url}` );
  //
  //   ytpl(item.url, { limit: 5 }, function(err, playlist) {
  //     if(err) throw err;
  //     console.log( playlist );
  //   });
  //   // await download(item)
  // })

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

  // Get uploaded videos
  // asyncForEach(subscriptions, async (item, i, arr) => {
    // console.log( '----------------------------------------------' );
    // console.log( item );
    // const results = await getRequest('search', { channelId: item.id });
    // console.log( results );
    // console.log( `Get videos from [${i + 1}/${arr.length}] "${item.title}", url: ${item.url}` );

    // ytpl(item.url, { limit: 5 }, function(err, playlist) {
    //   if(err) throw err;
    //   console.log( playlist );
    // });
    // await download(item)
  // })
  
  
  // https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=UCJHTQG_K8l2A2ZE4ohxcLyQ&order=date&publishedAfter=2020-05-02T10%3A42%3A55.470Z&key=[YOUR_API_KEY]


  //let subscriptions = await getRequest('subscriptions');
  //subscriptions = subscriptions.map(channel => ({
  //  title: channel.snippet.title,
  //  id: channel.snippet.resourceId.channelId,
  //  url: `https://youtube.com/channel/${channel.snippet.resourceId.channelId}/videos`,
  //}));
}

go();
