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

pc.createOffer()
.then(offer => pc.setLocalDescription(offer) )
.then(() => socket.emit('offer', pc.localDescription));