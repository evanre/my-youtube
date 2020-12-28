const { env } = process;
// const ytdl = require('ytdl-core');
// const ffmpeg = require('fluent-ffmpeg');

// const url = 'https://www.youtube.com/watch?v=48bK3mmjgRE';
// const audioOutput = path.resolve(__dirname, 'sound.mp4');
// const mainOutput = path.resolve(__dirname, 'output.mp4');

// const onProgress = (chunkLength, downloaded, total) => {
//   const percent = downloaded / total;
//   readline.cursorTo(process.stdout, 0);
//   process.stdout.write(`${(percent * 100).toFixed(2)}% downloaded `);
//   process.stdout.write(`(${(downloaded / 1024 / 1024).toFixed(2)}MB of ${(total / 1024 / 1024).toFixed(2)}MB)`);
// };
// console.log(audioOutput);

const download2 = (id) => {
  const video = `${env.VIDEOS_PATH}/video-${id}.mp4`;
  const audio = `${env.VIDEOS_PATH}/audio-${id}.mp4`;

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

const download = ({ id }) => new Promise((resolve, reject) => {
  const params = [
    `https://www.youtube.com/watch?v=${id}`,
    '--ignore-errors', // Continue on download errors, for example to skip unavailable videos in a playlist
    '--continue', // Force resume of partially downloaded files.
    // '--restrict-filenames', // splits cyrillic symbols
    `--output ${env.VIDEOS_PATH}/%(upload_date)s--%(uploader)s--%(title)s--%(id)s.%(ext)s`, // be careful with spaces!
    '--format best',
    // '--format bestvideo[height<=?1080]+bestaudio[ext=m4a]/best', // 1080p
    // Following options are not needed as we download them separately
    // '--dateafter now-1week', // Download only videos uploaded on or after this date (i.e. inclusive)
    // '--stopatfirst', // Stop downloading of further videos when the first video is not in daterange (custom feature, not implemented in official build)
  ].join(' ').split(' ');

  const ytdl = spawn('youtube-dl', params);

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

module.exports = download;
