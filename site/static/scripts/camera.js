var video = document.querySelector('video');

var configuration = {  
  "iceServers": [{ "url": "stun:stun.1.google.com:19302" }] // Google STUN server
};

var pc = new RTCPeerConnection(configuration);

navigator.mediaDevices.getUserMedia({video: true, audio: false})
.then(function(stream) {
    video.srcObject = stream;
    video.play();

    stream.getTracks().forEach(track => pc.addTrack(track, stream));
})
.catch(function(err) {
    console.log(err.name + ": " + err.message);
});

pc.onicecandidate = event => {
    if(event.candidate) {
        socket.emit('new-ice-candidate', event.candidate);
    }
};

pc.createOffer()
.then(offer => pc.setLocalDescription(offer) )
.then(() => socket.emit('offer', pc.localDescription));