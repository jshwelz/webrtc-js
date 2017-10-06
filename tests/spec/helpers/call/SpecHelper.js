beforeEach(function () {
  jasmine.addMatchers({
    toBeCalling: function () {
      setTimeout(function() {
        var callstarted = false;
        var eventHandlers = {
          'accepted': function(e) {
            console.log('Call started');
            callstarted = true;
          }
        };
        voxbone.WebRTC.customEventHandler = Object.assign(voxbone.WebRTC.customEventHandler, eventHandlers);
        return {
          pass: voxbone.WebRTC.isCallOpen() && callstarted
        }
      }, 4000);
    },
    toBeSendingLocalAudio: function () {
      return {
        compare: function(voxbone) {
          var streams = voxbone.WebRTC.rtcSession.connection.localStreams;
          var sending = false;
          for (var i = 0; i < streams.length; i++) {
            for (var j = 0; j < streams[i].getAudioTracks().length; j++) {
              console.info('sending:'+sending);
              sending = sending ? sending : streams[i].getAudioTracks()[j].enabled;
            }
          }
          var result = { pass: sending !== false };

          if(result.pass) {
            result.message =  "Audio being sent.";
          } else {
            result.message =  "Audio deactivated.";
          }
          return result;
        }
      }

    }
  });
});
