#!/usr/bin/env nodejs
var request = require('request'),
    cheerio = require('cheerio'),
    fs = require('fs'),
    _ = require('lodash');
    

// Parse the page to extract source articles and remove duplicates

function getSources(html) {
  // We use the jQuery-like cheerio module for this
  // Build a fake DOM and jQuery object
  var $ = cheerio.load(html);
  // Get all links in the CLAM schedule and Watchtower sections
  var links = [];
  $('div.docClass-CongregationMeetingSchedule a,' +
      'div.docClass-WatchtowerTOC.pub-w16 a')
      .not('ul.noMarker a')
  .each(function (i, el) {
    links.push([$(this).text(), $(this).attr('href')]);
  });
  links = _.uniqBy(links, function (x) { return x[1] });
  links = _.filter(links, function (x) { return x[0] != '' });
  links = _.filter(links, function (x) { return x[0][0] != '\n' });
  return links;
}

// Create absolute URL (add prefix if not absolute)

function absUrl(url) {
  if (url.indexOf('http://') != 0 && url.indexOf('https://') != 0) {
    url = 'http://wol.jw.org' + url;
  }
  return url;
}

// Get all media for the meeting

function getMedia(lang, month, day, callback) {
  request(absUrl('/' + lang + '/wol/dt/r1/lp-e/2016/' +
          month + '/' + day), function (err, resp, html) {
    if (err) {
      callback(err);
      return;
    }
    var sources = getSources(html);
    var media = [];
    (function getSourceMedia(sources) {
      var source = sources.shift();
      if (source != undefined) {
        request(absUrl(source[1]), function(err, resp, html) {
          if (err) {
            callback(err);
            return;
          }
          // We use the jQuery-like cheerio module for this
          // Build a fake DOM and jQuery object
          var $ = cheerio.load(html);
          // See if this is a video link page
          // Since we don't run the page Javascript, we need to use
          // the noscript method, which involves another download page
          // NOTE: This doesn't actually work right now, because for
          // for some reason the chain of forwarding fails for
          // request while it works in a browser
          var vlink = $('div.jsIncludeVideo noscript a').attr('href');
          // Is it a video link page?
          if (vlink) {
            // Load the video download page
            request(absUrl(vlink), function(err, resp, html) {
              if (err) {
                callback(err);
                return;
              }
              // Build a fake DOM and jQuery object
              $ = cheerio.load(html);
              // Get info for video
              media.push([source[0], source[1],
                    $('table td').has('a.aVideoURL').text().trim(),
                    $('a.lnkDnld:contains(720p)').attr('href')]);
              // Get the next source's media
              getSourceMedia(sources);
            });
          } else {
            // Get links to all figures
            $('figure img').each(function (i, el) {
              media.push([source[0], source[1], $(this).attr('alt'),
                            $(this).attr('src')]);
            });
            // Get the next source's media
            getSourceMedia(sources);
          }
        });
      } else {
        media = _.uniqBy(media, function (x) { return x[3] });
        media = _.filter(media, function (x) { return x[2] != '' });
        callback(undefined, media);
      }
    })(sources);
  });
}

// Get the current media and download them

var d = new Date();

getMedia('en', d.getMonth() + 1, d.getDate(), function (err, media) {
  if (err) {
    return;
  }
  for (var i = 0; i < media.length; i++) {
    request(absUrl(media[i][3])).pipe(fs.createWriteStream(
      _.padStart((i+1), 2, '0') + '. ' + media[i][0] + ' - ' +
      media[i][2] + '.jpg'));
  }
});

