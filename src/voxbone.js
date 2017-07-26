var JsSIP, voxbone = voxbone || {};

requirejs.config({
  paths: {
    callstats: [
      "//cdn.voxbone.com/lib/callstats-3.20.2.min",
      "//api.callstats.io/static/callstats-3.20.2.min"
    ],
    jssip: [
      "//cdnjs.cloudflare.com/ajax/libs/jssip/2.0.6/jssip.min",
      "//cdn.bootcss.com/jssip/2.0.6/jssip.min"
    ]
  }
});

requirejs([
  'jssip',
  'callstats'
], function(_JsSIP, callstats) {
  configJsSIP(_JsSIP);
  JsSIP = _JsSIP;

  voxbone.WebRTC.callStats = callstats;
});

// extend.js
// Written by Andrew Dupont, optimized by Addy Osmani
function extend(destination, source) {

  var toString = Object.prototype.toString,
    objTest = toString.call({});

  for (var property in source) {
    if (source[property] && objTest === toString.call(source[property])) {
      destination[property] = destination[property] || {};
      extend(destination[property], source[property]);
    } else {
      destination[property] = source[property];
    }
  }
  return destination;

}

/**
 * Handles ajax requests in order to avoid using jQuery
 */
extend(voxbone, {
  Request: {
    param: function(data) {
      var encodedString = '';
      for (var prop in data) {
        if (data.hasOwnProperty(prop)) {
          if (encodedString.length > 0) {
            encodedString += '&';
          }
          encodedString += prop + '=' + encodeURIComponent(data[prop]);
        }
      }
      return encodedString;
    },

    post: function(url, data, callback) {
      var request = new XMLHttpRequest();
      var postData = this.param(data);

      request.open('POST', url);
      request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
      request.onload = function() {
        if (typeof callback === 'function') {
          callback({
            status: request.status,
            message: request.responseText
          });
        }
      };

      request.send(postData);
    },

    jsonp: function(url, data) {
      var src = url + (url.indexOf('?') + 1 ? '&' : '?');
      var head = document.getElementsByTagName('head')[0];
      var newScript = document.createElement('script');

      src += this.param(data);
      newScript.type = 'text/javascript';
      newScript.src = src;

      if (this.currentScript) head.removeChild(currentScript);
      head.appendChild(newScript);
    }
  }
});

extend(voxbone, {
  Logger: {
    loginfo: function(log) {
      if (voxbone.WebRTC.configuration.log_level >= voxbone.Logger.log_level.INFO) {
        console.log(log);
      }
      voxbone.Logger.addLogToBuffer("INFO: " + log);
    },
    logerror: function(log) {
      if (voxbone.WebRTC.configuration.log_level >= voxbone.Logger.log_level.ERROR) {
        console.log(log);
      }
      voxbone.Logger.addLogToBuffer("ERROR: " + log);
    },
    addLogToBuffer: function(log) {
      voxbone.WebRTC.webrtcLogs = voxbone.WebRTC.webrtcLogs.concat("\r\n");
      voxbone.WebRTC.webrtcLogs = voxbone.WebRTC.webrtcLogs.concat(log);
    },
    log_level: { NONE: 0, ERROR: 1, INFO: 2 }
  }
});

/**
 * Pinger Logic & Best POP Selection for WebRTC
 */
