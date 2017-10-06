describe("Voxbone oncall outbound", function() {
  var voxbone;
  var did;

  beforeEach(function(done) {
    voxbone = new Voxbone();
    did = '12345678';
    spyOn(console, 'log');
    // We leave a timeout for voxbone loading
    setTimeout(function() {
      //simulate on call
      voxbone.WebRTC.rtcSession.isEstablished = true;
      done();
    }, 2500);
  });

  it("should know when it is on call", function() {
    console.info(voxbone.WebRTC);
    expect(voxbone.WebRTC.isCallOpen()).toEqual(true);
  });

  it("should not be possible to call while on call", function() {
    voxbone.WebRTC.call(did);
    voxbone.WebRTC.call(did);
    expect(console.log).toHaveBeenCalledWith("Already in a call");
  });

  describe("hangup", function () {
    it("should end the call", function (done) {
      spyOn(voxbone.WebRTC.customEventHandler, 'ended');
      spyOn(voxbone.WebRTC, 'cleanUp');
      //simulate oncall status
      voxbone.WebRTC.call(did);
      voxbone.WebRTC.rtcSession = {connection: {localStreams: ['test1'], remoteStreams: ['test2']}, status: 0};
      voxbone.WebRTC.rtcSession.status = voxbone.C.STATUS_ANSWERED;
      console.info(voxbone.WebRTC.rtcSession.status);
      setTimeout(function() {
        voxbone.WebRTC.hangup();
        console.info(voxbone.WebRTC.rtcSession.status);
        expect(voxbone.WebRTC.cleanUp).toHaveBeenCalled();
        expect(voxbone.WebRTC.rtcSession.status).toEqual(voxbone.C.STATUS_TERMINATED);
        done();
      }, 500);
    });
  });

  describe("when local call has been muted", function() {
    beforeEach(function() {
      voxbone.WebRTC.mute();
    });

    it("should not send audio", function(done) {
      setTimeout(function() {
        expect(voxbone).not.toBeSendingLocalAudio();
        done();
      }, 500);
    });

    it("should indicate that the call has been muted", function() {
      expect(voxbone.WebRTC.isMuted).toBeTruthy();
    });

    it("should be possible to unmute", function() {
      voxbone.WebRTC.unmute();
      expect(voxbone.WebRTC.isMuted).toBeFalsy();
    });

  });

  it("should be able to send valid DTMF tone/s", function() {
    voxbone.WebRTC.sendDTMF('1');
    expect(console.log).toHaveBeenCalled();
  });

  it("should not be able to send invalid DTMF tone/s", function() {
    voxbone.WebRTC.sendDTMF('invalid');
    expect(console.log).toHaveBeenCalledWith("Invalid tone");
  });
});
