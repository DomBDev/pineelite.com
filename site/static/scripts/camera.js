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

// Get the camera stream
navigator.mediaDevices.getUserMedia({video: true, audio: true})
.then(stream => {
    // Display the local stream in the video element
    video.srcObject = stream;

    // Add the tracks from the stream to the RTCPeerConnection
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
})
.catch(function(err) {
    console.log(err.name + ": " + err.message);
});

// Handle 'offer' event
socket.on('offer', function(offer) {
    pc.setRemoteDescription(new RTCSessionDescription(offer))
    .then(() => pc.createAnswer())
    .then(answer => pc.setLocalDescription(answer))
    .then(() => {
        // Add the ICE candidates from the queue to the RTCPeerConnection
        while (iceCandidateQueue.length) {
            var candidate = iceCandidateQueue.shift();
            pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    })
    .then(() => socket.emit('answer', pc.localDescription))
    .catch(function(err) {
        console.log(err.name + ": " + err.message);
    });
});

pc.onicecandidate = event => {
    if(event.candidate) {
        socket.emit('new-ice-candidate', event.candidate);
    }
};

// Handle 'new-ice-candidate' event
socket.on('new-ice-candidate', function(candidate) {
    if (pc.remoteDescription) {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
        // If the remote description is not set, add the candidate to the queue
        iceCandidateQueue.push(candidate);
    }
});