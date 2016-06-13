Voxbone-2.0.0.js is an API breaking release of our webrtc SDK

Upgrade to voxbone-2.0.0.js works only if following conditions are met:

1. jssip.js isn't included seperately.
2. Following javascript files are included (callstats has a dependency on them)

https://cdn.socket.io/socket.io-1.4.5.js
https://cdnjs.cloudflare.com/ajax/libs/jsSHA/1.5.0/sha.js

Additionally, voxbone-2.0.0.js provides an extra option to suppress console logs.
Config flag voxbone.WebRTC.configuration.log_level can be used to control the console logging, it can have following values:
voxbone.Logger.log_level.INFO -- Everything goes to console
voxbone.Logger.log_level.ERROR -- Only errors are sent to console
voxbone.Logger.log_level.NONE  -- No logs are sent to console
