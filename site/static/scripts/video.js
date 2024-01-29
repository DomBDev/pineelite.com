var pc = new RTCPeerConnection({
    iceServers: [
        {
            urls: 'stun:stun.l.google.com:19302'
        }
    ]
});
var socket = io();

pc.onicecandidate = function(event) {
    if (event.candidate) {
        socket.emit('candidate', event.candidate.toJSON());
    }
};

pc.ontrack = function(event) {
    var el = document.createElement(event.track.kind);
    el.srcObject = event.streams[0];
    el.autoplay = true;
    el.controls = true;

    document.getElementById('video-container').appendChild(el);
};

socket.on('answer', function(data) {
    pc.setRemoteDescription(new RTCSessionDescription(data));
});

socket.on('candidate', function(data) {
    pc.addIceCandidate(new RTCIceCandidate(data));
});

// Create an offer and set it as the local description
pc.createOffer().then(function(offer) {
    return pc.setLocalDescription(offer);
}).then(function() {
    socket.emit('offer', pc.localDescription.toJSON());
}).catch(console.error);