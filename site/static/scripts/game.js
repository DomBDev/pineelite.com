

// Multiplayer code
var players = {};
var socket = io('/game');
var peer = new Peer();
var player_id = ""
var connections = {};

peer.on('open', function(id) {
    player_id = id;
    socket.emit('join', player_id);
});

peer.on('connection', function(conn) {

    conn.on('data', function(data) {
        console.log("Data from peer: ", data);
        players[data.id]['location'] = data.location;
        if (data.id !== player_id && Object.keys(players[data.id]).includes('sprite') === false) {
            players[data.id]['sprite'] = game.add.sprite(data.x, data.y, 'player');
        } else if (data.id !== player_id) {
            players[data.id]['sprite'].x = data.x;
            players[data.id]['sprite'].y = data.y;
        }
    });

});

socket.on('player_join', function(data) {
    if (data !== player_id) {
        connections[data] = peer.connect(data);
        players[data] = {};
    }
});

socket.on('player_leave', function(data) {
    if (data === player_id) {
        peer.disconnect();
        return;
    }
    if (Object.keys(players).includes(data) === true){
        delete players[data];
    }
    if (Object.keys(connections).includes(data) === true){
        connections[data].close();
        delete connections[data];
    }
});

socket.on('player_list', function(data) {
    for (var i = 0; i < data.length; i++) {
        if (data[i] !== player_id) {
            connections[data[i]] = peer.connect(data[i]);
            players[data[i]] = {};
        }
    }
});

function sendPlayerData(data) {
    // id, location(x,y)
    for (var key in connections) {
        connections[key].send(data);
        console.log("Sending data to peer: ", data);
    }
}


//
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'gameCanvas',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }
        }
    },
    scene: {
        create: create,
        update: update,
    }
};

// Phaser game code
var game = new Phaser.Game(config);

var GameState = {
    create: function() {
        // Create the game world
        game.world.setBounds(0, 0, 2000, 2000); // Set the world bounds

        // Create the player sprite
        this.player = game.add.sprite(0, 0, 'player');
        game.physics.arcade.enable(this.player);
        game.camera.follow(this.player); // Enable camera follow

        // Create the player controls
        this.cursors = game.input.keyboard.createCursorKeys();

        // Set the player anchor to the center of the sprite
        this.player.anchor.setTo(0.5, 0.5);
    },
    render_player: function(data) {
        // render other players
        for (var key in players) {
            // ensure player is not the current player, and that the player doesnt already have a sprite.

        }
        
    },

    update: function() {
        // Player movement
        this.player.body.velocity.x = 0;
        this.player.body.velocity.y = 0;

        if (this.cursors.up.isDown) {
            this.player.body.velocity.y = -200;
        } else if (this.cursors.down.isDown) {
            this.player.body.velocity.y = 200;
        }

        if (this.cursors.left.isDown) {
            this.player.body.velocity.x = -200;
        } else if (this.cursors.right.isDown) {
            this.player.body.velocity.x = 200;
        }

        // Send player data to other players
        sendPlayerData({
            id: player_id,
            location: {
                x: this.player.x,
                y: this.player.y
            }
        });
        
    }
};

game.state.add('GameState', GameState);
game.state.start('GameState');