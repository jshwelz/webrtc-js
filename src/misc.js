/**
 * Part of this code was taken from the JsSIP source code
 * and modified a bit to make it run as wanted
 */

var T1 = 500,
    T2 = 4000,
    T4 = 5000;


var Timers = {
    T1: T1,
    T2: T2,
    T4: T4,
    TIMER_B: 64 * T1,
    TIMER_D: 0 * T1,
    TIMER_F: 64 * T1,
    TIMER_H: 64 * T1,
    TIMER_I: 0 * T1,
    TIMER_J: 0 * T1,
    TIMER_K: 0 * T4,
    TIMER_L: 64 * T1,
    TIMER_M: 64 * T1,
    PROVISIONAL_RESPONSE_INTERVAL: 60000  // See RFC 3261 Section 13.3.1.1
};

/**
 * Handle SessionTimers for an incoming INVITE or UPDATE.
 * @param  {IncomingRequest} request
 * @param  {Array} responseExtraHeaders  Extra headers for the 200 response.
 */
function handleSessionTimersInIncomingRequest(request, responseExtraHeaders) {
    if (!this.sessionTimers.enabled) { return; }

    var session_expires_refresher;

    if (request.session_expires && request.session_expires >= JsSIP.C.MIN_SESSION_EXPIRES) {
        this.sessionTimers.currentExpires = request.session_expires;
        session_expires_refresher = request.session_expires_refresher || 'uas';
    }
    else {
        this.sessionTimers.currentExpires = this.sessionTimers.defaultExpires;
        session_expires_refresher = 'uas';
    }

    responseExtraHeaders.push('Session-Expires: ' + this.sessionTimers.currentExpires + ';refresher=' + session_expires_refresher);

    this.sessionTimers.refresher = (session_expires_refresher === 'uas');
    runSessionTimer.call(this);
}

/**
 * Handle SessionTimers for an incoming response to INVITE or UPDATE.
 * @param  {IncomingResponse} response
 */
function handleSessionTimersInIncomingResponse(response) {
    if (!this.sessionTimers.enabled) { return; }

    var session_expires_refresher;

    if (response.session_expires && response.session_expires >= JsSIP_C.MIN_SESSION_EXPIRES) {
        this.sessionTimers.currentExpires = response.session_expires;
        session_expires_refresher = response.session_expires_refresher || 'uac';
    }
    else {
        this.sessionTimers.currentExpires = this.sessionTimers.defaultExpires;
        session_expires_refresher = 'uac';
    }

    this.sessionTimers.refresher = (session_expires_refresher === 'uac');
    runSessionTimer.call(this);
}

function runSessionTimer() {
    var self = this;
    var expires = this.sessionTimers.currentExpires;

    this.sessionTimers.running = true;

    clearTimeout(this.sessionTimers.timer);

    // I'm the refresher.
    if (this.sessionTimers.refresher) {
        this.sessionTimers.timer = setTimeout(function () {
            if (self.status === JsSIP.C.STATUS_TERMINATED) { return; }

            sendUpdate.call(self, {
                eventHandlers: {
                    succeeded: function (response) {
                        handleSessionTimersInIncomingResponse.call(self, response);
                    }
                }
            });
        }, expires * 500);  // Half the given interval (as the RFC states).
    }

    // I'm not the refresher.
    else {
        this.sessionTimers.timer = setTimeout(function () {
            if (self.status === JsSIP.C.STATUS_TERMINATED) { return; }

            self.terminate({
                cause: JsSIP_C.causes.REQUEST_TIMEOUT,
                status_code: 408,
                reason_phrase: 'Session Timer Expired'
            });
        }, expires * 1100);
    }
}


function setInvite2xxTimer(request, body) {
    var
        self = this,
        timeout = Timers.T1;

    this.timers.invite2xxTimer = setTimeout(function invite2xxRetransmission() {
        if (self.status !== JsSIP.C.STATUS_WAITING_FOR_ACK) {
            return;
        }

        request.reply(200, null, ['Contact: ' + self.contact], body);

        if (timeout < Timers.T2) {
            timeout = timeout * 2;
            if (timeout > Timers.T2) {
                timeout = Timers.T2;
            }
        }
        self.timers.invite2xxTimer = setTimeout(
            invite2xxRetransmission, timeout
        );
    }, timeout);
}


/**
 * RFC3261 14.2
 * If a UAS generates a 2xx response and never receives an ACK,
 *  it SHOULD generate a BYE to terminate the dialog.
 */
function setACKTimer() {
    var self = this;

    this.timers.ackTimer = setTimeout(function () {
        if (self.status === JsSIP.C.STATUS_WAITING_FOR_ACK) {
            clearTimeout(self.timers.invite2xxTimer);
            sendRequest.call(self, JsSIP.C.BYE);
            ended.call(self, 'remote', null, JsSIP.C.causes.NO_ACK);
        }
    }, Timers.TIMER_H);
}

function ended(originator, message, cause) {
    this.end_time = new Date();

    this.close();
    this.emit('ended', {
        originator: originator,
        message: message || null,
        cause: cause
    });
}
