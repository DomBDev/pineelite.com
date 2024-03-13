var player_id = ""
var connections = {};
var own_sprite = false;

// Game code

var GameState = {
    create: function() {
        this.players = {};
        // Create the game world
        this.physics.world.setBounds(0, 0, 800, 600);
    
        // Create the background sprites
        this.background = this.add.image(0, 0, 'background');
    
        // Create the player sprite
        this.player = this.physics.add.sprite(0, 0, 'player');
        this.own_sprite = true;
        this.user_id = this.add.text(0, -50, player_id, { fontFamily: 'Georgia, "Goudy Bookletter 1911", Times, serif' });
        this.player.setScale(0.1);
        this.cameras.main.startFollow(this.player); // Enable camera follow
    
        // Create the player controls
        this.cursors = this.input.keyboard.createCursorKeys();
    
        // Set the player anchor to the center of the sprite
        this.player.setOrigin(0.5, 0.5);

        this.frame = 0;

        this.socket = io('/game');
        this.peer = new Peer();

        var socket = this.socket;
        var peer = this.peer;

        peer.on('open', function(id) {
            player_id = id;
            socket.emit('join', player_id);
            if (!this.players) {
                this.players = {};
            }
            this.players[player_id] = {};
        });

        peer.on('connection', function(conn) {
            console.log("Connection established with: ", conn.peer);
            if (Object.keys(this.players).includes(conn.peer) === false) {
                this.players[conn.peer] = {};
            }
            this.players[conn.peer]['last_update'] = new Date().getTime();

            if (Object.keys(this.players).includes(conn.peer) === false) {
                this.players[conn.peer] = {};
            }

            conn.on('data', function(data) {
                if (Object.keys(this.players).includes(conn.peer)) {
                    this.players[data.id]['location'] = data['location']
                    this.players[data.id]['last_update'] = new Date().getTime();
                }
                if (Object.keys(this.players[data.id]).includes('sprite') === false && this.own_sprite) {
                    console.log("Creating sprite for: ", data.id)
                    this.players[data.id]['sprite'] = this.physics.add.sprite(data.location.x, data.location.y, 'player');
                    this.players[data.id]['sprite_text'] = this.add.text(data.location.x, data.location.y - 50, data.id, { fontFamily: 'Georgia, "Goudy Bookletter 1911", Times, serif' });
                    this.players[data.id]['sprite'].setScale(0.1);
                }
            });

        });

        socket.on('player_join', function(data) {
            if (this.players) {
            connections[data] = peer.connect(data);
            this.players[data] = {};
            } else {
                this.players = {};
                connections[data] = peer.connect(data);
                this.players[data] = {};
            }
        });

        socket.on('player_leave', function(data) {
            remove_player(data);
        });

        socket.on('player_list', function(data) {
            for (var i = 0; i < data.length; i++) {
                if (data[i] !== player_id) {
                    connections[data[i]] = peer.connect(data[i]);
                }
            }
        });


        $(window).on('focus', function() {
            console.log("Window focused")
            socket.emit('join', player_id);
        });

        $(window).on('blur', function() {
            console.log("Window blurred")
            socket.emit('player_leave', player_id);
        });

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

        this.user_id.x = this.player.x;
        this.user_id.y = this.player.y - 50;
        this.user_id.text = player_id;

        // Update Existing this.players
        for (var player in this.players) {
            if (player !== player_id) {
                if (Object.keys(this.players[player]).includes('sprite') === true && Object.keys(this.players[player]).includes('location') === true) {
                    this.players[player]['sprite'].x = this.players[player]['location']['x'];
                    this.players[player]['sprite'].y = this.players[player]['location']['y'];
                    this.players[player]['sprite_text'].x = this.players[player]['location']['x'];
                    this.players[player]['sprite_text'].y = this.players[player]['location']['y'] - 50;
                    this.players[player]['sprite_text'].text = player;
                }
            }
        }

        // remove inactive this.players
        for (var player in this.players) {
            if (player !== player_id) {
                if (new Date().getTime() - this.players[player]['last_update'] > 5000) {
                    console.log("Removing player due to innactivity: ", player)
                    remove_player(player);
                }
            }
        }
    
        // Send player data to other this.players
        if (this.player) {
            sendPlayerData({
                id: player_id,
                location: {
                    x: this.player.x,
                    y: this.player.y
                }
            });
        }
    }
};

function remove_player(player_id) {
    console.log("Removing player: ", player_id)
    if (Object.keys(this.players).includes(player_id) === true) {
        if (Object.keys(this.players[player_id]).includes('sprite') === true) {
            this.players[player_id]['sprite'].destroy();
            this.players[player_id]['sprite_text'].destroy();
        }
        delete this.players[player_id];
    }
    if (Object.keys(connections).includes(player_id) === true){
        connections[player_id].close();
        delete connections[player_id];
    }
}

function sendPlayerData(data) {
    // id, location(x,y)
    for (var key in connections) {
        if (key === player_id) {
            continue;
        }
        if (key === "" || key === undefined) {
            continue;
        }
    
        connections[key].send(data);
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