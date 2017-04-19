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
  $('div[class*="pub-mwb"] div.itemData a,' +
      'div[class*="pub-w1"] div.itemData a').not('ul.noMarker a')
  .each(function (i, el) {
    links.push({
      name: $(this).text(),
      url: $(this).attr('href')
    });
  });
  // Filter out duplicates and things without a name
  links = _.uniqBy(links, function (x) { return x.url });
  links = _.filter(links, function (x) { return x.name != '' });
  links = _.filter(links, function (x) { return x.name[0] != '\n' });
  return links;
}

// Create absolute URL (add prefix if not absolute)

function absUrl(url) {
  if (url && url.indexOf('http://') != 0 && url.indexOf('https://') != 0) {
    url = 'http://wol.jw.org' + url;
  }
  return url;
}

// Get all media for the meeting

function getMedia(lang, year, month, day, callback) {
  // We need a language cookie for stuff loaded from jw.org
  var jar = request.jar();
  jar.setCookie(request.cookie('ckLang=E'), 'https://www.jw.org');
  var wolreq = request.defaults({ jar: jar });
  // Get the schedule
  wolreq(absUrl('/' + lang + '/wol/dt/r1/lp-e/' + year + '/' +
          month + '/' + day), function (err, resp, html) {
    // Quit on error
    if (err) {
      callback(err);
      return;
    }
    // Get the source article links
    var sources = getSources(html);
    // Recursively get the media links from the articles
    var media = [];
    (function getSourceMedia(sources) {
      // Get the next source
      var source = sources.shift();
      // Check if we got one or we're done
      if (source != undefined) {
        wolreq(absUrl(source.url), function(err, resp, html) {
          // Quit on error
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
          var vlink = $('div.jsIncludeVideo noscript a').attr('href');
          // Is it a video link page?
          if (vlink) {
            // Load the video download page
            wolreq(absUrl(vlink), function(err, resp, html) {
              // Quit on error
              if (err) {
                callback(err);
                return;
              }
              // Build a fake DOM and jQuery object
              $ = cheerio.load(html);
              // Get info for video
              media.push({
                source: source,
                name: $('table td').has('a.aVideoURL').text().trim(),
                url: $('a.linkDnld:contains(720p)').attr('href')
              });
              // Get the next source's media
              getSourceMedia(sources);
            });
          } else {
            // Get links to all figures
            $('figure img').each(function (i, el) {
              media.push({
                source: source,
                name: $(this).attr('alt'),
                url: $(this).attr('src')
              });
            });
            // Get the next source's media
            getSourceMedia(sources);
          }
        });
      } else {
        // Filter out duplicates and things without a URL or name
        media = _.uniqBy(media, function (x) { return x.url });
        media = _.filter(media, function (x) { return x.url });
        media = _.filter(media, function (x) { return x.name != '' });
        // Return the list of media
        callback(undefined, media);
      }
    })(sources);
  });
}

// Get the current media and download them

var d = new Date();

getMedia('en', d.getFullYear(), d.getMonth() + 1, d.getDate(), function (err, media) {
  if (err) {
    console.log(err);
    return;
  }
  for (var i = 0; i < media.length; i++) {
    var m = media[i];
    request(absUrl(m.url)).pipe(fs.createWriteStream(
      _.padStart((i+1), 2, '0') + '. ' + media[i].source.name + ' - ' +
      media[i].name));
  }
});

