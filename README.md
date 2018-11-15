# Introduction
webrtc-js is a Voxbone project that allows web users to call a SIP address or Voxbone SIP Trunk from WebRTC-enabled browsers. The library is focused on click-to-call use cases. See below is information on how this library works. More information can be found on our [Developer Portal](https://developers.voxbone.com/docs/webrtc/overview/)

See our [changelog](https://github.com/voxbone-workshop/webrtc-js/blob/master/CHANGELOG.md) for version differences.

### Key features

* Wraps the WebRTC API for WebRTC-to-SIP dialing withi Voxbone's WebRTC Gateway service
* Automatic detection of the nearest POP (Point Of Presence)
* Send a DTMF string at the start of a call for IVR navigation
* Context header which can then be passed onto customer equipment via an invite header ( X-Voxbone-Context )
* Ephemeral authentication support

### Reference implementations

Voxbone provides the following reference implementations built on top of webrtc-js:

* Voxbone Customer Portal [widget generator](https://developers.voxbone.com/category/webrtc/overview-webrtc/) - create a click-to-call button & pop-up dialer for any Voxbone DID
* [VoxboneJS Demo](https://github.com/voxbone-workshop/webrtc-tutorial/) - view and edit the demo code
* ~[click2vox.com](https://click2vox.com) - create a free click-to-call button with widget code for any SIP URI (being retired)~

### Security controls

Calls to webrtc-js are governed by Voxbone's WebRTC to SIP Gateway Service. These controls include:

* Default limiting of no more than 8 requests per second per source IP for WebRTC calls
* Maximum simultaneous calls is determined based on the assigned DID's channel configuration
* An Ingress SBC that regulates incoming WebRTC gateway traffic
* Voxbone's existing egress SBC and security mechanisms used to protect all traffic
* Authentication timeout period set to 15 minutes

Please [contact us](mailto:workshop@voxbone.com) for details.

## Questions

Please contact us at [workshop@voxbone.com](mailto:workshop@voxbone.com), submit an issue, or visit [voxbone.com](https://www.voxbone.com).

# File references
Voxbone hosts minified and unminified versions of voxbone.js on our CDN:

* use [//cdn.voxbone.com/voxbone/voxbone-2.2.3.min.js](https://cdn.voxbone.com/voxbone/voxbone-2.2.3.min.js) to access a specific patch release
* use [//cdn.voxbone.com/voxbone/voxbone-2.2.min.js](https://cdn.voxbone.com/voxbone/voxbone-2.2.min.js) to access a minor version release with the latest patches
* use [//cdn.voxbone.com/voxbone/voxbone-2.min.js](https://cdn.voxbone.com/voxbone/voxbone-2.min.js) to access a major version release with the latest updates

Source maps are included with the minified files for simplified debugging. Remove the _min_ from the file names above for the unminified versions.

Please see [semver.org](http://semver.org) for details on the version numbering scheme.

# Usage

## Basic usage

Before you start, your Voxbone account must be [configured](https://developers.voxbone.com/how-to/setup-webrtc/) for WebRTC.

```javascript
//Authenticate via basic auth using credentials from Voxbone's Customer Portal
voxbone.WebRTC.basicAuthInit(username, key);

//Alternatively, host your own auth server and create an authentication token
var voxrtc_config = {"key":"ABwxcFX6ayVxu/uNuZu3eBsjrFeg=","expires":1426067127,"username":"a_username"};

//Initialize Voxbone WebRTC connection
voxbone.WebRTC.init(voxrtc_config);

//Place a call on a given number
var e164 = 'a_number';
voxbone.WebRTC.call(e164);
```


## Authentication token
You can decide whether to authenticate via basic auth or use token generators:
* Basic Auth - allows any anyone to call a given e164 up to your configured trunk limit within Voxbone's border controls. Recommended in most cases where you are ok with anyone dialing a DID, such as those already listed publicly on.
* Advanved Auth - you must host an auth server and provide a temporary auth token for greater access control. For more advanced users where you do not want to allow anyone to call the specific DID from WebRTC.

#### Using Basic Auth
Provide your username and webrtc key in the basicAuthInit() function.
```javascript
voxbone.WebRTC.basicAuthInit(username, key)
```

#### Using Token Generator
An authentication token needs to be provided for initializing the voxbone.WebRTC object.
```json
{
    "key":"ABwxcFX6ayVxu/uNuZu3eBsjrFeg=",
    "expires":1426067127,
    "username":"a_username"
}
```

* username: This is your credentials username
* expires: expiration date of the generated key (in seconds, epoch time)
* key: this is a base64 representation of an HMAC SHA1 of expires:username, salted with your password.

Various example on how to generate the authentication token can be found on Github such like

* [webrtc-auth-servlet](https://github.com/voxbone/webrtc-auth-servlet) (java)
* [webrtc-auth-perl](https://github.com/voxbone/webrtc-auth-perl) (perl)
* [webrtc-node](https://github.com/voxbone/webrtc-node/) (nodejs)
* [webrtc-auth-flask](https://github.com/jeansch/webrtc-auth-flask) (python)
* [voxbone-webrtc-php](https://github.com/ClintDavis/voxbone-webrtc-php) (php)

## Initialization
During the initialization phase, voxbone.WebRTC will:

* Authenticate toward Voxbone auth server and retrieve a list of WebSocket server as well as a list of ping servers.
* Ping all ping server in order to discover the best POP
* Initialize the connection to the WebSocket server.

Auth server url can be customized using
```javascript
voxbone.WebRTC.authServerURL = "https://webrtc.voxbone.com/rest/authentication/createToken";
```

If for any reason, you want to bypass the ping mechanism and force a POP, this can be achieved using
```javascript
voxbone.WebRTC.preferedPop = 'BE';
```

## Call Context
Call context can be passed as a SIP INVITE header ( X-Voxbone-Context ).
Context is a free text field, and can be set as following:

```javascript
voxbone.WebRTC.context = "a value you want to pass onto X-Voxbone-Context header";
```

One possible approach is to pass a json structure as context value, so that you can keep things easy and still be able to pass multiple values in one go.
Please note that no other headers are forwarded by Voxbone.

## Calling

### Making and receiving a call

At the moment you can only do one or the other, make a call or receive a call, you can not do both

####Call establishment####
Once you're fully set up, you can now establish a call to a given number using
```javascript
var e164 = 'a_number';
voxbone.WebRTC.call(e164);
```

display name of the caller can be customized using
```javascript
voxbone.WebRTC.configuration.display_name = "a custom display name";
```
Note that the above has to be performed before call is established.

#### Receiving a Call ####

Because this is an alpha feature, there are a few options you'll need to set in order to use the feature.

The first two are your username and password so that we can do a `REGISTER` request to the end SIP gateway.

```
voxbone.WebRTC.username = 'a-username-string';
voxbone.WebRTC.password = 'a-super-secret-password';
```

You also need to pass in a function that decides whether or not to accept the call or not. This function takes a data argument which contains information about the call and a callback. The Callback takes a true or false parameter to accept or decline the inbound call. In the example below we immediately call the callback with the true argument but because its a callback function, you can do this asynchronously after doing any kind of logic you want - a HTTP call, waiting for something to happen within the page such as a click on an accept button.

```
voxbone.WebRTC.onCall = function (data, cb) {
  console.log('recieved a call');
  cb(true);
}

```

### Methods available during a call

video and audio html element will automatically gets added to the html document upon call establishment.
If you want to avoid defaults elements to be added the page and feed your own element, you can set the ids of these element.
voxbone.WebRTC will then simply attach the streams to the provided element instead of providing its own.

```javascript
voxbone.WebRTC.audioComponentName = "peer-audio";
voxbone.WebRTC.videoComponentName = "peer-video";
```

Note: WebRTC to SIP-controller video calling is experimental.

####Muting####

Audio stream can be muted/unmuted as shown below
```javascript
//mute the audio stream
voxbone.WebRTC.mute();
//unmute the audio stream
voxbone.WebRTC.unmute();
//check if audio stream is muted (returns true/false)
voxbone.WebRTC.isMuted
```

####Sending DTMF####

DTMF can be sent once the call is established using
```javascript
//Send 1 as DTMF
voxbone.WebRTC.sendDTMF(1);
```

DTMF String sending can also be automated to bypass IVRs. In some cases,  it is desirable for web application to enabled automated IVR traversal. For automated IVR traversal, web application needs to configure the dialer_string, digits configured in the dialer string will be sent automatically to the remote party after the call is established. Dialer string is comma separated, to define a specific pause between digits. We add another entry like 1,700ms,2, this will add a 700ms of pause between digits 1 & 2. Example: `1,2,3,1200ms,4,5,900ms,6,#`

```javascript
voxbone.WebRTC.configuration.dialer_string = "1,300ms,4,5,2000ms,6,#";
```
Overall digit pause period can be configured with digit_gap. By default, this value is 500ms.
```javascript
voxbone.WebRTC.configuration.digit_gap = 1400;
```
It defines the gap between digits sent by the web application. By default, this value is 500ms.

Digit duration can also be configured. Digti duration defines the duration of digits sent by the web application. By default, digit duration is 100 ms.
```javascript
voxbone.WebRTC.configuration.digit_duration = 1000;
```

####isCallOpen####
Web application developer can invoke this API to check the call status of the webrtc user. It returns true if user is in middle of a call or if call attempt is already in progress. Web application developer can use this API to enable/disable the ‘call’ button on their web page.
```javascript
voxbone.WebRTC.isCallOpen();
```

##Event Handling##
Voxbone.js provides many callback APIs allowing the web application to monitor the state of a call. Following is the list:
####Progress####
This callback API indicates the called party phone is ringing now. Here is a sample implementation of this API:
```javascript
voxbone.WebRTC.customEventHandler.progress = function(e) {
    console.error(“call in progress”);
}
```
####Failed####
This callback API indicates that webRTC sdk failed to establish the call. Here is a sample implementation of this API:
```javascript
voxbone.WebRTC.customEventHandler.failed = function(e) {
  console.error(“Failed to establish the call”);
}
```
####getUserMediaFailed####
This API is used to indicate that getUserMedia failed which can be a result of browser not being able to access the mic. Here is a sample implementation of this API:
```javascript
voxbone.WebRTC.customEventHandler.getUserMediaFailed = function(e) {
  console.error(“Failed to access mic”);
}
```
####Accepted####
This API is used to indicate that call is successfully established. Here is a sample implementation of this API:
```javascript
voxbone.WebRTC.customEventHandler.accepted = function(e) {
  console.log(“call started”);
}
```
####Ended####
This API is used to indicate that outgoing call just ended. Here is a sample implementation of this API:
```javascript
voxbone.WebRTC.customEventHandler.ended = function(e) {
  console.log(“call ended”);
}
```
####localMediaVolume####
This is a callback API to indicate the loudness of the speech at the calling party. Here is a sample implementation of this API:
```javascript
voxbone.WebRTC.customEventHandler.localMediaVolume = function(e) {
  console.log(“Local volume is ”+e.localVolume);
}
```
The localVolume will be in the range of 0 to 1, anything above 0.25 should be considered loud enough.

##Terminating Ongoing Calls with unloadHandler()##
This API should be tied to the page unload event in the web application. It will take care of terminating any ongoing call and does some extra work like pushing the webrtc logs. Here is a sample implementation for this API:
```
<body onbeforeunload="voxbone.WebRTC.unloadHandler();">
```
## Testing Web browser support
In order to test if the web browser do support WebRTC, we added a conveniant method which will simply returns true/false depending on the web browser capabilities
```javascript
var supported = voxbone.WebRTC.isWebRTCSupported();
```

## Log options

### Suppress console log messages

Config flag voxbone.WebRTC.configuration.log_level can be set at various levels to limit what is displayed to the javascript console:

- `voxbone.Logger.log_level.INFO` -- Everything goes to console (default)
- `voxbone.Logger.log_level.ERROR` -- Only errors are sent to console
- `voxbone.Logger.log_level.NONE`  -- No logs are sent to console

### Post logs to Voxbone Server with post_logs##
This configuration option if enabled allows voxbone webrtc sdk to push all the call logs to a voxbone defined backend, where they can be used for troubleshooting. By default, this option is disabled.
```javascript
/**
*  Set this option to true to allow voxbone to collect call logs
*/
voxbone.WebRTC.configuration.post_logs = true;
```
