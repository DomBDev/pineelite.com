var socket = io.connect('wss://' + window.location.hostname + ':' + location.port, {
    secure: true,
    pingTimeout: 60000,
    transports: ['websocket']
});

var video = document.querySelector('video');

var configuration = {  
  "iceServers": [{ "url": "stun:stun.1.google.com:19302" }] // Google STUN server
};

var pc = new RTCPeerConnection(configuration);

// Queue to store ICE candidates before the remote description is set
var iceCandidateQueue = [];

socket.on('connect', function() {
    navigator.mediaDevices.getUserMedia({video: true, audio: false})
   .then(function(stream) {
       video.srcObject = stream;
       stream.getTracks().forEach(track => pc.addTrack(track, stream));
       return pc.createOffer();
   })
   .then(offer => pc.setLocalDescription(offer))
   .then(() => socket.emit('offer', pc.localDescription))
   .catch(function(err) {
       console.log(err.name + ": " + err.message);
   });
});

pc.onicecandidate = event => {
    if(event.candidate) {
        socket.emit('new-ice-candidate', event.candidate);
    }
};

// Handle 'answer' event
socket.on('answer', function(answer) {
    pc.setRemoteDescription(new RTCSessionDescription(answer))
    .then(() => {
        // Add the ICE candidates from the queue to the RTCPeerConnection
        while (iceCandidateQueue.length) {
            var candidate = iceCandidateQueue.shift();
            pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });
});

// Handle 'new-ice-candidate' event
socket.on('new-ice-candidate', function(candidate) {
    if (pc.remoteDescription) {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
        // If the remote description is not set, add the candidate to the queue
        iceCandidateQueue.push(candidate);
    }
});