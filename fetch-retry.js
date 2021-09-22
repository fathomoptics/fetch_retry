/* jshint esversion: 6 */

// adapted from https://github.com/jonbern/fetch-retry/blob/master/index.js
// 10/3/2018

if(typeof module === 'object') {
  module.exports = fetch_retry;
  var fetch = require('node-fetch');
  fetch_retry.Headers = fetch.Headers;
  fetch_retry.Request = fetch.Request;
  fetch_retry.Response = fetch.Response;
}

function fetch_retry(url, options) {
  var retries = 3;
  var retryDelay = 1000;
  var retryOn = [503];
  var waitAlpha = 0.98;
  var randomWaitPct = 0.05;
  var maxWaitInterval = 15000;
  var quiet = true;

  var waitInterval = retryDelay;

  if (typeof options === 'object') {
    if (typeof options.retries === 'number') {
      retries = options.retries;
    }

    if (typeof options.retryDelay === 'number') {
      retryDelay = options.retryDelay;
    }

    if (Array.isArray(options.retryOn)) {
      retryOn = options.retryOn;
    } else if(typeof options.retryOn !== 'undefined') {
      throw new Error('fetch_retry: retryOn property expects an array');
    }

    if(options.loud === true) quiet = false;

    if(typeof options.onRetry !== 'function') {
      options.onRetry = () => {};
    }
  }

  if(url instanceof URL) {
    url = url.href;
  }

  return new Promise((resolve, reject) => {
    var wrappedFetch = n => fetch(url, options)
      .then(response => {
        // retry if not out of retries, or status in retry list
        if (response.status !== 200 && (retryOn.indexOf(response.status) !== -1 || n != 0)) return retry(n);
        waitInterval = retryDelay;
        return resolve(response);
      })
      .catch(error => {
        if (n != 0) return retry(n);
        return reject(error);
      });

    function retry(n) {
      var delay = waitInterval + randomWaitPct * Math.random() * waitInterval;
      waitInterval = (1 - waitAlpha) * maxWaitInterval + waitAlpha * waitInterval;
      if(!quiet) console.log('fetch ', url, ' failed. Retrying in ', delay, ' ms');
      var updates;
      try {
        updates = options.onRetry(url, n);
      } catch (e) {
        return reject(e);
      }
      if(typeof updates === 'object') {
        if(typeof updates.url === 'string') url = updates.url;
        if(typeof updates.ntries === 'number') n = updates.ntries;
      }
      setTimeout(() => {
          return wrappedFetch(n > 0 ? n - 1 : n);
        }, delay);
    }

    wrappedFetch(retries);
  });
}
