document.addEventListener('DOMContentLoaded', function() {

    var socket = io.connect('wss://' + window.location.hostname + ':' + location.port, {
        secure: true,
        multiplex: false,
        pingTimeout: 60000,
        transports: ['websocket']
    });
    var video = document.querySelector('video');

    var configuration = {  
        "iceServers": [{ "url": "stun:stun.1.google.com:19302" }] // Google STUN server
    };

    var pc = new RTCPeerConnection(configuration);

    socket.on('offer', (description) => {
        pc.setRemoteDescription(description)
        .then(() => pc.createAnswer())
        .then(answer => pc.setLocalDescription(answer))
        .then(() => socket.emit('answer', pc.localDescription));
    });

    socket.on('new-ice-candidate', (candidate) => {
        pc.addIceCandidate(candidate);
    });

    pc.ontrack = event => {
        // don't set srcObject again if it is already set.
        if (video.srcObject) return;

        video.srcObject = event.streams[0]; // video element will display the incoming stream
    };
});