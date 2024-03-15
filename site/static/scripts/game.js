// Multiplayer code
function start_connect() {
    var retry_count = 0;
    function connect() {
        try {
            let socket = io('/game');
            let peer = new Peer();
        } catch (error) {
            console.error("Error connecting to server: ", error);
            if (retry_count < 5) {
                retry_count += 1;
                setTimeout(connect, 500);
            }
        }
        return [socket, peer];
    }
    connect();
}
var players = {};
let [socket, peer] = connect();
var player_id = ""
var connections = {};

peer.on('open', function(id) {
    player_id = id;
    socket.emit('join', player_id);
});

peer.on('connection', function(conn) {
    console.log("Connection established with: ", conn.peer);
    if (Object.keys(players).includes(conn.peer) === false) {
        players[conn.peer] = {};
    }
    players[conn.peer]['last_update'] = new Date().getTime();

    if (Object.keys(players).includes(conn.peer) === false) {
        players[conn.peer] = {};
    }

    conn.on('data', function(data) {
        if (Object.keys(data).includes('location')) {
        players[data.id]['location'] = data['location']
        }
        players[data.id]['last_update'] = new Date().getTime();
    });

});

socket.on('player_join', function(data) {
    if (data !== player_id && Object.keys(connections).includes(data) === false) {
        connections[data] = peer.connect(data);
    }
});

socket.on('player_leave', function(data) {
    console.log("Player leaving: ", data, "Player id: ", player_id)
    if (data === player_id) {
        peer.disconnect();
        return;
    }
        console.log("Removing player due to leaving: ", data)
        players[data]['sprite'].destroy();
        players[data]['sprite_text'].destroy();
        delete players[data];
    if (Object.keys(connections).includes(data) === true){
        connections[data].close();
        delete connections[data];
    }
});

socket.on('player_list', function(data) {
    for (var i = 0; i < data.length; i++) {
        if (data[i] !== player_id) {
            for (let attempt = 0; attempt < 5; attempt++) {
                try {
                    if (data[i] !== player_id) {
                        connections[data[i]] = peer.connect(data[i]);
                        if (connections[data[i]]) {
                            break;
                        }
                    }
                } catch (error) {
                    console.error(`Attempt ${attempt + 1} failed. Retrying...`);
                }
            }
        }
    }
});

function sendPlayerData(data) {
    // id, location(x,y)
    for (var key in connections) {
        if (key === player_id) {
            continue;
        }
        if (connections[key] === undefined) {
            continue;
        }
        connections[key].send(data);
    }
}

$(window).on('focus', function() {
    console.log("Window focused")
    socket.emit('join', player_id);
});

$(window).on('blur', function() {
    console.log("Window blurred")
    socket.emit('leave_game');
});

// Game code

