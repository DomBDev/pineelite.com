// camera.js
var video = document.querySelector('video');
var socket = io.connect('https://' + window.location.hostname + ':443');

navigator.mediaDevices.getUserMedia({ video: true, audio: false })
.then(function(stream) {
    video.srcObject = stream;
    video.onloadedmetadata = function(e) {
        video.play();
        var canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        var context = canvas.getContext('2d');
        setInterval(function() {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            var data = canvas.toDataURL('image/jpeg');
            socket.emit('stream', data);
        }, 1000 / 30); // 30 fps
    };
})
.catch(function(err) {
    console.log(err.name + ": " + err.message);
});