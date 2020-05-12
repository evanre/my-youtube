const fs = require('fs');
const path = require('path');
const readline = require('readline');
const glob = require('glob');
const { spawn } = require('child_process');
const { parsed: conf } = require('dotenv').config({ path: __dirname + '/.env' });
const axios = require('axios').default;
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');

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
  globalLimit: 100,
  channelsFile: './channels.json',
  skipLengthCheck: false,
  subscriptions: {
    maxResults: '50', // 0 to 50 max, 5 is default
    channelId: conf.MY_CHANNEL_ID,
  },
  activities: {
    part: 'snippet',
    publishedAfter: publishedAfter(2),
    maxResults: '50', // 0 to 50 max, 5 is default
  }
}

const download = ({ id }) => new Promise((resolve, reject) => {
  const params = [
    `https://www.youtube.com/watch?v=${id}`,
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
  if (!subscriptions) {
      console.log( 'Get new list and store it' );
      subscriptions = await fetchChannels('snippet');
      fs.writeFileSync(r.channelsFile, JSON.stringify(subscriptions, null, 2));
  }

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

  // Get list of uploaded videos and filter already downloaded ones
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
      //.filter(f => !(glob.sync(`${conf.VIDEOS_PATH}/!*${f.id}.mp4`)).length)
    );

  console.log( activities );
  console.log( activities.length );
  console.log( (new Set (...activities.map(i => i.id))).size );

  // asyncForEach(videos, async (item, i, arr) => {
  //   console.log( '----------------------------------------------' );
  //   console.log( `Get videos from [${i + 1}/${arr.length}] "${item.title}", url: ${item.url}` );

    // ytpl(item.url, { limit: 5 }, function(err, playlist) {
    //   if(err) throw err;
    //   console.log( playlist );
    // });
    // await download(item)
  // })

  // const url = 'https://www.youtube.com/watch?v=48bK3mmjgRE';
  // const audioOutput = path.resolve(__dirname, 'sound.mp4');
  // const mainOutput = path.resolve(__dirname, 'output.mp4');
  //
  // const onProgress = (chunkLength, downloaded, total) => {
  //   const percent = downloaded / total;
  //   readline.cursorTo(process.stdout, 0);
  //   process.stdout.write(`${(percent * 100).toFixed(2)}% downloaded `);
  //   process.stdout.write(`(${(downloaded / 1024 / 1024).toFixed(2)}MB of ${(total / 1024 / 1024).toFixed(2)}MB)`);
  // };
  // console.log(audioOutput);

  const download2 = (id) => {
    const video = `${conf.VIDEOS_PATH}/video-${id}.mp4`;
    const audio = `${conf.VIDEOS_PATH}/audio-${id}.mp4`;

    console.log('downloading audio track');

    ytdl(id)
      .pipe(fs.createWriteStream('video.flv'));

    // ytdl(id, {
    //   filter: format => {
    //     console.log( format );
    //     return format.container === 'mp4' && !format.qualityLabel;
    //   },
    // })
    //   .on('error', console.error)
    //   .on('info', (info, format) => {
    //   })
    //   .on('progress', onProgress)
    //   // Write audio to file since ffmpeg supports only one input stream.
    //   .pipe(fs.createWriteStream(audioOutput))
    //   .on('finish', () => {
    //     console.log('\ndownloading video');
    //     const video = ytdl(id, {
    //       filter: format => format.container === 'mp4' && !format.audioEncoding,
    //     });
    //     video.on('progress', onProgress);
    //     ffmpeg()
    //       .input(video)
    //       .videoCodec('copy')
    //       .input(audioOutput)
    //       .audioCodec('copy')
    //       .save(mainOutput)
    //       .on('error', console.error)
    //       .on('end', () => {
    //         fs.unlink(audioOutput, err => {
    //           if (err) console.error(err);
    //           else console.log(`\nfinished downloading, saved to ${mainOutput}`);
    //         });
    //       });
    //   });
  }

  // download(videos[0])
}

go();
