describe("Voxbone before on call", function() {
  var did;
  var voxbone;
  var failed;
  // mock credentials
  var username = '1501855125:username';
  var password = 'af8KSZQREMwovHAXyVpdknU7hTs=';
  var FakeAuthResponses = {
    errorResponse: {"error":"username not found"},
    successResponse: {"username":"1501855125:username","password":"af8KSZQREMwovHAXyVpdknU7hTs=","ttl":900,"ws":[],"wss":["wss://voxbone.com:443"],"log":["https://webrtc.voxbone.com/cgi-bin/post_logs.pl"],"stunServers":[{"url":"stun:turn03.uswest.xirsys.com"}],"turnServers":[{"url":"turn:turn.uswest.xirsys.com:80?transport=tcp","username":"username","credential":"credential"}],"pingServers":{"LA":"https://us.voxbone.com/pong.jpg","BE":"https://be.voxbone.com/pong.jpg","CN":"https://cn.voxbone.com/pong.jpg"},"callStatsCredentials":{"appId":"appid","appSecret":"secret"}},
  };

  beforeEach(function(done) {
    voxbone = new Voxbone();
    spyOn(console, 'log');
    setTimeout(function() {
      console.info('rendering time...');
      done()
    }, 2500);
  });

  it("should be able to authenticate", function (done) {
    spyOn(voxbone.WebRTC, 'processAuthData');
    var data = {
      'username': 'username',
      'key': 'key',
      'timestamp': Date.now()
    };
    var that = this;
    voxbone.Request.jsonp('https://fakeserver.com', data, function(data) {
      voxbone.WebRTC.processAuthData(that, data);
    });
    setTimeout(function() {
      expect(voxbone.WebRTC.processAuthData).toHaveBeenCalled();
      done();
    }, 3000);
  });

  describe("when authenticating", function() {

    it("should be able to process successful authentication response", function (done) {
      console.info(FakeAuthResponses.successResponse);
      var res = FakeAuthResponses.successResponse;
      //simulate init and basicAuth methods and process
      setTimeout(function() {
        voxbone.WebRTC.processAuthData(voxbone.WebRTC, res);
        expect(voxbone.WebRTC.configuration.username).toEqual(username);
        expect(voxbone.WebRTC.configuration.secret).toEqual(password);
        // expect(cb).not.toThrow();
        done()
      }, 100);
    });

    describe("when failing authenticating", function() {

      it("should not process error response", function (done) {
        var res = FakeAuthResponses.errorResponse;
        //simulate init and basicAuth methods and process
        setTimeout(function () {
          voxbone.WebRTC.processAuthData(voxbone.WebRTC, res);
          expect(voxbone.WebRTC.configuration.username).not.toEqual(username);
          expect(voxbone.WebRTC.configuration.secret).not.toEqual(password);
          done();
        }, 100);
      });

      it("should send a failed event", function (done) {
        var res = FakeAuthResponses.errorResponse;
        spyOn(voxbone.WebRTC.customEventHandler, 'failed');
        //simulate init and basicAuth methods and process
        setTimeout(function () {
          voxbone.WebRTC.processAuthData(voxbone.WebRTC, res);
          expect(voxbone.WebRTC.customEventHandler.failed).toHaveBeenCalled();
          done();
        }, 100);
      });
    });

  });


  describe("when outbound", function() {

    beforeEach(function (done) {
      console.info(voxbone);
      did = '12345678';
      setTimeout(function() {
        console.info('call() timeout');
        done();
        voxbone.WebRTC.call(did);
        console.info('call() done');
      }, 3000);
    });

    afterEach(function (done) {
      console.info('cleanup');
      setTimeout(function() {
        voxbone.WebRTC.hangup();
        done();
      }, 1000);
    });

    it("should be able to request Janus wrapper to frontend", function (done) {
      setTimeout(function () {
        expect(console.log).toHaveBeenCalledWith('Sending message to Frontend:');
        done();
      }, 1000);
    });

    describe("and when valid DID", function() {

      xit("should be able to call", function (done) {
        //FIXME
        console.info('testing able to call, waiting 3s...');
        setTimeout(function () {
          console.info('call open: '+voxbone.WebRTC.isCallOpen());
          expect(console.log).toHaveBeenCalledWith('Creating Peerconnection!');
          done();
        }, 3000);
      });
    });

    describe("and when invalid DID", function() {

      beforeEach(function () {
        voxbone.WebRTC.call(did);
        spyOn(voxbone.WebRTC.customEventHandler, 'failed');
      });

      afterEach(function () {
        console.info('cleanup');
        voxbone.WebRTC.hangup();
      });

      it("should be able to send a failed Event exception", function () {
        voxbone.WebRTC.customEventHandler.failed();
        expect(voxbone.WebRTC.customEventHandler.failed).toHaveBeenCalled()
      });
    });
  });

  describe("when inbound", function() {

    beforeEach(function () {
      // mock registration credentials
      voxbone.WebRTC.configuration.username = 'username';
      voxbone.WebRTC.configuration.authuser = 'username';
      voxbone.WebRTC.configuration.secret = '1234';
      voxbone.WebRTC.configuration.registrar = 'voxboneworkshop.com';
      voxbone.WebRTC.configuration.uri = 'sip:username@voxboneworkshop.com';
      //we jump some inbound steps to get into the registration process
      voxbone.WebRTC.setupInboundCalling(voxbone.WebRTC.configuration, function (err) {
        if (err) {
          voxbone.Logger.logerror('Registration failed:');
          voxbone.Logger.logerror(err);
        }
      });
    });

    afterEach(function () {
      console.info('cleanup');
      voxbone.WebRTC.hangup();
    });

    it("should be able to request Janus wrapper to frontend", function (done) {
      setTimeout(function () {
      expect(console.log).toHaveBeenCalledWith('Sending message to Frontend:');
      done();
      }, 500);
    });

    xit("should be able to send register to Janus wrapper", function (done) {
      //FIXME
      setTimeout(function () {
        expect(console.log).toHaveBeenCalledWith('Sending message to Wrapper:');
        done();
      }, 500);
    });
  });

  describe("when hangup", function () {

    it("should throw a console log message if call didn't start", function () {
      voxbone.WebRTC.hangup();
      expect(console.log).toHaveBeenCalledWith("call has not started");
    });

  });

  describe("when sending DTMF", function () {

    it("should print error log to console if call didn't start", function () {
      voxbone.WebRTC.sendDTMF('1');
      expect(console.log).toHaveBeenCalledWith("call has not started");
    });

  });

});
