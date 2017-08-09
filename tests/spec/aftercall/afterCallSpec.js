// describe("Voxbone", function() {
//   // var Voxbone = require('../../jasmine_examples/voxbone');
//   //var Voxbone = require('../../../dist/voxbone-3.0.0-b');
//   var voxbone;
//   var existingDID;
//   var nonExistingDID;
//
//   beforeEach(function() {
//     console.log('construct voxbone');
//     voxbone = new Voxbone();
//     existingDID = '883510080361'; //echo call
//     nonExistingDID = 'fakeDID';
//   });
//
//   it("should be defined", function() {
//     expect(voxbone).toBeDefined();
//   });
//   // it("should be able to call outbound", function() {
//   //   voxbone.WebRTC.call(existingDID);
//   //   expect(voxbone.WebRTC.onCall).toEqual(true);
//   //
//   //   expect(voxbone).toBeCalling(existingDID);
//   // });
//
//   describe("when call has been muted", function() {
//     beforeEach(function() {
//       console.log('start call');
//
//       voxbone.WebRTC.call(existingDID);
//       voxbone.WebRTC.mute();
//     });
//
//     it("should indicate that the call has been muted", function() {
//       expect(voxbone.WebRTC.isMuted).toBeTruthy();
//
//       //expect(voxbone).not.toBeSendingAudio();
//     });
//
//     it("should be possible to unmute", function() {
//       voxbone.WebRTC.unmute();
//       expect(voxbone.WebRTC.isMuted).toBeFalsy();
//       //expect(voxbone).toBeSendingAudio();
//     });
//
//   });
//
//   // describe("when call has been hangup", function() {
//   //   beforeEach(function() {
//   //     voxbone.WebRTC.call(existingDID);
//   //
//   //     var eventHandlers = {
//   //       'accepted': function(e) {
//   //         console.log('Call started');
//   //         voxbone.WebRTC.hangup();
//   //       }
//   //     };
//   //     voxbone.WebRTC.customEventHandler = Object.assign(voxbone.WebRTC.customEventHandler, eventHandlers);
//   //   });
//   //
//   //   it("should indicate that the call has ended", function() {
//   //     expect(voxbone.WebRTC.isMuted).toBeTruthy();
//   //
//   //     //expect(voxbone).not.toBeSendingAudio();
//   //   });
//   //
//   //   it("should be possible to call again", function() {
//   //     voxbone.WebRTC.call(existingDID);
//   //     expect(voxbone).toBeCalling();
//   //     //expect(voxbone).toBeSendingAudio();
//   //   });
//   //
//   // });
//   //
//   // // // demonstrates use of spies to intercept and test method calls
//   // // it("tells the current song if the user has made it a favorite", function() {
//   // //   spyOn(song, 'persistFavoriteStatus');
//   // //
//   // //   player.play(song);
//   // //   player.makeFavorite();
//   // //
//   // //   expect(song.persistFavoriteStatus).toHaveBeenCalledWith(true);
//   // // });
//   //
//   // describe("call", function() {
//   //   it("should throw an exception if call already started", function() {
//   //     voxbone.WebRTC.call(existingDID);
//   //
//   //     expect(function() {
//   //       voxbone.WebRTC.call(existingDID);
//   //     }).toThrowError("call already started");
//   //   });
//   // });
//   //
//   // describe("hangup", function() {
//   //   it("should throw an exception if call have not started", function() {
//   //     expect(function() {
//   //       voxbone.WebRTC.hangup();
//   //     }).toThrowError("call have not started");
//   //   });
//   // });
// });
