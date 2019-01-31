'use strict';

let AWS = require('aws-sdk');
let _ = require('underscore');
let _l = require('lodash');
let when = require('when');
let rest = require('restler');
let sm = require('sitemap');
let zlib = require('zlib');
let str = require('string-to-stream');
let builder = require('xmlbuilder');
let s3Stream;

module.exports.sitemap = async (event, context) => {
  // get the client
  const mysql = require('mysql2/promise');

  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'my_db',
  });

  const date = new Date();
  const sitemapIndex = 'sitemap.xml.gz';
  const sitemapGeneratedPrefix = 'sitemap_';
  let usernames = [];


  const upload = async function (content, filename) {
    return await when.promise(function (resolve, reject, notify) {
      // Upload sitemap to S3
      s3Stream = require('s3-upload-stream')(new AWS.S3());
      // Create the streams
      let read = str(content);
      let compress = zlib.createGzip();
      let upload = s3Stream.upload({
        'Bucket': event.sitemap_bucket,
        'Key': filename
      });

      // Optional configuration
      upload.maxPartSize(20971520); // 20 MB
      upload.concurrentParts(5);

      // Handle errors.
      upload.on('error', function (error) {
        console.log('error: ', error);
        reject(error);
      });

      upload.on('part', function (details) {
        // console.log(details);
      });

      upload.on('uploaded', function (details) {
        console.log('uploaded: ', details);
        resolve();
      });

      // Pipe the incoming stream through compression, and up to S3.
      read.pipe(compress).pipe(upload);
    });
  };

  try {
    const [rows] = await connection.execute('SELECT c.username FROM channel c WHERE c.suspended = 0 AND c.is_broadcaster = 1');

    _.each(rows, function (username) {
      usernames.push(username.username);
    });
  } catch (err) {
    connection.destroy();
    throw new Error(err);
  }


  let chunks = _l.chunk(usernames, 10000);

  await when.iterate(function (index) {
        return index + 1;
      },
      function (index) {
        return index > (chunks.length - 1);
      },
      async function (index) {
        let chunk = chunks[index];
        let urls = [];

        _.each(chunk, function (username) {
          urls.push({
            url: event.base_path + username,
            changefreq: 'daily',
            priority: 0.5,
            lastmod: date
          });
        });

        // Create the sitemap in memory
        let sitemap = sm.createSitemap({
          hostname: event.site_url,
          cacheTime: 600000,  //600 sec (10 min) cache purge period
          urls: urls
        });

        // Write the sitemap file
        await upload(sitemap.toString(), sitemapGeneratedPrefix + (index + 1) + '.xml.gz');
      },
      0);

  // Now create the Master sitemap index
  let root = builder.create('sitemapindex', {encoding: 'UTF-8'}).att('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9');


  // add in each sitemap
  _.each(chunks, function (chunk, index) {
    let sitemap = root.ele('sitemap');
    sitemap.ele('loc', event.site_url + '/' + sitemapGeneratedPrefix + (index + 1) + '.xml.gz');
    sitemap.ele('lastmod', new Date().toISOString());
  });

  let xmlString = root.end({
    pretty: true,
    indent: '  ',
    newline: '\n',
    allowEmpty: false
  });

  // Upload Master index sitemap
  await upload(xmlString, sitemapIndex);

  // now ping Google to tell them the sitemap is updated;
  await when.promise(function (resolve, reject, notify) {
    rest.get('http://google.com/ping?sitemap=' + event.site_url + '/' + sitemapIndex)
        .on('success', function (data, response) {
          console.log('Google Ping: ' + data);
          resolve();
        })
        .on('fail', function (data, response) {
          console.log('Google Ping Error:', data);
          resolve();
        });
  });

  connection.end(function (err) {
    console.log('end connection: ', err);
  });
  context.succeed('Successfully created sitemap');
};