extend(voxbone, {
  Pinger: {
    /**
     * Placeholder for ping result
     */
    pingResults: [],

    /**
     * Load an image and compute the time it took to load.
     * Loading time is then stored into pingResult for further processing.
     * Each pop will host a small http server to serve the image.
     *
     * If a ping fails, a value of -1 will be stored
     *
     * @param pop Name of the Pop to ping, mainly used as an identifier for storing ping result.
     * @param url URL of the Pop to ping
     */
    ping: function(pop, url) {
      var started = new Date().getTime();
      var _that = this;
      var callback = this.recordPingResult;

      this.img = new Image();
      _that.inUse = true;

      this.img.onload = function() {
        var elapsed = new Date().getTime() - started;
        callback(pop, elapsed);
        _that.inUse = false;
      };

      this.img.onerror = function(e) {
        _that.inUse = false;
        callback(pop, -1);
      };

      this.img.src = url + "?" + new Date().getTime();
      this.timer = setTimeout(function() {
        if (_that.inUse) {
          _that.inUse = false;
          callback(pop, -1);
        }
      }, 1500);
    },

    /**
     * Record the ping result for a given pop and store it into a placeholder
     * A duration of -1 will be used in the event a ping has timeout or URL doesn't resolve.
     *
     * @param pop Pop identifier
     * @param duration ping duration
     */
    recordPingResult: function(pop, duration) {
      //if(duration < 0 ) return;
      voxbone.Logger.loginfo("[ping] " + pop + " replied in " + duration);
      var entry = {
        name: pop,
        ping: duration
      };

      voxbone.Pinger.pingResults.push(entry);
    },

    /**
     * Extract which Pop is best from all the pinged Pop.
     * It iterate over all stored ping result and returns the best one excluding ping of -1.
     *
     * @returns Name of the Pop which has the best ping
     */
    getBestPop: function() {
      var bestPop;
      //If no proper ping server found, default to BE
      if (this.pingResults.length === 0) {
        bestPop = {
          name: 'BE',
          ping: -1
        };
        //Else find the fastest
      } else {
        for (var i = 0; i < this.pingResults.length; i++) {
          var result = this.pingResults[i];
          if ((bestPop === undefined) || (result.ping > 0 && ((bestPop.ping < 0) || (result.ping < bestPop.ping)))) {
            bestPop = result;
          }
        }
      }
      return bestPop;
    }
  }
});

/**
 *
 */
