# Change Log

## 3.1.0 - November 2017

* #136. - Remove callstats.io

## 3.0.2 - November 2017

* #139. - Updates callstats to use latest

## 3.0.1 - October 2017

* #133. - Proper calling the consent gUM callback.

## 3.0.0 - September 2017

* #123. - Major breaking change update. Replacement of JSSIP with Janus. More info: https://github.com/voxbone-workshop/webrtc-js/wiki/voxbone-3.0

## 2.2.4 - July 2017

* #117. - Validate DTMF digit is valid
* #112. - adding callstats 3.21.1

## 2.2.3 - May 2017

* #105. Fixes Voxbone Logger not tracing `Preferred Pop`
* #101. Fixing Callstats library to v3.19.17
* #100. Putting POP selection back in

## 2.2.2 - March 2017

* #91. Fixing Callstats library to v3.17.10

## 2.2.1 - March 2017

* #83. Fixes unmute event exposed variable
* #85. Add "Ready To Call" event

## 2.2.0 - March 2017

* #64. Adding features to answer incoming calls
* #74. Moving dependencies to RequireJS

## 2.1.7 - March 2017
* Fix for #40. Add a redirect service to use either Voxbone's or Click2vox.io backup

## 2.1.6 - February 2017
* Fix for #63. Removing socket.io
* Fix for #68. Send DTMF tones in the right event
* Updates Callstats JS library (v3.17.7)
* Updates grunt-contrib-uglify (v2.1.0)

## 2.1.5 - February 2017
* Adds "rtcpMuxPolicy" flag for Chrome v57+
* Putting back Callstats integration

## 2.1.4 - December 2016
* Temporaly removing Callstats integration

## 2.1.3 - December 2016
* Fix for #41. Updates Callstats JS library (v3.17.0)
* Fix for bug about properly end a call if the the container window is closed

## 2.1.2 - November 2016
* Fix for #36. Updates jsSIP library (v2.0.6)

## 2.1.1 - November 2016
* Updates Callstats JS library

## 2.1.0 - August 2016
* Removed jQuery dependency to minimize conflicts and provide better interoperability with existing sites
* Minified file availability - speeds load times
* Source maps - helps with debugging minified files
* CDN file distribution - faster load times
* SIP library updates
* Numerous bug fixes

## 2.0.0 - June 2016
* Moving to a [semver](semver.org) version numbering scheme
* Integration of a new WebRTC call monitoring system (in addition to Voxbone's existing systems)
* Bundling of our [jssip.js fork](https://github.com/voxbone/JsSIP)
* Console log suppression

------------------

## 0.0.5 - November 2015

* Basic Authentication option (seperate auth server now optional)
* isCallOpen function to detect current calls tate
* New event handlers - `getUSerMediaFailed`, `accepted`, `localMediaVolume`
* unloadHandler cleanly ends existing calls
* Automatically send a DTMF string at the beginning of call to help with IVR navigation
* Configurable digit duration and gapping
* Post logs to Voxbone option to help with debugging
* Secure websockets (WSS)

More details here: https://groups.google.com/forum/#!topic/voxbonedevelopers/etFwIMjUBV8


## 0.0.4 - September 2015

See details here: https://groups.google.com/forum/#!topic/voxbonedevelopers/N73cVpQQeoM
