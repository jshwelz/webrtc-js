# Change Log


## 2.1.0 - August 2016
* Removed jQuery dependency to minimize dependencies and provide better interoperability with existing sites
* Minified file availability - speeds load times
* Source maps - helps with debugging minified files
* CDN file distribution - faster load times
* SIP library updates
* Numerous bug fixes

## 2.0.0 - June 2016
* Moving to a [semver](semver.org) version numbering scheme
* Integration of a new WebRTC call monitoring system (in addition to Voxbone's existing systems)
* Bundling of our [jssjip.js fork](https://github.com/voxbone/JsSIP)
* Console log supression

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