extend(voxbone, {

  WebRTC: {
    callStats: undefined,
    /**
     * id of the <audio/> html tag.
     * If an audio element with this id already exists in the page, the script will load it and attach audio stream to it.
     * If not found, the script will create the audio component and attach the audio stream to it.
     */
    audioComponentName: 'peer-audio',

    /**
     * id of the <video/> html tag.
     * If a video element with this id already exists in the page, the script will load it and attach video stream to it.
     * If not found, the script will create the video component and attach the stream to it.
     */
    videoComponentName: 'peer-video',

    /**
     * Indiciate if video should be used or not.
     * If video is set to true, then the user will be prompted for webcam access.
     *
     */
    allowVideo: false,

    /**
     * URL of voxbone ephemeral auth server
     */
    authServerURL: 'https://cdn.voxbone.com/authentication/createToken',

    /**
     * URL of voxbone ephemeral auth server for basic auth
     */
    basicAuthServerURL: 'https://cdn.voxbone.com/authentication/basicToken',

    /**
     * Blob containing the logs for a webrtc session
     */
    webrtcLogs: "",

    /**
     * The actual WebRTC session
     */
    rtcSession: {},
    /**
     * SIP call id for current session
     */
    callid: "",
    /**
     * SIP call id of previous session
     */
    previous_callid: "",
    /**
     * The web audiocontext
     */
    audioContext: undefined,

    /**
     * local media volume
     */
    localVolume: 0,

    /**
     * remote media volume
     */
    remoteVolume: 0,

    /**
     * The callback timer for local media volume
     */
    localVolumeTimer: undefined,

    /**
     * The callback timer for remote media volume
     */
    remoteVolumeTimer: undefined,

    /**
     * Timer used if customer wants to insert a add
     * some gap between the digits
     */
    dtmfTimer: undefined,

    /**
     * The script processor for local media volume
     */
    localAudioScriptProcessor: {},

    /**
     * The script processor for remote media volume
     */
    remoteAudioScriptProcessor: {},

    /**
     * Used to bypass ping mechanism and enforce the POP to be used
     * If set to 'undefined' ping will be triggered and best pop will be set as preferedPop
     */
    preferedPop: undefined,

    inboundCalling: false,

    register: false,

    username: null,

    password: null,

    onCall: null,

    /**
     * Configuration object use to hold authentication data as well as the list of Web Socket Servers.
     * This Configuration object is the native JsSip configuration object.
     */
    configuration: {
      'authorization_user': undefined,
      'password': undefined,
      'ws_servers': undefined,
      'stun_servers': undefined,
      'turn_servers': undefined,
      'log_level': voxbone.Logger.log_level.INFO,
      'post_logs': false,
      /**
      It controls if we want to push
      the logs for a web session where
      the user didn't make any call attempt
      **/
      'post_logs_nocall': false,
      'webrtc_log': undefined,
      'uri': 'sip:voxrtc@voxbone.com',
      'trace_sip': true,
      'register': false,
      /**
       * dialer_string
       * Digits to dial after call is established
       * dialer string is comma separated, to define a specfic pause between digits,
       * we add another entry like 1,700ms,2, this will add a 700ms of pause between
       * digits 1 & 2.
       * Example = '1,2,3,1200ms,4,5,900ms,6,#'
       */
      'dialer_string': undefined,
      'digit_duration': 100, // duration of a digit
      'digit_gap': 500 // pause between two digits
    },

    customEventHandler: {
      'progress': function(e) {},
      'accepted': function(e) {},
      'getUserMediaFailed': function(e) {
        voxbone.Logger.logerror("Failed to access mic/camera");
      },
      'localMediaVolume': function(e) {},
      'remoteMediaVolume': function (e) {},
      'failed': function(e) {},
      'ended': function(e) {},
      'authExpired': function(e) {},
      'readyToCall': function(e) {},
      'getUserMediaAccepted': function(e) {
        voxbone.Logger.loginfo("local media accepted");
      },
      'connected': function(e) {},
      'registered': function(e) {}
    },

    /**
     * Actual JsSIP User-Agent
     */
    phone: undefined,

    /**
     * Context is a variable which will hold anything you want to be transparently carried to the call
     */
    context: undefined,

    /**
     * Authenticate toward voxbone ephemeral server and get jsonp callback onto voxbone.WebRTC.processAuthData
     * in order to process authentication result data.
     *
     * @param credentials credentials to be used against ephemeral auth server
     */
    init: function(credentials, connectAndListen) {
      voxbone.Logger.loginfo('auth server: ' + this.authServerURL);

      var data = {
        'username': credentials.username,
        'key': credentials.key,
        'expires': credentials.expires,
        'timestamp': Date.now(),
        'jsonp': 'voxbone.WebRTC.processAuthData'
      };

      voxbone.Request.jsonp(this.authServerURL, data);
    },

    /**
     * Same as init, only difference is that it is used for basic authentication
     * @param username: webrtc username of the customer
     * @param key: webrtc key in plain text of the customer
     */
    basicAuthInit: function(username, key) {
      voxbone.Logger.loginfo('auth server: ' + this.basicAuthServerURL);

      var data = {
        'username': username,
        'key': key,
        'timestamp': Date.now(),
        'jsonp': 'voxbone.WebRTC.processAuthData'
      };

      var callback = function(data) {};
      voxbone.Request.jsonp(this.basicAuthServerURL, data);
    },

    /**
     * Process the Authentication data from Voxbone ephemeral auth server.
     * It retrieves the list of ping servers and invoke voxbone.Pinger.ping on each of them.
     * It also store the URI of websocket server and authorization data.
     *
     * @param data the Data from voxbone ephemeral server to process
     */
    processAuthData: function(data) {
      if (!(this.onCall instanceof Function)) {
        this.configuration.ws_servers = data.wss;
      } else if (!this.configuration.ws_servers) {
        this.configuration.ws_servers = ['wss://workshop-gateway.voxbone.com'];
      }

      this.configuration.stun_servers = data.stunServers;
      this.configuration.turn_servers = data.turnServers;
      this.configuration.webrtc_log = data.log;

      this.configuration.authorization_user = data.username;
      this.configuration.password = data.password;

      var timeout = this.getAuthExpiration();
      if (timeout > 0) {
        voxbone.Logger.loginfo("Credential expires in " + timeout + " seconds");
        // refresh at 75% of duration
        setTimeout(this.customEventHandler.authExpired, timeout * 750);
      }

      var callstats_credentials = data.callStatsCredentials;

      var csInitCallback = function(csError, csMsg) {
        voxbone.Logger.loginfo("callStats Status: errCode = " + csError + " Msg = " + csMsg);
      };
      var localUserId = ((data.username).split(":"))[1];
      voxbone.WebRTC.callStats.initialize(callstats_credentials.appId, callstats_credentials.appSecret, localUserId, csInitCallback, null, null);

      // This is an inbound call
      if (this.onCall instanceof Function && !this.phone) {
        this.inboundCalling = true;
        this.configuration.register = true;
        this.setupInboundCalling();
      } else {
        // This is an outbound call
        // If no prefered Pop is defined, ping and determine which one to prefer
        if (typeof this.preferedPop === 'undefined') {
          voxbone.Logger.loginfo("prefered pop undefined, pinging....");
          this.pingServers = data.pingServers;
          for (var i = 0; i < this.pingServers.length; i++) {
            voxbone.Pinger.ping(i, this.pingServers[i]);
          }
        } else {
          voxbone.Logger.loginfo("preferred pop already set to " + this.preferedPop);
        }
      }

      this.customEventHandler.readyToCall();
    },

    /**
     * Calculates the number of seconds until the current WebRTC token expires
     *
     * @returns time until expration in seconds
     */
    getAuthExpiration: function(data) {
      var now = Math.floor((new Date()).getTime() / 1000);
      var fields = this.configuration.authorization_user.split(/:/);
      return fields[0] - now;
    },

    /**
     * Check if the document contains an audio element with the provided id.
     * If no audio element exists, it creates it. prior to bind audio stream to it.
     *
     * @param id id of the audio element
     * @param audioStream audio stream from the WebSocket
     * @returns {HTMLElement}
     */
    initAudioElement: function(id, audioStream) {
      var audio = document.getElementById(id);
      //If Audio element doesn't exist, create it
      if (!audio) {
        audio = document.createElement('audio');
        audio.id = id;
        audio.hidden = false;
        audio.autoplay = true;
        document.body.appendChild(audio);
      }
      //Bind audio stream to audio element
      audio.src = (window.URL ? URL : webkitURL).createObjectURL(audioStream);
      return audio;
    },

    /**
     * Check if the document contains a video element  with the provided id.
     * If no video element exists, it created it prior to bind video stream to it
     *
     * @param id of the video element
     * @param videoStream video stream from the WebSocket
     * @returns {HTMLElement}
     */
    initVideoElement: function(id, videoStream) {
      var video = document.getElementById(id);
      if (!video) {
        video = document.createElement('video');
        video.id = id;
        video.hidden = false;
        video.autoplay = true;
        document.body.appendChild(video);
      }
      //Bind video stream to video element
      video.src = (window.URL ? URL : webkitURL).createObjectURL(videoStream);
      return video;
    },


    sendPreConfiguredDtmf: function(digitsPending) {
      var digit;
      var pause = 0;
      var digit_sent = false;

      if (voxbone.WebRTC.dtmfTimer !== undefined) {
        clearTimeout(voxbone.WebRTC.dtmfTimer);
        voxbone.WebRTC.dtmfTime = undefined;
      }
      if (digitsPending.length > 0) {
        if (digitsPending[0].indexOf('ms') != -1) {
          /*Calculate the pause in this case*/
          pause = parseInt(digitsPending[0].substring(0, digitsPending[0].indexOf('ms')));
        } else {
          /*We found a digit*/
          digit = digitsPending[0];
        }
        digitsPending = digitsPending.slice(1, digitsPending.length);
        if (String(' ABCD0123456789#*').indexOf(digit) > 0) {
          var d = Date.now();
          voxbone.WebRTC.rtcSession.sendDTMF(digit);
          digit_sent = true;
        }
        if (digitsPending.length > 0) {
          var nextDigitGap = pause > 0 ? (pause - voxbone.WebRTC.configuration.digit_gap) : (voxbone.WebRTC.configuration.digit_gap + voxbone.WebRTC.configuration.digit_duration);
          if (nextDigitGap < 0) {
            /*We can't have a negative pause between digits*/
            nextDigitGap = 0;
          }
          voxbone.WebRTC.dtmfTimer = setTimeout(function() {
            voxbone.WebRTC.sendPreConfiguredDtmf(digitsPending);
          }, nextDigitGap);
        }

      }
    },

    postCallRating: function(e164, rating, comment, url) {
      if (voxbone.WebRTC.previous_callid !== undefined) {
        var data = {
          'payload_type': "webrtc_call_rating",
          'username': voxbone.WebRTC.configuration.authorization_user,
          'password': voxbone.WebRTC.configuration.password,
          'callid': voxbone.WebRTC.previous_callid,
          'e164': e164,
          'url': url,
          'rating': rating,
          'comment': comment
        };
        var postUrl = voxbone.WebRTC.configuration.webrtc_log;
        voxbone.Request.post(postUrl, data);

        /*
         *We are assuming that postCallRating is the
         *only function using previous_callid, so
         *we can nuke it here
         */
        voxbone.WebRTC.previous_callid = undefined;
      }
    },

    postLogsToServer: function() {
      if (voxbone.WebRTC.configuration.post_logs === true) {
        /* Push the webrtc logs to the logging server */
        if (voxbone.WebRTC.configuration.webrtc_log !== undefined) {

          var url = voxbone.WebRTC.configuration.webrtc_log;
          var data = {
            'payload_type': "webrtc_logs",
            'username': voxbone.WebRTC.configuration.authorization_user,
            'password': voxbone.WebRTC.configuration.password,
            'callid': voxbone.WebRTC.callid,
            'pop': voxbone.WebRTC.preferedPop,
            'context': voxbone.WebRTC.context,
            'uri': voxbone.WebRTC.configuration.uri,
            'logs': voxbone.WebRTC.webrtcLogs
          };
          voxbone.Request.post(url, data);
        }
      }
    },

    // Clean up the webrtc object, resets any ongoing timers and
    // other data specific to the current call
    cleanUp: function() {
      ['local', 'remote'].forEach(function(key) {
        if (voxbone.WebRTC[key + 'VolumeTimer'] !== undefined) {
          clearInterval(voxbone.WebRTC[key + 'VolumeTimer']);
          voxbone.WebRTC[key + 'VolumeTimer'] = undefined;
        }

        var audioScriptProcessorName = key + 'AudioScriptProcessor';

        if (voxbone.WebRTC[audioScriptProcessorName] !== undefined) {
          if (voxbone.WebRTC.audioContext !== undefined && voxbone.WebRTC.audioContext.destination !== undefined)
            voxbone.WebRTC[audioScriptProcessorName].disconnect(voxbone.WebRTC.audioContext.destination);

          voxbone.WebRTC[audioScriptProcessorName] = undefined;
        }
      });

      if (voxbone.WebRTC.dtmfTimer !== undefined) {
        clearTimeout(voxbone.WebRTC.dtmfTimer);
        voxbone.WebRTC.dtmfTimer = undefined;
      }

      voxbone.WebRTC.cleanAudioElement(voxbone.WebRTC.audioComponentName);
      voxbone.WebRTC.previous_callid = voxbone.WebRTC.callid;
      voxbone.WebRTC.callid = "";
      voxbone.WebRTC.webrtcLogs = "";
      voxbone.WebRTC.rtcSession = {};

      if (!voxbone.WebRTC.inboundCalling)
        delete voxbone.WebRTC.phone;
    },

    /**
     * Check if the document contains an audio element with the provided id.
     * If audio element exists, cleans the src attr and reload it to
     * avoid having the sound icon enabled in some browser
     *
     * @param id of the audio element
     * @returns {HTMLElement}
     */
    cleanAudioElement: function(id) {
      var audio = document.getElementById(id);
      // check if audio element really exists
      if (audio) {
        audio.removeAttribute('src');
        audio.load();
      }

      return audio;
    },

    monitorStreamVolume: function(type) {
      type = type || 'local';
      console.log('monitoring volume on ', type);

      var getStreamFunctionName = (type === 'local' ? 'getLocalStreams' : 'getRemoteStreams');
      var volumeLocationName = (type === 'local' ? 'localVolume' : 'remoteVolume');
      var volumeLocationTimerName = (type === 'local' ? 'localVolumeTimer' : 'remoteVolumeTimer');
      var customEventName = (type === 'local' ? 'localMediaVolume' : 'remoteMediaVolume');
      var audioScriptProcessorName = (type === 'local' ? 'localAudioScriptProcessor' : 'remoteAudioScriptProcessor');

      var streams = voxbone.WebRTC.rtcSession.connection[getStreamFunctionName]();
      voxbone.Logger.loginfo("streams " + streams.length);
      for (var i = 0; i < streams.length; i++) {
        if (streams[i].getAudioTracks().length > 0) {
          /*activate the local volume monitoring*/
          try {
            if (voxbone.WebRTC.audioContext === undefined)
              voxbone.WebRTC.audioContext = new AudioContext();
          } catch (e) {
            voxbone.Logger.logerror("Web Audio API not supported " + e);
          }

          voxbone.WebRTC[audioScriptProcessorName] = voxbone.WebRTC.audioContext.createScriptProcessor(0, 1, 1);
          var mic = voxbone.WebRTC.audioContext.createMediaStreamSource(streams[i]);
          mic.connect(voxbone.WebRTC[audioScriptProcessorName]);
          voxbone.WebRTC[audioScriptProcessorName].connect(voxbone.WebRTC.audioContext.destination);

          voxbone.WebRTC[audioScriptProcessorName].onaudioprocess = function(event) {
            var input = event.inputBuffer.getChannelData(0);
            var i;
            var sum = 0.0;
            for (i = 0; i < input.length; ++i) {
              sum += input[i] * input[i];
            }
            voxbone.WebRTC[volumeLocationName] = Math.sqrt(sum / input.length);
          };

          voxbone.WebRTC[volumeLocationTimerName] = setInterval(function() {
            var e = {};
            e[volumeLocationName] = voxbone.WebRTC[volumeLocationName].toFixed(2);
            voxbone.WebRTC.customEventHandler[customEventName](e);
          }, 200);

          break;
        }
      }
    },

    getOptions: function() {
      var options = {
        'eventHandlers': {
          //won't run for our inbound call'
          'peerconnection': function(e) {
          },
          'sending': function(e) {
            voxbone.WebRTC.callid = e.request.call_id;
            var pc = voxbone.WebRTC.rtcSession.connection.pc;
            var remoteUserId = voxbone.WebRTC.rtcSession.remote_identity.uri.user;
            voxbone.WebRTC.callStats.addNewFabric(pc, remoteUserId, voxbone.WebRTC.callStats.fabricUsage.audio, voxbone.WebRTC.callid, null);
          },
          'progress': function(e) {
            voxbone.WebRTC.customEventHandler.progress(e);
          },
          'failed': function(e) {
            var pcObject;
            var conferenceID = voxbone.WebRTC.callid;
            var callStats = voxbone.WebRTC.callStats;
            voxbone.Logger.logerror("Call (" + conferenceID + ") failed. Cause: " + e.cause);

            if (typeof voxbone.WebRTC.rtcSession.connection !== 'undefined' && voxbone.WebRTC.rtcSession.connection)
              pcObject = voxbone.WebRTC.rtcSession.connection.pc;

            switch (e.cause) {
              case JsSIP.C.causes.USER_DENIED_MEDIA_ACCESS:
                if (typeof pcObject === 'object')
                  callStats.reportError(pcObject, conferenceID, callStats.webRTCFunctions.getUserMedia);
                voxbone.WebRTC.customEventHandler.getUserMediaFailed(e);
                break;

              case JsSIP.C.causes.INCOMPATIBLE_SDP:
              case JsSIP.C.causes.MISSING_SDP:
                if (typeof pcObject === 'object')
                  callStats.reportError(pcObject, conferenceID, callStats.webRTCFunctions.createOffer);
                break;

              case JsSIP.C.causes.BYE:
              case JsSIP.C.causes.CANCELED:
              case JsSIP.C.causes.NO_ANSWER:
              case JsSIP.C.causes.EXPIRES:
              case JsSIP.C.causes.NO_ACK:
              case JsSIP.C.causes.BUSY:
              case JsSIP.C.causes.REJECTED:
              case JsSIP.C.causes.REDIRECTED:
              case JsSIP.C.causes.UNAVAILABLE:
              case JsSIP.C.causes.NOT_FOUND:
                if (typeof pcObject === 'object')
                  callStats.reportError(pcObject, conferenceID, callStats.webRTCFunctions.applicationError);
                break;

              // case JsSIP.C.causes.DIALOG_ERROR:
              // case JsSIP.C.causes.BAD_MEDIA_DESCRIPTION:
              // case JsSIP.C.causes.RTP_TIMEOUT:
              // case JsSIP.C.causes.SIP_FAILURE_CODE:
              // case JsSIP.C.causes.REQUEST_TIMEOUT:
              // case JsSIP.C.causes.CONNECTION_ERROR:
              // case JsSIP.C.causes.INTERNAL_ERROR:
              // case JsSIP.C.causes.ADDRESS_INCOMPLETE:
              // case JsSIP.C.causes.AUTHENTICATION_ERROR:
              default:
                if (typeof pcObject === 'object')
                  callStats.reportError(pcObject, conferenceID, callStats.webRTCFunctions.signalingError);
                break;
            }

            voxbone.WebRTC.postLogsToServer();
            voxbone.WebRTC.cleanUp();
            voxbone.WebRTC.customEventHandler.failed(e);
          },
          'accepted': function(e) {
            // if (!voxbone.WebRTC.inboundCalling)
            //   voxbone.WebRTC.rtcSession = e.sender;

            voxbone.WebRTC.customEventHandler.accepted(e);
          },
          'addstream': function(e) {
            voxbone.WebRTC.monitorStreamVolume('local');
            voxbone.WebRTC.monitorStreamVolume('remote');

            if (voxbone.WebRTC.allowVideo) {
              voxbone.WebRTC.initVideoElement(voxbone.WebRTC.videoComponentName, e.stream);
            } else {
              voxbone.WebRTC.initAudioElement(voxbone.WebRTC.audioComponentName, e.stream);
            }
          },
          'confirmed': function(e) {
            //Check if the customer has configured any dialer string, use that to bypass IVRs
            if (voxbone.WebRTC.configuration.dialer_string !== undefined && voxbone.WebRTC.configuration.dialer_string.length > 0) {
              var digitsPending = voxbone.WebRTC.configuration.dialer_string.split(',');
              voxbone.WebRTC.sendPreConfiguredDtmf(digitsPending);
            }
          },
          'ended': function(e) {
            voxbone.WebRTC.postLogsToServer();
            voxbone.WebRTC.cleanUp();
            voxbone.WebRTC.customEventHandler.ended(e);
          }
        },
        'extraHeaders': [],
        'pcConfig': { rtcpMuxPolicy: "negotiate" },
        'mediaConstraints': { 'audio': true, 'video': voxbone.WebRTC.allowVideo }
      };

      if (this.configuration.stun_servers !== undefined || this.configuration.turn_servers !== undefined) {
        var ice_servers = [];

        for (i = 0; i < this.configuration.stun_servers.length; i++) {
          ice_servers.push(this.configuration.stun_servers[i]);
        }

        for (i = 0; i < this.configuration.turn_servers.length; i++) {
          ice_servers.push(this.configuration.turn_servers[i]);
        }

        options.pcConfig.iceServers = ice_servers;

        /**
         * Stop the ice gathering process 10 seconds after we
         * we have atleast 1 relay candidate
         */
        options.pcConfig.gatheringTimeoutAfterRelay = 5000;
      }
      options.pcConfig.iceCandidatePoolSize = 10;

      return options;
    },

    /*
     *
     */

    setupInboundCalling: function() {

      var socket = new JsSIP.WebSocketInterface(this.configuration.ws_servers[0]);
      socket.via_transport = "tcp";

      //hack for now, dont want to delete ws_servers for this.configuration but want to not pass it in
      var config = {};
      var authHeaders = [];

      extend(config, this.configuration);
      delete config.ws_servers;

      config.sockets = [socket];

      voxbone.WebRTC.phone = new JsSIP.UA(config);

      if (authHeaders.length)
        voxbone.WebRTC.phone.registrator().setExtraHeaders(authHeaders);

      voxbone.WebRTC.phone.on('connected', function(e) {
        voxbone.WebRTC.customEventHandler.connected(e);
        voxbone.Logger.loginfo("connected to websocket");
      });

      voxbone.WebRTC.phone.on('registered', function(e) {
        voxbone.WebRTC.customEventHandler.registered(e);
      });

      voxbone.WebRTC.phone.on('newRTCSession', function(data) {
        //we have a new call so ask our onCall function if we want to accept it
        if (data.originator === 'remote') {

          voxbone.WebRTC.rtcSession = data.session;
          var options = voxbone.WebRTC.getOptions();

          Object.keys(options.eventHandlers).forEach(function(eventName) {
            data.session.on(eventName, options.eventHandlers[eventName]);
          });

          data.session.on('connecting', function(e) {
            voxbone.WebRTC.customEventHandler.getUserMediaAccepted(e);
          });

          var handleCall = function (continueCall) {
            if (continueCall) {
              data.session.answer({
                'extraHeaders': options.extraHeaders,
                'pcConfig': options.pcConfig,
                'mediaConstraints': options.mediaConstraints
              });
            } else {
              data.session.terminate();
            }
          };

          voxbone.WebRTC.onCall(data, handleCall);
        }
      });

      voxbone.WebRTC.phone.start();
    },

    /**
     * Place a call on a given phone number.
     * Prior to place the call, it will lookup for best possible POP to use
     * and set the X-Voxbone-Pop header accordingly
     *
     * @param destPhone phone number to dial in E164 format.
     */
    call: function(destPhone) {
      var uri = new JsSIP.URI('sip', destPhone, 'voxout.voxbone.com');

      if (this.preferedPop === undefined)
        this.preferedPop = voxbone.Pinger.getBestPop().name;

      voxbone.Logger.loginfo("prefered pop: " + this.preferedPop);

      var headers = [];
      headers.push('X-Voxbone-Pop: ' + this.preferedPop);

      if (this.context)
        headers.push('X-Voxbone-Context: ' + this.context);

      var options = voxbone.WebRTC.getOptions();
      options.extraHeaders = headers;

      if (this.phone === undefined) {
        this.phone = new JsSIP.UA(this.configuration);
        this.phone.once('connected', function() { voxbone.WebRTC.rtcSession = voxbone.WebRTC.phone.call(uri.toAor(), options); });
        this.phone.on('newRTCSession', function(data) {
          data.session.on('connecting', function(e) {
            voxbone.WebRTC.customEventHandler.getUserMediaAccepted(e);
          });

          data.session.on('reinvite', function(info) {
            request = info.request;

            var extraHeaders = ['Contact: ' + data.session.contact];
            handleSessionTimersInIncomingRequest.call(data.session, request, extraHeaders);

            request.reply(200, null, extraHeaders, null,
              function() {
                self.status = JsSIP.C.STATUS_WAITING_FOR_ACK;
                setInvite2xxTimer.call(data.session, request, null);
                setACKTimer.call(data.session);
              }
            );
          });
        });

        this.phone.start();

      } else {
        this.phone.configuration = this.configuration;
        this.rtcSession = this.phone.call(uri.toAor(), options);
      }
    },

    /**
     * Checks if user is in an established
     * call or if a call attempt is in progress,
     * returns true if any of the above conditions
     * is true otherwise returns false
     *
     * @returns {boolean}
     */
    isCallOpen: function() {
      if (typeof voxbone.WebRTC.rtcSession.isEstablished === "function" && typeof voxbone.WebRTC.rtcSession.isInProgress === "function") {
        if ((voxbone.WebRTC.rtcSession.isInProgress() === true) || (voxbone.WebRTC.rtcSession.isEstablished() === true)) {
          return true;
        }
      }
      return false;
    },

    sendDTMF: function(tone) {
      this.rtcSession.sendDTMF(tone);
    },

    /**
     * Terminate the WebRTC session
     */
    hangup: function() {
      if (this.rtcSession !== undefined) {
        this.rtcSession.terminate();
      }
    },

    /**
     * Indicates if the client microphone is muted or not
     */
    isMuted: false,

    /**
     * Indicates if the remote audio is muted or not
     */
    isRemoteMuted: false,

    /**
     * Mute source
     */
    mute: function(source) {
      var streams;

      if (!source || source !== 'remote') {
        streams = this.rtcSession.connection.getLocalStreams();
        this.isMuted = true;
        voxbone.WebRTC.callStats.sendFabricEvent(this.rtcSession.connection.pc, voxbone.WebRTC.callStats.fabricEvent.audioMute, voxbone.WebRTC.callid);
      } else {
        streams = this.rtcSession.connection.getRemoteStreams();
        this.isRemoteMuted = true;
      }

      for (var i = 0; i < streams.length; i++) {
        for (var j = 0; j < streams[i].getAudioTracks().length; j++) {
          streams[i].getAudioTracks()[j].enabled = false;
        }
      }

    },

    /**
     * unmute source
     */
    unmute: function(source) {
      var streams;

      if (!source || source !== 'remote') {
        streams = this.rtcSession.connection.getLocalStreams();
        this.isMuted = false;
        voxbone.WebRTC.callStats.sendFabricEvent(this.rtcSession.connection.pc, voxbone.WebRTC.callStats.fabricEvent.audioUnmute, voxbone.WebRTC.callid);
      } else {
        streams = this.rtcSession.connection.getRemoteStreams();
        this.isRemoteMuted = false;
      }

      for (var i = 0; i < streams.length; i++) {
        for (var j = 0; j < streams[i].getAudioTracks().length; j++) {
          streams[i].getAudioTracks()[j].enabled = true;
        }
      }

    },

    /**
     * voxbone handler for page unload
     * It will hangup any ongoing calls
     * and post the logs
     */
    unloadHandler: function() {
      if (voxbone.WebRTC.isCallOpen()) {
        voxbone.Logger.loginfo("Page unloading while a call was in progress, hanging up");
        voxbone.WebRTC.hangup();
        voxbone.WebRTC.postLogsToServer();
      } else if (voxbone.WebRTC.configuration.post_logs_nocall === true) {
        /*Don't care if any calls were made, we still want logs*/
        voxbone.WebRTC.postLogsToServer();
      }
    },

    /**
     * Checks if the client browser supports WebRTC or not.
     *
     * @returns {boolean}
     */
    isWebRTCSupported: function() {
      if (!window.navigator.webkitGetUserMedia && !window.navigator.mozGetUserMedia) {
        return false;
      } else {
        var is_firefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
        if (is_firefox) {
          var patt = new RegExp("firefox/([0-9])+");
          var patt2 = new RegExp("([0-9])+");
          var user_agent = patt.exec(navigator.userAgent.toLowerCase())[0];
          var version = patt2.exec(user_agent)[0];
          if (version < 23) {
            return false;
          }
        }

        return true;
      }
    }
  }
});