var GameState = {
    create: function() {
        // Create the game world
        this.physics.world.setBounds(0, 0, 800, 600);
    
        // Create the background sprites
        this.background = this.add.image(0, 0, 'background');
    
        // Create the player sprite
        this.player = this.physics.add.sprite(0, 0, 'player');
        this.user_id = this.add.text(0, -50, player_id, { fontFamily: 'Georgia, "Goudy Bookletter 1911", Times, serif' });
        this.user_id.setOrigin(0.5, 0.5);
        this.player.setScale(0.1);
        this.cameras.main.startFollow(this.player); // Enable camera follow
    
        // Create the player controls
        this.cursors = this.input.keyboard.createCursorKeys();
    
        // Set the player anchor to the center of the sprite
        this.player.setOrigin(0.5, 0.5);

        this.frame = 0;

        this.oldPosition = {
            x: this.player.x,
            y: this.player.y
        };

    },

    preload: function() {
        this.load.image('background', background_sprite);
        this.load.image('player', player_sprite);
        this.load.image('other_player', enemy_sprite);
    },

    update: function() {
        this.frame += 1;
    
        // Player movement
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-160);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(160);
        } else {
            this.player.setVelocityX(0);
        }
        if (this.cursors.up.isDown) {
            this.player.setVelocityY(-160);
        } else if (this.cursors.down.isDown) {
            this.player.setVelocityY(160);
        } else {
            this.player.setVelocityY(0);
        }

        this.user_id.setX(this.player.x);
        this.user_id.setY(this.player.y - 50);
        this.user_id.text = player_id;
        for (var player in players) {
            if (Object.keys(players[player]).includes('sprite') === false && player != player_id) {
                add_player(player, this);
            } else if (Object.keys(players[player]).includes('sprite') === true && player != player_id) {
                // If player location data exists, update the player sprite location
                if (Object.keys(players[player]).includes('location')) {
                    players[player]['sprite'].setX(players[player]['location']['x']);
                    players[player]['sprite'].setY(players[player]['location']['y']);
                    players[player]['sprite_text'].setX(players[player]['location']['x']);
                    players[player]['sprite_text'].setY(players[player]['location']['y'] - 50);
                    if (players[player]['sprite'].visible === false) {
                        players[player]['sprite'].visible = true;
                        players[player]['sprite_text'].visible = true;
                    }
                }
            }
        }

        // remove inactive players
        for (var player in connections) {
            if (player !== player_id && Object.keys(players).includes(player) === true) {
                if (new Date().getTime() - players[player]['last_update'] > 1000) {
                    console.log("Removing player due to innactivity: ", player)
                    players[player]['sprite'].destroy();
                    players[player]['sprite_text'].destroy();
                    delete players[player];
                    connections[player].close();
                    delete connections[player];
                }
            }
        }

        // check if player position is defined yet
        if (this.player.x !== undefined && this.player.y !== undefined && this.player.oldPosition !== undefined) {
            // Send player data to other players
            if (this.player.x !== this.player.oldPosition.x || this.player.y !== this.player.oldPosition.y || this.frame % 10 === 0) {
                sendPlayerData({
                    id: player_id,
                    location: {
                        x: this.player.x,
                        y: this.player.y
                    }
                });
            }

        } else if (this.frame % 10 === 0) {
            sendPlayerData({
                id: player_id
            });
        }
        this.player.oldPosition = {
            x: this.player.x,
            y: this.player.y
        };
    }
};



function add_player(other_player_id, game_state) {
    console.log("player_id: ", player_id, "other_player_id: ", other_player_id)
    if (player_id === "") {
        console.log("Player not connected yet")
        return;
    }
    if (player_id == other_player_id) {
        console.log("Not adding player: ", other_player_id)
        return;
    } else {
        if (Object.keys(players).includes(other_player_id) === false) {
            console.log(players[other_player_id] + " Reset")
            players[other_player_id] = {};
        }

        if (players[other_player_id]['sprite'] === undefined) {

            console.log("Adding player: ", other_player_id)
            players[other_player_id]['sprite'] = game_state.physics.add.sprite(0, 0, 'player');
            players[other_player_id]['sprite_text'] = game_state.add.text(0, -50, other_player_id, { fontFamily: 'Georgia, "Goudy Bookletter 1911", Times, serif' });
            players[other_player_id]['sprite'].setScale(0.1);
            players[other_player_id]['sprite'].setOrigin(0.5, 0.5);
            players[other_player_id]['sprite_text'].setOrigin(0.5, 0.5);
            players[other_player_id]['sprite'].tint = 0xfa736e;
            if (Object.keys(players[other_player_id]).includes('location')) {
                players[other_player_id]['sprite'].setX(players[other_player_id]['location']['x']);
                players[other_player_id]['sprite'].setY(players[other_player_id]['location']['y']);
                players[other_player_id]['sprite_text'].setX(players[other_player_id]['location']['x']);
                players[other_player_id]['sprite_text'].setY(players[other_player_id]['location']['y'] - 50);
            } else {
                players[other_player_id]['sprite'].visible = false;
                players[other_player_id]['sprite_text'].visible = false;
            }
        }

    }
}

// Config
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
    scene: GameState
};

// Phaser game code
var game = new Phaser.Game(config);