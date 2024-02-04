// camera.js
var video = document.querySelector('video');
var socket = io.connect(window.location.protocol + '//' + window.location.hostname + ':' + location.port, {
    secure: true,
    multiplex: false
});

// Convert DataURI to Blob
function dataURItoBlob(dataURI) {
    var byteString = atob(dataURI.split(',')[1]);
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
    var arrayBuffer = new ArrayBuffer(byteString.length);
    var _ia = new Uint8Array(arrayBuffer);
    for (var i = 0; i < byteString.length; i++) {
        _ia[i] = byteString.charCodeAt(i);
    }
    var dataView = new DataView(arrayBuffer);
    var blob = new Blob([dataView], { type: mimeString });
    return blob;
}

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
            var blob = dataURItoBlob(data);
            var reader = new FileReader();
            reader.onload = function() {
                var arrayBuffer = this.result;
                socket.emit('stream', arrayBuffer);
            };
            reader.readAsArrayBuffer(blob);
        }, 1000 / 30); // 30 fps
    };
}).catch(function(err) {
    console.log(err.name + ": " + err.message);
});