function Voxbone(config) {

  var io, frontend, adapter, voxbone = {};

  requirejs.config({
    paths: {
      io: "//cdnjs.cloudflare.com/ajax/libs/socket.io/2.0.3/socket.io",
      adapter: [
        "//cdnjs.cloudflare.com/ajax/libs/adapterjs/0.14.3/adapter.min",
        "//cdn.temasys.com.sg/adapterjs/0.14.3/adapter.min"
      ],
      callstats: [
        "//cdn.voxbone.com/lib/callstats-3.19.17.min",
        "//api.callstats.io/static/callstats-3.19.17.min"
      ]
    }
  });

  function configIO(io) {
    voxbone.noop = function () {};
    /**
     * Expose C object.
     */
    voxbone.C = C;
    var that = this;
    frontend = io.connect('https://janus.click2vox.io:9011/');

    frontend.on('connect', function () {
      voxbone.Logger.loginfo("Connected to Voxbone Janus Server");
      voxbone.WebRTC.customEventHandler.connected();
    });
    frontend.on('disconnect', function () {
      voxbone.Logger.loginfo("Lost connection to Voxbone Janus Server");
    });
    frontend.on('connect_error', function() {
      voxbone.Logger.logerror("Error connecting to Janus Server");
      voxbone.WebRTC.customEventHandler.failed({cause: 'Connection Error'});
    });
    // some overrides
    io.SESSION_EXPIRES = voxbone.C.SESSION_EXPIRES;

    io.VoxboneLogger = {
      loginfo: function () {
        var args = Array.prototype.slice.call(arguments);
        info.apply(console, args);
      },
      logerror: function () {
        var args = Array.prototype.slice.call(arguments);
        error.apply(console, args);
      },
      setError: function (fn) {
        error = fn;
      },
      setInfo: function (fn) {
        info = fn;
      }
    };

    io.VoxboneLogger.setInfo(function () {
      var args = Array.prototype.slice.call(arguments);
      if (voxbone.WebRTC.configuration.log_level >= voxbone.Logger.log_level.INFO) {
        console.log.apply(console, args);
      }
      if (args.length == 5) {
        voxbone.Logger.addLogToBuffer("INFO: " + args[0]);
        voxbone.Logger.addLogToBuffer("INFO: " + args[3]);
      } else {
        voxbone.Logger.addLogToBuffer("INFO: " + args[0]);
      }
    });

    io.VoxboneLogger.setError = function () {
      var args = Array.prototype.slice.call(arguments);
      if (voxbone.WebRTC.configuration.log_level >= voxbone.Logger.log_level.ERROR) {
        console.error.apply(console, args);
      }
      if (args.length == 5) {
        voxbone.Logger.addLogToBuffer("ERROR: " + args[0]);
        voxbone.Logger.addLogToBuffer("ERROR: " + args[3]);
      } else {
        voxbone.Logger.addLogToBuffer("ERROR: " + args[0]);
      }
    };

  }

  requirejs([
    'io',
    'adapter',
    'callstats'
  ], function (_io, _adapter, callstats) {
    configIO(_io);
    io = _io;
    adapter = _adapter;
    voxbone.WebRTC.callStats = callstats;
  });

  var that = this;
  var wrapper = null;
  // WebRTC stuff
  var myStream = null;
  var pc = null;
  var dtmfSender = null;
  var sdpSent = false;
  // default ice
  var iceServers = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};

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

  extend(voxbone, {
    Request: {
      param: function (data) {
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

      post: function (url, data, callback) {
        var request = new XMLHttpRequest();
        var postData = this.param(data);

        request.open('POST', url);
        request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
        request.onload = function () {
          if (typeof callback === 'function') {
            callback({
              status: request.status,
              message: request.responseText
            });
          }
        };
        voxbone.Logger.loginfo(postData);
        request.send(postData);
      },

      jsonp: function (url, data, callback) {
        var url_complete = url + (url.indexOf('?') + 1 ? '&' : '?');
        url_complete += this.param(data);
        var callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
        var script = document.createElement('script');
        script.src = url_complete + '&jsonp=' + callbackName;

        window[callbackName] = function (data) {
          delete window[callbackName];
          script.parentNode.removeChild(script);
          clearTimeout(request_timer);
          callback(data);
        };
        //There is no error handling for cross domain JSONP requests so we use a timer to wait for the response
        var request_timer = setTimeout(function(){
          callback({error: voxbone.C.AUTHENTICATION_ERROR});
        }, voxbone.WebRTC.authenticationTimeout);

        document.getElementsByTagName('head')[0].appendChild(script);
      }
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
      ping: function (pop, url) {
        var started = new Date().getTime();
        var _that = this;
        var callback = this.recordPingResult;

        this.img = new Image();
        _that.inUse = true;

        this.img.onload = function () {
          var elapsed = new Date().getTime() - started;
          callback(pop, elapsed);
          _that.inUse = false;
        };

        this.img.onerror = function (e) {
          _that.inUse = false;
          callback(pop, -1);
        };

        this.img.src = url + "?" + new Date().getTime();
        this.timer = setTimeout(function () {
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
      recordPingResult: function (pop, duration) {
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
      getBestPop: function () {
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

  extend(voxbone, {
    Logger: {
      loginfo: function (log) {
        if (voxbone.WebRTC.configuration.log_level >= voxbone.Logger.log_level.INFO) {
          console.log(log);
        }
        voxbone.Logger.addLogToBuffer("INFO: " + log);
      },
      logerror: function (log) {
        if (voxbone.WebRTC.configuration.log_level >= voxbone.Logger.log_level.ERROR) {
          console.log(log);
        }
        voxbone.Logger.addLogToBuffer("ERROR: " + log);
      },
      addLogToBuffer: function (log) {
        voxbone.WebRTC.webrtcLogs = voxbone.WebRTC.webrtcLogs.concat("\r\n");
        voxbone.WebRTC.webrtcLogs = voxbone.WebRTC.webrtcLogs.concat(log);
      },
      log_level: {NONE: 0, ERROR: 1, INFO: 2}
    }
  });

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
       * Authentication request timeout
       */
      authenticationTimeout: 3000,

      /**
       * Blob containing the logs for a webrtc session
       */
      webrtcLogs: "",

      /**
       * The actual WebRTC session
       */
      rtcSession: {
        connection: {localStreams: [], remoteStreams: []},
        status: ""
      },
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
       * This Configuration object is the native io configuration object.
       */
      configuration: {
        'connectionId': undefined,
        'username': this.username,
        'authuser': this.authuser,
        'secret': this.secret,
        'guestUser': false,
        'server': this.server,
        'uri': this.uri || 'sip:undefined@voxbone.com',
        'customer': this.customer || 'voxbone_webrtcventures',
        'ws_servers': undefined,
        'stun_servers': undefined,
        'turn_servers': undefined,
        'log_level': 2,
        'post_logs': false,
        /**
         It controls if we want to push
         the logs for a web session where
         the user didn't make any call attempt
         **/
        'post_logs_nocall': true,
        'webrtc_log': undefined,
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
        'digit_gap': 500, // pause between two digits
        'headers': {}
      },

      customEventHandler: {
        'progress': function (e) {},
        'accepted': function (e) {},
        'getUserMediaFailed': function (e) {
          voxbone.Logger.logerror("Failed to access mic/camera");
        },
        'localMediaVolume': function (e) {},
        'remoteMediaVolume': function (e) {},
        'failed': function (e) {
          voxbone.Logger.logerror(e);
        },
        'ended': function (e) {},
        'authExpired': function (e) {},
        'readyToCall': function (e) {},
        'getUserMediaAccepted': function (e) {
          voxbone.Logger.loginfo("local media accepted");
        },
        'connected': function (e) {},
        'registered': function (e) {}
      },

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
      init: function (credentials) {
        voxbone.Logger.loginfo('auth server: ' + this.authServerURL);
        voxbone.WebRTC.configuration.customer = credentials.username;
        var data = {
          'username': credentials.username,
          'key': credentials.key,
          'expires': credentials.expires,
          'timestamp': Date.now()
        };
        var that = this;
        voxbone.Request.jsonp(this.authServerURL, data, function(data) {
          voxbone.WebRTC.processAuthData(that, data);
        });
      },

      /**
       * Same as init, only difference is that it is used for basic authentication
       * @param username: webrtc username of the customer
       * @param key: webrtc key in plain text of the customer
       */
      basicAuthInit: function (username, key) {
        voxbone.Logger.loginfo('auth server: ' + this.basicAuthServerURL);
        voxbone.WebRTC.configuration.customer = username;
        var data = {
          'username': username,
          'key': key,
          'timestamp': Date.now()
        };
        var that = this;
        voxbone.Request.jsonp(this.basicAuthServerURL, data, function(data) {
          voxbone.WebRTC.processAuthData(that, data);
        });
      },

      processAuthData: function (that, data) {
        //approach left for the future implementation of connectionId based auth
        if (data.connectionId) {
          that.configuration.connectionId = data.connectionId;
          that.configuration.username = data.username;
        } else if (!data.error) {
          that.configuration.ws_servers = data.wss;
          that.configuration.stun_servers = data.stunServers;
          that.configuration.turn_servers = data.turnServers;
          that.configuration.webrtc_log = data.log;

          that.configuration.username = data.username;
          that.configuration.authuser = data.username;
          that.configuration.secret = data.password;
          // If no prefered Pop is defined, ping and determine which one to prefer
          if (typeof that.preferedPop === 'undefined') {
            voxbone.Logger.loginfo("prefered pop undefined, pinging....");
            this.pingServers = data.pingServers;
            for (var i = 0; i < Object.keys(this.pingServers).length; i++) {
              var pop_key = Object.keys(this.pingServers)[i];
              voxbone.Pinger.ping(pop_key, this.pingServers[pop_key]);
            }
          } else {
            voxbone.Logger.loginfo("preferred pop already set to " + that.preferedPop);
          }
          var timeout = that.getAuthExpiration();
          if (timeout > 0) {
            voxbone.Logger.loginfo("Credential expires in " + timeout + " seconds");
            // refresh at 75% of duration
            setTimeout(that.customEventHandler.authExpired, timeout * 750);
          }

          var callstats_credentials = data.callStatsCredentials;

          var csInitCallback = function (csError, csMsg) {
            voxbone.Logger.loginfo("callStats Status: errCode = " + csError + " Msg = " + csMsg);
          };
          var localUserId = ((data.username).split(":"))[1];
          voxbone.WebRTC.callStats.initialize(callstats_credentials.appId, callstats_credentials.appSecret, localUserId, csInitCallback, null, null);
        } else {
          this.customEventHandler.failed({cause: data.error});
        }
        if (voxbone.WebRTC.onCall instanceof Function && !voxbone.WebRTC.phone) {
          this.inboundCalling = true;
          this.configuration.register = true;
          this.setupInboundCalling(that.configuration, function (err) {
            if (err) {
              voxbone.Logger.logerror('Registration failed:');
              voxbone.Logger.logerror(err);
            }
          });
        }
        this.customEventHandler.readyToCall();
      },

      /**
       * Calculates the number of seconds until the current WebRTC token expires
       *
       * @returns time until expration in seconds
       */

      getAuthExpiration: function (data) {
        var now = Math.floor((new Date()).getTime() / 1000);
        var fields = this.configuration.username.split(/:/);
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
      initAudioElement: function (id, audioStream) {
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
      initVideoElement: function (id, videoStream) {
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

      sendPreConfiguredDtmf: function (digitsPending) {
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
          if (digit !== undefined) {
            var d = Date.now();
            voxbone.WebRTC.sendDTMF(digit);
            digit_sent = true;
          }
          if (digitsPending.length > 0) {
            var nextDigitGap = pause > 0 ? (pause - voxbone.WebRTC.configuration.digit_gap) : (voxbone.WebRTC.configuration.digit_gap + voxbone.WebRTC.configuration.digit_duration);
            if (nextDigitGap < 0) {
              /*We can't have a negative pause between digits*/
              nextDigitGap = 0;
            }
            voxbone.WebRTC.dtmfTimer = setTimeout(function () {
              voxbone.WebRTC.sendPreConfiguredDtmf(digitsPending);
            }, nextDigitGap);
          }
        }
      },

      postCallRating: function (e164, rating, comment, url, button_id) {
        if (voxbone.WebRTC.previous_callid !== undefined) {
          var data = {
            'payload_type': "webrtc_call_rating",
            'username': voxbone.WebRTC.configuration.authuser,
            'password': voxbone.WebRTC.configuration.password,
            'callid': voxbone.WebRTC.previous_callid,
            'e164': e164,
            'button_id': button_id,
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

      postLogsToServer: function () {
        if (voxbone.WebRTC.configuration.post_logs === true) {
          /* Push the webrtc logs to the logging server */
          if (voxbone.WebRTC.configuration.webrtc_log !== undefined) {

            var url = voxbone.WebRTC.configuration.webrtc_log;
            var data = {
              'payload_type': "webrtc_logs",
              'username': voxbone.WebRTC.configuration.authuser,
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
      cleanUp: function () {
        ['local', 'remote'].forEach(function (key) {
          if (voxbone.WebRTC[key + 'VolumeTimer'] !== undefined) {
            clearInterval(voxbone.WebRTC[key + 'VolumeTimer']);
            voxbone.WebRTC[key + 'VolumeTimer'] = undefined;
          }

          var audioScriptProcessorName = key + 'AudioScriptProcessor';

          if (voxbone.WebRTC[audioScriptProcessorName] !== undefined) {
            if (voxbone.WebRTC.audioContext !== undefined && voxbone.WebRTC.audioContext.destination !== undefined) {
              try {
                voxbone.WebRTC[audioScriptProcessorName].disconnect(voxbone.WebRTC.audioContext.destination);
              } catch (e) {
              }
            }

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
        voxbone.WebRTC.rtcSession.connection.localStreams = [];
        voxbone.WebRTC.rtcSession.connection.remoteStreams = [];
        myStream = null;
        dtmfSender = null;
        pc = null;
        sdpSent = false;
        voxbone.WebRTC.rtcSession.isInProgress = false;
        voxbone.WebRTC.rtcSession.isEstablished = false;

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
      cleanAudioElement: function (id) {
        var audio = document.getElementById(id);
        // check if audio element really exists
        if (audio) {
          audio.removeAttribute('src');
          audio.load();
        }

        return audio;
      },

      monitorStreamVolume: function (type) {
        type = type || 'local';
        voxbone.Logger.loginfo('monitoring volume on ' + type);

        var getStreamFunctionName = (type === 'local' ? voxbone.WebRTC.rtcSession.connection.localStreams : voxbone.WebRTC.rtcSession.connection.remoteStreams);
        var volumeLocationName = (type === 'local' ? 'localVolume' : 'remoteVolume');
        var volumeLocationTimerName = (type === 'local' ? 'localVolumeTimer' : 'remoteVolumeTimer');
        var customEventName = (type === 'local' ? 'localMediaVolume' : 'remoteMediaVolume');
        var audioScriptProcessorName = (type === 'local' ? 'localAudioScriptProcessor' : 'remoteAudioScriptProcessor');

        var streams = getStreamFunctionName;
        voxbone.Logger.loginfo(streams);
        voxbone.Logger.loginfo(type + " streams: " + streams.length);
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

            voxbone.WebRTC[audioScriptProcessorName].onaudioprocess = function (event) {
              var input = event.inputBuffer.getChannelData(0);
              var i;
              var sum = 0.0;
              for (i = 0; i < input.length; ++i) {
                sum += input[i] * input[i];
              }
              voxbone.WebRTC[volumeLocationName] = Math.sqrt(sum / input.length);
            };

            voxbone.WebRTC[volumeLocationTimerName] = setInterval(function () {
              var e = {};
              e[volumeLocationName] = voxbone.WebRTC[volumeLocationName].toFixed(2);
              voxbone.WebRTC.customEventHandler[customEventName](e);
            }, 200);

            break;
          }
        }
      },

      getOptions: function () {
        var options = {
          'eventHandlers': {
            //won't run for our inbound call'
            'peerconnection': function (e) {
            },
            'sending': function (e) {
              voxbone.callid = e.request.call_id;
              var pc = voxbone.WebRTC.rtcSession.connection.pc;
              var remoteUserId = voxbone.WebRTC.rtcSession.remote_identity.uri.user;
              voxbone.callStats.addNewFabric(pc, remoteUserId, voxbone.callStats.fabricUsage.audio, voxbone.callid, null);
            },
            'progress': function (e) {
              voxbone.WebRTC.customEventHandler.progress(e);
            },
            'failed': function (e) {
              var pcObject;
              var conferenceID = voxbone.WebRTC.callid;
              var callStats = voxbone.WebRTC.callStats;
              voxbone.Logger.logerror("Call (" + conferenceID + ") failed. Cause: " + e.cause);

              if (typeof voxbone.WebRTC.rtcSession.connection !== 'undefined' && voxbone.WebRTC.rtcSession.connection)
                pcObject = voxbone.WebRTC.rtcSession.connection.pc;

              switch (e.cause) {
                case 'User Denied Media Access':
                  if (typeof pcObject === 'object')
                    callStats.reportError(pcObject, conferenceID, callStats.webRTCFunctions.getUserMedia);
                  voxbone.WebRTC.customEventHandler.getUserMediaFailed(e);
                  break;

                case 'INCOMPATIBLE_SDP':
                case 'MISSING_SDP':
                  if (typeof pcObject === 'object')
                    callStats.reportError(pcObject, conferenceID, callStats.webRTCFunctions.createOffer);
                  break;

                case 'bye':
                case 'CANCELED':
                case 'NO_ANSWER':
                case 'EXPIRES':
                case 'NO_ACK':
                case 'BUSY':
                case 'REJECTED':
                case 'REDIRECTED':
                case 'UNAVAILABLE':
                case 'Error calling: 404 Not Found':
                  if (typeof pcObject === 'object')
                    callStats.reportError(pcObject, conferenceID, callStats.webRTCFunctions.applicationError);
                  e.cause = voxbone.C.causes.NOT_FOUND;
                  break;

                default:
                  if (typeof pcObject === 'object')
                    callStats.reportError(pcObject, conferenceID, callStats.webRTCFunctions.signalingError);
                  break;
              }
              voxbone.WebRTC.postLogsToServer();
              voxbone.WebRTC.cleanUp();
              voxbone.WebRTC.customEventHandler.failed(e);
            },
            'accepted': function (e) {
              // if (!voxbone.WebRTC.inboundCalling)
              //   voxbone.WebRTC.rtcSession = e.sender;
              voxbone.WebRTC.customEventHandler.accepted(e);
            },
            'addstream': function (e) {
              voxbone.WebRTC.monitorStreamVolume('local');
              voxbone.WebRTC.monitorStreamVolume('remote');

              if (voxbone.WebRTC.allowVideo) {
                voxbone.WebRTC.initVideoElement(voxbone.WebRTC.videoComponentName, e.stream);
              } else {
                voxbone.WebRTC.initAudioElement(voxbone.WebRTC.audioComponentName, e.stream);
              }
            },
            'confirmed': function (e) {
              //Check if the customer has configured any dialer string, use that to bypass IVRs
              if (voxbone.WebRTC.configuration.dialer_string !== undefined && voxbone.WebRTC.configuration.dialer_string.length > 0) {
                var digitsPending = voxbone.WebRTC.configuration.dialer_string.split(',');
                voxbone.WebRTC.sendPreConfiguredDtmf(digitsPending);
              }
            },
            'ended': function (e) {
              voxbone.WebRTC.postLogsToServer();
              voxbone.WebRTC.cleanUp();
              voxbone.WebRTC.customEventHandler.ended(e);
            }
          },
          'pcConfig': {rtcpMuxPolicy: "negotiate"},
          'mediaConstraints': {'audio': true, 'video': voxbone.WebRTC.allowVideo}
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
       * Enable inbound calling. Register SIP user and get ready for incoming calls
       */

      setupInboundCalling: function (details, callback) {
        // Registering an account
        callback = (typeof callback == "function") ? callback : voxbone.noop;
        console.log('inbound calling!');
        voxbone.Logger.loginfo(details);
        // We need a wrapper first
        if (wrapper) {
          wrapper.close();
        }
        getWrapper(function (err, res) {
          if (err) {
            callback(err);
            return;
          }
          voxbone.Logger.loginfo(res);
          var address = null;
          // We can connect to the wrapper either via HTTP or HTTPS
          if (window.location.protocol === 'https:') {
            address = res["usersApi"]["https"];
          } else {
            address = res["usersApi"]["http"];
          }
          voxbone.Logger.loginfo(address);
          createWrapper(address, function (err) {
            if (err) {
              unregisterWrapper();
              callback(err);
              return;
            }
            registerViaWrapper(details, function (err, res) {
              if (err)
                unregisterWrapper();
              callback(err, res);
              voxbone.WebRTC.rtcSession.isInProgress = true;
              that.on('consent', function (accept) {
                if (accept) {
                  voxbone.WebRTC.customEventHandler.getUserMediaAccepted();
                }
              });

              that.on('incomingcall', function (caller, allowvideo) {

                voxbone.WebRTC.onCall(caller, function (continueCall) {
                  if (continueCall) {
                    // Accept a call (will result in a 200 OK)
                    acceptCall(allowvideo, function (err) {
                      if (err) {
                        voxbone.Logger.logerror(err);
                        voxbone.WebRTC.cleanup();
                        return;
                      }
                    });
                  } else {
                    voxbone.WebRTC.hangup();
                  }

                });
              });

              that.on('stream', function (stream) {
                voxbone.WebRTC.rtcSession.connection.remoteStreams.push(stream);
                voxbone.WebRTC.monitorStreamVolume('remote');
                if (voxbone.WebRTC.allowVideo) {
                  voxbone.WebRTC.initVideoElement(voxbone.WebRTC.videoComponentName, stream);
                } else {
                  voxbone.WebRTC.initAudioElement(voxbone.WebRTC.audioComponentName, stream);
                }
              });
            });
          });
        });

      },

      /**
       * Place a call on a given phone number.
       * Prior to place the call, it will lookup for best possible POP to use
       * and set the X-Voxbone-Pop header accordingly
       *
       * @param destPhone phone number to dial in E164 format.
       */
      call: function (destPhone, allowVideo, callback) {

        console.log('start call to ' + destPhone);

        if (voxbone.preferedPop === undefined) {
          voxbone.preferedPop = voxbone.Pinger.getBestPop().name;
        }

        voxbone.Logger.loginfo("prefered pop: "+ voxbone.preferedPop);

        var headers = {};
        headers['X-Voxbone-Pop'] = voxbone.preferedPop;

        if (this.context)
          headers['X-Voxbone-Context'] = this.context;

        voxbone.WebRTC.configuration.headers = headers;
        // var element = {}, cart = [];
        // element.id = id;
        // element.quantity = quantity;
        // cart.push({element: element});
        //OLD WAY using io
        // (...)
        // if (this.phone === undefined) {
        // 	this.phone = new io.UA(this.configuration);
        // 	this.phone.once('connected', function() { voxbone.rtcSession = voxbone.phone.call(uri.toAor(), options); });
        // 	this.phone.on('newRTCSession', function(data) {
        // 		data.session.on('connecting', function(e) {
        // 			voxbone.customEventHandler.getUserMediaAccepted(e);
        // 		});
        //
        // 		data.session.on('reinvite', function(info) {
        // 			request = info.request;
        //
        // 			var extraHeaders = ['Contact: ' + data.session.contact];
        // 			handleSessionTimersInIncomingRequest.call(data.session, request, extraHeaders);
        //
        // 			request.reply(200, null, extraHeaders, null,
        // 				function() {
        // 					self.status = io.C.STATUS_WAITING_FOR_ACK;
        // 					setInvite2xxTimer.call(data.session, request, null);
        // 					setACKTimer.call(data.session);
        // 				}
        // 			);
        // 		});
        // 	});
        //
        // 	this.phone.start();
        //
        // } else {
        // 	this.phone.configuration = this.configuration;
        // 	this.rtcSession = this.phone.call(uri.toAor(), options);
        // }
        voxbone.WebRTC.configuration.guestUser = true;
        var callee = 'sip:' + destPhone + '@voxout.voxbone.com';
        var authuser = voxbone.WebRTC.configuration.authuser;
        var secret = voxbone.WebRTC.configuration.secret;
        this.phone = true;

        getWrapper(function (err, res) {
          if (err) {
            voxbone.Logger.logerror(err);
            return;
          }
          voxbone.Logger.loginfo(res);
          var address = null;
          // We can connect to the wrapper either via HTTP or HTTPS
          if (window.location.protocol === 'https:') {
            address = res["usersApi"]["https"];
          } else {
            address = res["usersApi"]["http"];
          }
          voxbone.Logger.loginfo(address);
          createWrapper(address, function (err) {
            registerViaWrapper(voxbone.WebRTC.configuration, function (err, res) {
              if (err)
                unregisterWrapper();
              // callback(err, res);
              voxbone.WebRTC.rtcSession.isInProgress = true;
              that.on('consent', function (accept) {
                if (accept) {
                  voxbone.WebRTC.customEventHandler.getUserMediaAccepted();
                } else {
                  voxbone.WebRTC.customEventHandler.failed({cause: voxbone.C.causes.USER_DENIED_MEDIA_ACCESS});
                }
              });
              //CALL
              // Start a call (will result in an INVITE)
              callback = (typeof callback == "function") ? callback : voxbone.noop;
              if (pc) {
                voxbone.Logger.loginfo("Already in a call");
                callback("Already in a call");
                return;
              }
              //var callee = voxbone.WebRTC.configuration.uri
              createPC(function (err) {
                if (err && !pc) {
                  callback("Error creating PeerConnection");
                  return;
                }
                var consentCB = (typeof that.callbacks["consent"] == "function") ? that.callbacks["consent"] : voxbone.noop;
                consentCB(true);
                navigator.mediaDevices.getUserMedia({audio: true, video: allowVideo})
                .then(function (stream) {
                  //consentCB(false);
                  myStream = stream;
                  voxbone.WebRTC.rtcSession.connection.localStreams.push(myStream);
                  voxbone.WebRTC.monitorStreamVolume('local');
                  pc.addStream(stream);
                  var previewCB = (typeof that.callbacks["preview"] == "function") ? that.callbacks["preview"] : voxbone.noop;
                  previewCB(stream);
                  // Create offer
                  var mediaConstraints = null;
                  if (adapter.browserDetails.browser == "firefox" || adapter.browserDetails.browser == "edge") {
                    mediaConstraints = {
                      'offerToReceiveAudio': true,
                      'offerToReceiveVideo': allowVideo
                    };
                  } else {
                    mediaConstraints = {
                      'mandatory': {
                        'OfferToReceiveAudio': true,
                        'OfferToReceiveVideo': allowVideo
                      }
                    };
                  }
                  voxbone.Logger.loginfo(mediaConstraints);
                  voxbone.WebRTC.rtcSession.isInProgress = true;
                  pc.createOffer(
                    function (offer) {
                      if (sdpSent === true) {
                        voxbone.Logger.loginfo("Offer already sent, not sending it again");
                        return;
                      }
                      sdpSent = true;
                      pc.setLocalDescription(offer);
                      var jsep = {
                        type: offer.type,
                        sdp: offer.sdp
                      };
                      // Send the open request
                      var msg = {
                        request: "invite",
                        id: randomString(16),
                        payload: {
                          callee: callee,
                          jsep: jsep,
                          // These two fields are only needed by guests
                          // in case they want to authenticate their INVITEs
                          authuser: authuser,
                          secret: secret
                        }
                      };
                      voxbone.WebRTC.rtcSession.status = voxbone.C.STATUS_WAITING_FOR_ACK;
                      sendMsgWrapper(msg, function response(result) {
                        voxbone.Logger.loginfo("Got answer to offer:", result);
                        if (result["response"] === "error") {
                          callback(result["payload"]["reason"]);
                          var options = voxbone.WebRTC.getOptions();
                          options.eventHandlers.failed({cause: result["payload"]["reason"]});
                          voxbone.WebRTC.hangup();
                          return;
                        }
                        var remoteJsep = result["payload"]["jsep"];
                        voxbone.Logger.loginfo(remoteJsep);
                        voxbone.WebRTC.rtcSession.status = voxbone.C.STATUS_ANSWERED;
                        pc.setRemoteDescription(
                          new RTCSessionDescription(remoteJsep),
                          function () {
                            voxbone.Logger.loginfo("Remote description accepted!");
                            var options = voxbone.WebRTC.getOptions();
                            options.eventHandlers.accepted();
                            voxbone.WebRTC.rtcSession.status = voxbone.C.STATUS_CONFIRMED;
                            callback();
                          }, function (error) {
                            voxbone.WebRTC.hangup();
                            var options = voxbone.WebRTC.getOptions();
                            options.eventHandlers.failed({cause: error});
                            callback(error);
                          });
                      });
                    }, function (error) {
                      voxbone.WebRTC.hangup();
                      var options = voxbone.WebRTC.getOptions();
                      options.eventHandlers.failed({cause: error});
                      callback(error);
                    }, mediaConstraints);
                })
                .catch(function (error) {
                  consentCB(false);
                  var options = voxbone.WebRTC.getOptions();
                  options.eventHandlers.failed({cause: error});
                  callback(error);
                });
              });
            });
          });
        });

        that.on('stream', function (stream) {
          voxbone.WebRTC.rtcSession.connection.remoteStreams.push(stream);
          voxbone.WebRTC.monitorStreamVolume('remote');
          //this out still hears echo local and no remote coming through
          if (voxbone.WebRTC.allowVideo) {
            voxbone.WebRTC.initVideoElement(voxbone.WebRTC.videoComponentName, stream);
          } else {
            voxbone.WebRTC.initAudioElement(voxbone.WebRTC.audioComponentName, stream);
          }
        });

      },

      /**
       * Checks if user is in an established
       * call or if a call attempt is in progress,
       * returns true if any of the above conditions
       * is true otherwise returns false
       *
       * @returns {boolean}
       */
      isCallOpen: function () {
        if ((voxbone.WebRTC.rtcSession.isInProgress === true) || (voxbone.WebRTC.rtcSession.isEstablished === true)) {
          return true;
        }
        return false;
      },

      /**
       * Sends DTMF tones using inband for chrome and SIP Info otherwise
       */
      sendDTMF: function (tone) {
        if (!tone)
          return;
        if (adapter.browserDetails.browser === 'chrome') {
          // Send the tone inband
          if (!dtmfSender) {
            // Create the DTMF sender, if possible
            if (myStream) {
              var tracks = myStream.getAudioTracks();
              if (tracks && tracks.length > 0) {
                var local_audio_track = tracks[0];
                dtmfSender = pc.createDTMFSender(local_audio_track);
                console.log("Created DTMF Sender");
                dtmfSender.ontonechange = function (tone) {
                  console.debug("Sent DTMF tone: " + tone.tone);
                };
              }
            }
            if (!dtmfSender) {
              console.warn("Invalid DTMF configuration");
              return;
            }
          }
          var duration = voxbone.WebRTC.configuration.digit_duration;	// We choose 500ms as the default duration for a tone
          var gap = voxbone.WebRTC.configuration.digit_gap;		// We choose 50ms as the default gap between tones
          console.debug("Sending DTMF string " + tone + " (duration " + duration + "ms, gap " + gap + "ms)");
          dtmfSender.insertDTMF(tone, duration, gap);
        } else {
          // Send the tone via SIP INFO
          var msg = {
            request: "dtmf",
            id: randomString(16),
            payload: {
              tone: tone
            }
          };
          sendMsgWrapper(msg, function response(result) {
            if (result["response"] === "error") {
              voxbone.logger.error(result);
              return;
            }
          });
        }
      },

      /**
       * Terminate the WebRTC session
       */
      hangup: function (cleanupOnly) {
        if (Object.keys(this.rtcSession).length !== 0) {
          if (voxbone.WebRTC.rtcSession.status !== voxbone.C.STATUS_TERMINATED) {
            voxbone.Logger.loginfo('hangup!');
            var previewCB = (typeof that.callbacks["preview"] == "function") ? that.callbacks["preview"] : voxbone.noop;
            previewCB(null);
            if (myStream) {
              voxbone.Logger.loginfo("Stopping local stream");
              try {
                // Try a MediaStream.id.stop() first
                myStream.id.stop();
              } catch (e) {
                // Do nothing if this fails
              }
              try {
                var tracks = myStream.getTracks();
                for (var i in tracks) {
                  var mst = tracks[i];
                  if (mst)
                    mst.stop();
                }
              } catch (e) {
                // Do nothing if this fails
              }
            }
            // Close PeerConnection
            try {
              pc.close();
            } catch (e) {
              // Do nothing
            }
            if (!cleanupOnly) {
              var msg = {
                request: "hangup",
                id: randomString(16)
              };
              sendMsgWrapper(msg);
            }

            voxbone.WebRTC.customEventHandler.ended('hangup');
            voxbone.WebRTC.rtcSession.status = voxbone.C.STATUS_TERMINATED;
          }
          voxbone.WebRTC.cleanUp();
        }
        //line below will make sure that the ringing call ends no matter what
        //voxbone.WebRTC.customEventHandler.failed({cause : 'BYE'});
      },

      /**
       * Helper methods to attach a stream to a video element (previously part of adapter.js)
       */
      attachMediaStream: function (element, stream) {
        if (adapter.browserDetails.browser === 'chrome') {
          var chromever = adapter.browserDetails.version;
          if (chromever >= 43) {
            element.srcObject = stream;
          } else if (typeof element.src !== 'undefined') {
            element.src = URL.createObjectURL(stream);
          } else {
            console.error("Error attaching stream to element");
          }
        } else {
          element.srcObject = stream;
        }
      },

      /**
       * Helper methods to reattach a stream to a video element (previously part of adapter.js)
       */
      reattachMediaStream: function (to, from) {
        if (adapter.browserDetails.browser === 'chrome') {
          var chromever = adapter.browserDetails.version;
          if (chromever >= 43) {
            to.srcObject = from.srcObject;
          } else if (typeof to.src !== 'undefined') {
            to.src = from.src;
          }
        } else {
          to.srcObject = from.srcObject;
        }
      },

      /**
       * Debug method to query a PeerConnection for this user
       */
      mediaInfo: function (callback) {
        callback = (typeof callback == "function") ? callback : voxbone.noop;
        var msg = {
          request: "mediaInfo",
          id: randomString(16)
        };
        sendMsgWrapper(msg, function response(result) {
          if (result["response"] === "error") {
            callback(result["payload"]["reason"]);
            return;
          }
          callback(null, result["payload"]["info"]);
        });
      },

      /**
       * Checks if the client browser supports WebRTC or not.
       *
       * @returns {boolean}
       */
      isWebRTCSupported: function () {
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
      mute: function (source) {
        var streams;

        if (!source || source !== 'remote') {
          streams = voxbone.WebRTC.rtcSession.connection.localStreams;
          this.isMuted = true;
          //voxbone.WebRTC.callStats.sendFabricEvent(voxbone.WebRTC.rtcSession.connection.pc, voxbone.WebRTC.callStats.fabricEvent.audioMute, voxbone.WebRTC.callid);
        } else {
          streams = voxbone.WebRTC.rtcSession.connection.remoteStreams;
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
      unmute: function (source) {
        var streams;

        if (!source || source !== 'remote') {
          streams = voxbone.WebRTC.rtcSession.connection.localStreams;
          this.isMuted = false;
          //voxbone.WebRTC.callStats.sendFabricEvent(this.rtcSession.connection.pc, voxbone.WebRTC.callStats.fabricEvent.audioUnmute, voxbone.WebRTC.callid);
        } else {
          streams = voxbone.WebRTC.rtcSession.connection.remoteStreams;
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
      unloadHandler: function () {
        if (voxbone.WebRTC.isCallOpen) {
          voxbone.Logger.loginfo("Page unloading while a call was in progress, hanging up");
          voxbone.WebRTC.hangup();
          voxbone.WebRTC.postLogsToServer();
        } else if (voxbone.WebRTC.configuration.post_logs_nocall === true) {
          /*Don't care if any calls were made, we still want logs*/
          voxbone.WebRTC.postLogsToServer();
        }
      }

    }

  });

  // We use this method to register callbacks
  this.callbacks = {};
  this.on = function (event, callback) {
    that.callbacks[event] = callback;
  };

  // Dispatcher management
  function getIceServers() {
    var msg = {
      request: "getIceServers",
      id: randomString(16)
    };
    sendMsgFrontend(msg, function response(result) {
      if (result["response"] === "error")
        return;
      iceServers = result["payload"].iceServers;
      voxbone.Logger.loginfo("ICE servers:", iceServers);
    });
  };

  function getWrapper(callback) {
    callback = (typeof callback == "function") ? callback : voxbone.noop;
    var msg = {
      request: "getWrapper",
      id: randomString(16)
    };
    sendMsgFrontend(msg, function response(result) {
      if (result["response"] === "error") {
        callback(result["payload"]["reason"]);
        return;
      }
      callback(null, result["payload"]["wrapper"]);
    });
  };

  // Wrapper
  function createWrapper(address, callback) {
    callback = (typeof callback == "function") ? callback : voxbone.noop;
    try{console.log(wrapper);} catch(e){};
    wrapper = new WebSocket(address, 'voxbone-janus-protocol');
    wrapper.onerror = function (error) {
      voxbone.Logger.loginfo("Disconnected from wrapper:", error);
      wrapper = null;
      callback(error);
    };
    wrapper.onclose = function () {
      voxbone.Logger.loginfo("Disconnected from wrapper (closed)");
      wrapper = null;
      var disconnectedCB = (typeof that.callbacks["disconnectedWrapper"] == "function") ? that.callbacks["disconnectedWrapper"] : voxbone.noop;
      disconnectedCB();
    };
    wrapper.onmessage = function (message) {
      voxbone.Logger.loginfo(message);
      var json = JSON.parse(message.data);
      var transaction = json["id"];
      if (transaction) {
        // This is a response
        var reportResult = transactions[transaction];
        if (reportResult)
          reportResult(json);
        delete transactions[transaction];
      } else {
        // This is an event
        var event = json["event"];
        if (event === "hangup") {
          voxbone.Logger.loginfo('Hangup/decline event');
          var hangupCB = (typeof that.callbacks["hangup"] == "function") ? that.callbacks["hangup"] : voxbone.noop;
          hangupCB();
          voxbone.WebRTC.hangup(true);
          // that.hangup(true);
        } else if (event === "incomingcall") {
          var info = json["payload"];
          var caller = info["caller"];
          var remoteJsep = info["jsep"];
          var allowVideo = (remoteJsep.sdp.indexOf("m=video ") > -1) || false;
          voxbone.Logger.loginfo('Incoming ' + (allowVideo ? 'video' : 'audio') + ' call from ' + caller);
          voxbone.WebRTC.rtcSession.status = voxbone.C.STATUS_INVITE_RECEIVED;
          // Before notifying, create a PeerConnection
          createPC(function (err) {
            if (err && !pc) {
              // An error occurred, automatically hangup
              voxbone.WebRTC.hangup();
              voxbone.Logger.logerror(err);
              return;
            }
            // Set the remote description
            pc.setRemoteDescription(
              new RTCSessionDescription(remoteJsep),
              function () {
                voxbone.Logger.loginfo("Remote description accepted!");
                // Notify user
                var incomingcallCB = (typeof that.callbacks["incomingcall"] == "function") ? that.callbacks["incomingcall"] : voxbone.noop;
                incomingcallCB(caller, allowVideo);
              }, function (error) {
                // An error occurred, automatically hangup
                voxbone.WebRTC.hangup();
                voxbone.Logger.logerror(error);
              });
          });
        } else if (event === "losses") {
          var info = json["payload"];
          voxbone.Logger.loginfo('Losses event:', info);
          var lossesCB = (typeof that.callbacks["losses"] == "function") ? that.callbacks["losses"] : voxbone.noop;
          lossesCB(info);
        } else if (event === "missedcalls") {
          var calls = json["payload"];
          voxbone.Logger.loginfo('Missed calls event:', calls);
          var missedCB = (typeof that.callbacks["missedcalls"] == "function") ? that.callbacks["missedcalls"] : voxbone.noop;
          missedCB(calls);
        } else if (event === "webrtc" && json["payload"].status === "up") {
          voxbone.WebRTC.rtcSession.isEstablished = true;
        } else {
          voxbone.Logger.loginfo("Unhandled event " + event + ": "+ json["payload"].status);
        }
      }
    };
    wrapper.onopen = function () {
      callback();
    };
  };

  function registerViaWrapper(details, callback) {
    callback = (typeof callback == "function") ? callback : voxbone.noop;
    voxbone.Logger.loginfo('Details:');
    voxbone.Logger.loginfo(details);
    var msg = {
      request: "register",
      id: randomString(16),
      payload: details
    };
    sendMsgWrapper(msg, function response(result) {
      if (result["response"] === "error") {
        callback(result["payload"]["reason"]);
        voxbone.WebRTC.customEventHandler.failed(result["payload"]["reason"])
        return;
      } else {
        voxbone.WebRTC.customEventHandler.registered(result);
      }
      callback();
    });
  };

  function unregisterWrapper() {
    var msg = {
      request: "unregister",
      id: randomString(16)
    };
    sendMsgWrapper(msg, function response(result) {
      if (wrapper)
        wrapper.close();
      wrapper = null;
    });
  }

  // Helper to create a PeerConnection
  function createPC(callback) {
    callback = (typeof callback == "function") ? callback : voxbone.noop;
    voxbone.Logger.loginfo('Creating Peerconnection!');
    if (pc) {
      voxbone.Logger.loginfo("PeerConnection exists");
      callback("PeerConnection exists");
      return;
    }
    // Create PeerConnection
    var pc_config = iceServers;
    var pc_constraints = {
      "optional": [{"DtlsSrtpKeyAgreement": true}]
    };
    pc = new RTCPeerConnection(pc_config, pc_constraints);
    // We use this PeerConnection both to send AND receive
    voxbone.Logger.loginfo(pc);
    pc.onaddstream = function (remoteStream) {
      var streamCB = (typeof that.callbacks["stream"] == "function") ? that.callbacks["stream"] : voxbone.noop;
      //voxbone.WebRTC.rtcSession.connection.remoteStreams.push(remoteStream.stream);
      streamCB(remoteStream.stream);
    };
    pc.onicecandidate = function (event) {
      // Trickle candidate (or the end of the gathering process)
      var candidate = null;
      if (event.candidate === null) {
        candidate = {completed: true};
      } else {
        candidate = {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex
        };
      }
      voxbone.Logger.loginfo("Trickling candidate:", candidate);
      var msg = {
        request: "trickle",
        id: randomString(16),
        payload: {
          candidate: candidate
        }
      };
      sendMsgWrapper(msg);
    };
    callback();
  }

  // Accept a call (will result in a 200 OK)
  function acceptCall(allowVideo, callback) {
    callback = (typeof callback == "function") ? callback : voxbone.noop;
    if (!pc) {
      voxbone.Logger.loginfo("Not invited to a call");
      callback("Not invited to a call");
      return;
    }
    var consentCB = (typeof that.callbacks["consent"] == "function") ? that.callbacks["consent"] : voxbone.noop;
    consentCB(true);
    navigator.mediaDevices.getUserMedia({audio: true, video: allowVideo})
    .then(function (stream) {
      consentCB(false);
      myStream = stream;
      voxbone.WebRTC.rtcSession.connection.localStreams.push(myStream);
      voxbone.WebRTC.monitorStreamVolume('local');
      pc.addStream(stream);
      var previewCB = (typeof that.callbacks["preview"] == "function") ? that.callbacks["preview"] : voxbone.noop;
      previewCB(stream);
      // Create offer
      var mediaConstraints = null;
      if (adapter.browserDetails.browser == "firefox" || adapter.browserDetails.browser == "edge") {
        mediaConstraints = {
          'offerToReceiveAudio': true,
          'offerToReceiveVideo': allowVideo
        };
      } else {
        mediaConstraints = {
          'mandatory': {
            'OfferToReceiveAudio': true,
            'OfferToReceiveVideo': allowVideo
          }
        };
      }
      voxbone.Logger.loginfo(mediaConstraints);
      pc.createAnswer(
        function (answer) {
          if (sdpSent === true) {
            voxbone.Logger.loginfo("Offer already sent, not sending it again");
            return;
          }
          sdpSent = true;
          pc.setLocalDescription(answer);
          var jsep = {
            type: answer.type,
            sdp: answer.sdp
          };
          // Send the open request
          var msg = {
            request: "accept",
            id: randomString(16),
            payload: {
              jsep: jsep
            }
          };
          voxbone.WebRTC.rtcSession.status = voxbone.C.STATUS_ANSWERED;
          sendMsgWrapper(msg, function response(result) {
            voxbone.Logger.loginfo("Got ack to answer");
            if (result["response"] === "error") {
              voxbone.WebRTC.hangup();
              voxbone.Logger.loginfo(result["payload"]["reason"]);
              callback(result["payload"]["reason"]);
              return;
            }
            voxbone.WebRTC.rtcSession.status = voxbone.C.STATUS_CONFIRMED;
            callback();
          });
        }, function (error) {
          voxbone.WebRTC.hangup();
          voxbone.Logger.logerror(error);
          callback(error);
        }, mediaConstraints);
    })
    .catch(function (error) {
      consentCB(false);
      voxbone.Logger.logerror(error);
      callback(error);
    });
  }

  // Debug method to query the wrapper's internals
  function audit(callback) {
    callback = (typeof callback == "function") ? callback : voxbone.noop;
    var msg = {
      request: "audit",
      id: randomString(16)
    };
    sendMsgWrapper(msg, function response(result) {
      if (result["response"] === "error") {
        callback(result["payload"]["reason"]);
        return;
      }
      callback(null, result["payload"]);
    });
  };

  // Media controls (web demo only, no API)
  // this.toggleMute = function(callback) {
  // 	callback = (typeof callback == "function") ? callback : voxbone.noop;
  // 	var stream = myStream["sfuaudio"];		// Assuming profile=separated
  // 	if(!stream)
  // 		stream = myStream["mixedaudio"];	// Maybe profile=mixing?
  // 	if(!stream)
  // 		stream = myStream["sfuvideo"];		// Or maybe profile=together
  // 	if(!stream || !stream.getAudioTracks() || stream.getAudioTracks().length === 0) {
  // 		callback("No audio track");
  // 		return;
  // 	}
  // 	stream.getAudioTracks()[0].enabled = !stream.getAudioTracks()[0].enabled;
  // 	callback(null, stream.getAudioTracks()[0].enabled);
  // };

  // Private helpers to send messages to the wrapper or to the Frontend
  function sendMsgFrontend(message, callback) {
    callback = (typeof callback == "function") ? callback : voxbone.noop;
    if (!frontend) {
      callback({response: "error", payload: {reason: "Invalid socket/wrapper"}});
      return;
    }
    if (!message["id"])
      message["id"] = randomString(16);
    voxbone.Logger.loginfo('Sending message to Frontend:');
    voxbone.Logger.loginfo(message);
    // Subscribe to the response and send to the Frontend
    var transaction = message["id"];
    frontend.on(transaction, function (response) {
      voxbone.Logger.loginfo("Received response from Frontend:");
      voxbone.Logger.loginfo(response);
      voxbone.Logger.loginfo(response["payload"]);
      frontend.removeListener(transaction, arguments.callee);
      if (callback) {
        callback(response);
      }
    });
    frontend.emit('message', message);
  }

  var transactions = {};

  function sendMsgWrapper(message, callback) {
    callback = (typeof callback == "function") ? callback : voxbone.noop;
    if (!wrapper) {
      callback({response: "error", payload: {reason: "Invalid wrapper"}});
      return;
    }
    if (!message["id"])
      message["id"] = randomString(16);
    voxbone.Logger.loginfo('Sending message to Wrapper:');
    voxbone.Logger.loginfo(message);
    // Subscribe to the response and send to the wrapper
    transactions[message["id"]] = callback;
    setTimeout(function() {
      wrapper.send(JSON.stringify(message));
    }, 200);
  }

  function randomString(len) {
    charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var randomString = '';
    for (var i = 0; i < len; i++) {
      var randomPoz = Math.floor(Math.random() * charSet.length);
      randomString += charSet.substring(randomPoz, randomPoz + 1);
    }
    return randomString;
  }

  if (config) {
    if (config.sipUsername) voxbone.WebRTC.configuration.username = config.sipUsername;
    if (config.sipAuthUser) voxbone.WebRTC.configuration.authuser = config.sipAuthUser || config.sipUsername;
    if (config.sipPassword) voxbone.WebRTC.configuration.secret = config.sipPassword;
    if (config.sipUsername && config.sipRegistrar) voxbone.WebRTC.configuration.uri = 'sip:' + config.sipUsername + '@' + config.sipRegistrar;
    if (config.sipURI) voxbone.WebRTC.configuration.uri = config.sipURI;
    if (config.sipRegistrar) voxbone.WebRTC.configuration.server = 'sip:' + config.sipRegistrar;
    if (config.log_level) voxbone.WebRTC.configuration.log_level = config.log_level || voxbone.Logger.log_level.INFO;
    if (config.post_logs) voxbone.WebRTC.configuration.post_logs = config.post_logs || voxbone.WebRTC.configuration.post_logs;
  }

  voxbone.Logger.loginfo(voxbone);
  return voxbone;

}