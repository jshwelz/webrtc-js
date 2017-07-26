/**
 * This SIP and failure messages were taken from the JsSIP source code
 */

var C = {
  // RTCSession states
  STATUS_NULL:               0,
  STATUS_INVITE_SENT:        1,
  STATUS_1XX_RECEIVED:       2,
  STATUS_INVITE_RECEIVED:    3,
  STATUS_WAITING_FOR_ANSWER: 4,
  STATUS_ANSWERED:           5,
  STATUS_WAITING_FOR_ACK:    6,
  STATUS_CANCELED:           7,
  STATUS_TERMINATED:         8,
  STATUS_CONFIRMED:          9,

  // End and Failure causes
  causes: {
    // Generic error causes
    CONNECTION_ERROR:         'Connection Error',
    REQUEST_TIMEOUT:          'Request Timeout',
    SIP_FAILURE_CODE:         'SIP Failure Code',
    INTERNAL_ERROR:           'Internal Error',

    // SIP error causes
    BUSY:                     'Busy',
    REJECTED:                 'Rejected',
    REDIRECTED:               'Redirected',
    UNAVAILABLE:              'Unavailable',
    NOT_FOUND:                'Not Found',
    ADDRESS_INCOMPLETE:       'Address Incomplete',
    INCOMPATIBLE_SDP:         'Incompatible SDP',
    MISSING_SDP:              'Missing SDP',
    AUTHENTICATION_ERROR:     'Authentication Error',

    // Session error causes
    BYE:                      'Terminated',
    WEBRTC_ERROR:             'WebRTC Error',
    CANCELED:                 'Canceled',
    NO_ANSWER:                'No Answer',
    EXPIRES:                  'Expires',
    NO_ACK:                   'No ACK',
    DIALOG_ERROR:             'Dialog Error',
    USER_DENIED_MEDIA_ACCESS: 'User Denied Media Access',
    BAD_MEDIA_DESCRIPTION:    'Bad Media Description',
    RTP_TIMEOUT:              'RTP Timeout'
  },

  SESSION_EXPIRES: 3600
};
