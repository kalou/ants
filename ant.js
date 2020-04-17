// CC BY-SA
// Ant globals: sprite data
// CORS issues dev avoided with ~ python -m SimpleHTTPServer 8000
const BOX=384;

function max(a, b) {
    return a < b ? b : a;
}
function min(a, b) {
    return a > b ? b : a;
}

//XXX should have some onload logic
var Images = {
};

function loadImage(name) {
    var img = new Image();
    img.src = 'sprites/' + name + '.png';
    Images[name] = img;
    return img;
}

loadImage('finish');
loadImage('body');
loadImage('head');
loadImage('head_rad');
loadImage('head_lad');
var legs = new Array();
for (var i = 0; i < 8; i++) {
    loadImage('legs' + i);
}

function rotate(ctx, x, y, width, height, times) {
    // Image needs to be square
    // This gets the raw data, and swaps the image in place
    // In a rotation (x,y) becomes (N-y, x)
    // With x=i%N, y=i//N -> tx=N-i//n, ty=i%N -> ti = N*(ty)+tx
    var data = ctx.getImageData(x, y, width, height);
    var newData = new ImageData(data.width, data.height);

    for (i = 0; i < data.width * data.height; i ++) {
        var new_i = i;
        for (j = 0; j < times; j++) {
            new_i = data.width * (new_i % data.width) +
                data.width - Math.floor(new_i / data.width) - 1;
        }
        // XXX I want to access this array as an Int32 one instead
        newData.data[new_i*4] = data.data[i*4];
        newData.data[new_i*4 + 1] = data.data[i*4 + 1];
        newData.data[new_i*4 + 2] = data.data[i*4 + 2];
        newData.data[new_i*4 + 3] = data.data[i*4 + 3];
    }

    ctx.putImageData(newData, x, y);
}

// We do virtual sprites combos for bad reason- for cpu fan noise reasons
// we we pre-render all of it
function drawSprite(ctx, name, scale) {
    if (name.startsWith('ant')) {
        ctx.drawImage(Images['body'], 0, 0, 128/scale, 128/scale);
        switch(name.substr(4, 3)) {
            case 'lad':
                ctx.drawImage(Images['head_lad'], 0, 0, 128/scale, 128/scale);
                break;
            case 'rad':
                ctx.drawImage(Images['head_rad'], 0, 0, 128/scale, 128/scale);
                break;
            case 'nad':
                ctx.drawImage(Images['head'], 0, 0, 128/scale, 128/scale);
                break;
        }
        ctx.drawImage(Images['legs' + name.substr(8, 1)], 0, 0,
            128/scale, 128/scale);
    } else {
        ctx.drawImage(Images[name], 0, 0, 128/scale, 128/scale);
    }
}

function loadSprite(ctx, name, scale) {
    console.log('Initial load for ' + name + ' scale ' + scale);
    var ret = [];

    // Ret has 4 rotations
    ctx.clearRect(0, 0, 128, 128);
    drawSprite(ctx, name, scale);
    ret.push(ctx.getImageData(0, 0, 128/scale, 128/scale));

    for (var i = 0; i < 3; i++) {
        rotate(ctx, 0, 0, 128/scale, 128/scale, 1);
        ret.push(ctx.getImageData(0, 0, 128/scale, 128/scale));
    }
    ctx.clearRect(0, 0, 128, 128);

    return ret;
}

var spritesCache = {};

function drawImage(name, ctx, x, y, scale, rotated)
{
    var sprites;

    if (!(scale in spritesCache)) {
        spritesCache[scale] = {};
    }

    if (name in spritesCache[scale]) {
        sprites = spritesCache[scale][name];
    } else {
        sprites = loadSprite(ctx, name, scale);
        spritesCache[scale] = Object.assign(spritesCache[scale], {
            [name]: sprites
        });
    }
    ctx.putImageData(sprites[rotated], x, y);
}


function veccmp(a, b) {
    // comments? :)
    return !(a[0] == b[0] && a[1] == b[1]);
}

function turnLeft(a) {
    return [-a[1], a[0]];
}

function turnRight(a) {
    return [a[1], -a[0]];
}

function collides(objA, objB) {
    return (objA.pos[0] < objB.pos[0] + objB.width &&
        objA.pos[0] + objA.width > objB.pos[0] &&
        objA.pos[1] < objB.pos[1] + objB.height &&
        objA.pos[1] + objA.height > objB.pos[1]);
}

function Finish(x, y, scale) {
    this.pos = [x, y];
    console.log('Finish is at ' + this.pos);
    this.width = this.height = 128/scale;
    this.scale = scale;
    this.type = F;
}

Finish.prototype = {
    render(scene, ctx) {
        ctx.clearRect(this.pos[0], this.pos[1],
            128/this.scale, 128/this.scale);
        drawImage('finish', ctx, this.pos[0], this.pos[1], this.scale, 0);

        return [this.pos[0], this.pos[1]];
    }
}

function Ant(x, y, scale) {
    this.pos = [x, y];
    this.scale = scale; // Experiments
    this.width = this.height = 128/scale;
    this.type = A;

    this.tick = 0; // HZ counter (60?) time based?

    this.lad = 0; // Antenna down (counters)
    this.rad = 0;


    this.altering = 0; // We can only make so many moves

    this.looking = 0; // -1 left, 1 right
    this.going = [1, 0]; // Our intent
    this.vector = [1, 0]; // Our current vector

    this.boost = 0;
    this.base_speed = 2; // Gnnn
    this.speed = 0;
}

Ant.prototype = {
    goRight() {
        this.going = [1,0];
    },

    goLeft() {
        this.going = [-1,0];
    },

    goUp() {
        this.going = [0,-1];
    },

    goDown() {
        this.going = [0,1];
    },

    speedBoost() {
        this.boost = 314;
    },

    turnLeft() {
        this.vector = turnLeft(this.vector);
    },

    turnRight() {
        this.vector = turnRight(this.vector);
    },

    brain(scene) {
        // Decide what to do
        // For now: chaos
        rnd = Math.random();
        if (rnd < .01) {
            this.going = turnLeft(this.vector);
        } else if (rnd > .99) {
            this.going = turnRight(this.vector);
        }

        // I want to go all the time
        this.base_speed = 3;
    },

    goTowards(x, y) {
        this.target = [x, y];
    },

    maybeChangeGoing() {
        if (typeof(this.target) == 'undefined')
            return;

        var [x, y] = this.target;
        var diff = [x - this.pos[0], y - this.pos[1]];

        if (Math.abs(diff[0]) < 5 && Math.abs(diff[1]) < 5) {
            this.target = undefined;
            return;
        }

        var change_going;
        if (Math.abs(diff[0]) > Math.abs(diff[1])) {
            change_going = [Math.sign(diff[0]), 0];
        } else {
            change_going = [0, Math.sign(diff[1])];
        }

        if (veccmp(this.going, change_going))
            this.altering = 15;

        this.going = change_going;
    },

    //touch devices
    maybeAlterDirection() {
        if (this.altering-- > 0) {
            return;
        }

        if (veccmp(this.going, this.vector)) {
            // Slow down
            this.speed = max(this.speed - 1, 0);

            // If we can go there in just one turn, do
            if (!veccmp(turnRight(this.vector), this.going) ||
                !veccmp(turnLeft(this.vector), this.going)) {
                this.vector = this.going;
            } else {
                // There's only this fast we can pick adapting moves
                this.altering = 5;

                var rnd = Math.random();
                if (rnd > .5) {
                    this.turnRight();
                } else {
                    this.turnLeft();
                }
            }
        }
    },

    move(scene) {
        // Speed
        this.speed = this.base_speed;
        if (this.boost > 0) {
            this.boost -= 10;
            this.speed = this.base_speed + 10 * Math.sin(this.boost / 100);
        }

        // Are we moving?
        this.maybeChangeGoing();
        this.maybeAlterDirection();

        // Random antenna movements
        var rnd = Math.random();
        if (rnd > .99) {
            this.rad = 5;
        } else if (rnd < .01) {
            this.lad = 5;
        }

        // But only for a small moment
        if (this.lad > 0)
            this.lad -= 1;

        if (this.rad > 0)
            this.rad -= 1;

        // Move according to vector
        saved_pos = this.pos;
        this.pos = this.next_xy(this.speed);

        if (this.collides(scene)) {
            this.stuck = true;
            this.pos = saved_pos;
            return;
        }

        this.stuck = false;
    },

    collides(scene) {
        // Figure out collisions
        return scene.collisions(this).some(other => {
            // Don't collide with self
            if (other == this)
                return false;

            switch(other.type) {
                case A:
                    if (this.type == P)
                        scene.die();
                case W:
                case P:
                    return true;
                case F:
                    if (this.type == P)
                        scene.win();
                    return true;
                    // else what could happen to ants?
                default:
                    return false;
            }
        });
    },

    next_xy(speed) {
        return [this.pos[0] + this.vector[0] * speed,
            this.pos[1] + this.vector[1] * speed];
    },

    render(scene, ctx) {
        // Alterations should decrease
        // Frame .. only drawing in here
        // Jump right at speed=2
        if (this.speed == 1)
            this.speed++;

        // If we're stuck, don't animate legs
        if (!this.stuck)
            this.tick += this.speed;

        var frame = Math.round(this.tick / 10) % 8;

        // If stopped I want a specific frame
        if (this.speed == 0) {
            frame = 1;
        }

        ctx.clearRect(this.pos[0], this.pos[1],
            128/this.scale, 128/this.scale);

        this.move(scene);

        var rot = {
            '0,0': 0,
            '0,-1': 0,
            '1,0': 1,
            '0,1': 2,
            '-1,0': 3
        }[this.vector.join()];

        // Head movement is random
        if (this.rad > 0) {
            drawImage('ant_rad_' + frame, ctx, this.pos[0], this.pos[1],
                this.scale, rot);
        } else if (this.lad > 0) {
            drawImage('ant_lad_' + frame, ctx, this.pos[0], this.pos[1],
                this.scale, rot);
        } else {
            drawImage('ant_nad_' + frame, ctx, this.pos[0], this.pos[1],
                this.scale, rot);
        }
        return [this.pos[0], this.pos[1]];
    }
}

function Player(x, y, scale) {
    Ant.call(this, x, y, scale);
    this.type = P;
}

Player.prototype = Object.create(Ant.prototype);

function Scene(ctx) {
    this.ctx = ctx;
    this.lives = 3;
    this.score = 42;
    this.bonus = 0;
    this.level = 0;
    this.ants = [];
}

function Wall(x, y, scale) {
    this.pos = [x, y];
    this.width = this.height = 128/scale;
    this.type = W;
}

// EMPTY, ANT, PLAYER, WALL
const E=0;
const P=1;
const A=2;
const F=3;
const W=99;

const WON=101;
const DEAD=102;

Scene.prototype = {
    collisions(obj) {
        // Fake walls around scene
        if ((obj.pos[0] < 0) || (obj.pos[1] < 0) ||
            (obj.pos[0] >= BOX - obj.width) || (obj.pos[1] >= BOX - obj.height))
            return [new Wall(0,0,0)];

        // Returns an array of collided objects for me
        // X: this is O(N^2) -- well.
        return this.gameObjects.filter((x) => x != obj).filter((target) => {
            return collides(obj, target);
        });
    },
    displayMessage(title, msg, andthen) {
        message = document.getElementById("message");
        message.innerHTML = '<h1>' + title + '</h1>' +
            '<p>' + msg + '</p>';
        this.modal = document.getElementById("modal");
        this.modal.style.display = "block";
        this.renderScores();
        this.after_modal = andthen;
    },
    load(level) {
        // A scene is square.
        // A scene definition has:
        // Nothing (...)
        // Player (my ant)
        // Ants ("IA" shit)
        // Scale is computed by how many cells in the array
        // depending on the canvas size.
        // The reference sprite is 128x128 and the canvas size is BOXxBOX
        //
        this.ctx.clearRect(0, 0, BOX, BOX);

        this.displayMessage(level['title'], level['msg']);

        this.bonus = level['bonus'];
        this.done = undefined;

        var array = level['tiles'];

        this.scale = Math.ceil(128 * array.length / BOX);
        this.gameObjects = [];

        // Create a wall around the scene
        array.forEach((rowobj, row) => {
            rowobj.forEach((kind, col) => {
                var obj;
                switch(kind) {
                    case A:
                        obj = new Ant((128/this.scale) * col,
                            (128/this.scale) * row, this.scale);
                        break;
                    case E:
                        //
                        break;
                    case P:
                        obj = this.player = new Player((128/this.scale) * col,
                            (128/this.scale) * row, this.scale);
                        break;
                    case W:
                        obj = new Wall((128/this.scale) * col,
                            (128/this.scale) * row, this.scale);
                    case F:
                        obj = new Finish((128/this.scale) * col,
                            (128/this.scale) * row, this.scale);
                }
                if (typeof(obj) != 'undefined')
                    this.gameObjects.push(obj);
            });
        });
    },

    removeMessage() {
        if (this.modal) {
            this.modal.style.display = "none";
            this.modal = undefined;
            if (this.after_modal) {
                this.after_modal();
            }
        }
    },
    touch(x, y) {
        this.player.goTowards(x, y);
    },
    up() {
        this.player.goUp();
    },
    down() {
        this.player.goDown();
    },
    left() {
        this.player.goLeft();
    },
    right() {
        this.player.goRight();
    },
    enter() {
        this.removeMessage();
    },
    space() {
        if (this.bonus > 0) {
            this.bonus -= 10;
            this.player.speedBoost();
        }
    },
    win() {
        this.done = WON;
        this.score += this.bonus;
        this.bonus = 0;
    },
    die() {
        this.done = DEAD;
    },
    reset() {
        this.level = 0;
        this.bonus = 0;
        this.lives = 3;
        this.score = 42;
    },
    restartWith(title, msg) {
       this.load({
            'title': title,
            'msg': msg,
            'tiles': levels[this.level].tiles,
            'bonus': levels[this.level].bonus
        });
    },
    renderScores() {
        document.getElementById('level').innerHTML = this.level;
        document.getElementById('bonus').innerHTML = this.bonus;
        document.getElementById('score').innerHTML = this.score;
        document.getElementById('lives').innerHTML = this.lives;
    },
    render() {
        if (this.modal) {
            return;
        }

        this.renderScores();

        this.gameObjects.forEach((obj) => {
            switch(obj.type) {
                case A:
                    obj.brain(this);
                    break;
            }
            obj.render(this, this.ctx);
        });

        if (this.bonus > 0)
            this.bonus -= 1;

        if (this.done == WON) {
            var lev = levels[++this.level];
            if (typeof(lev) == 'undefined') {
                var msg = "Ahem.. I need to add levels.. do it again? You'll keep your score";
                this.level = 1;
                this.restartWith('Oh wow look at you!', msg);
            } else this.load(lev);
        }

        if (this.done == DEAD) {
            if (--this.lives <= 0) {
                this.displayMessage("Game over", "You caught a bad flu and you died. Your score is <b>" + this.score + "</b>, but can do better than dying at level " + this.level + "! You'll miss the insane million dollar scenes and special effects we invested in for the last level!", () => {
                    this.reset();
                    this.level = 1;
                    this.load(levels[1]);
                });
            } else {
                this.restartWith("Oh noes, infected!", "Here, it's OK, you just lost a life. Take some chloroquine - try this level again");
            }
        }
    }
}

// Global scene
var scene;

const LEFT=37;
const UP=38;
const RIGHT=39;
const DOWN=40;
const SPACE=32;
const ESC=27;
const ENTER=13;

window.addEventListener("keydown", function (e) {
    e.preventDefault();
    switch(e.keyCode) {
        case LEFT:
            scene.left();
            break;
        case RIGHT:
            scene.right();
            break;
        case UP:
            scene.up();
            break;
        case DOWN:
            scene.down();
            break;
        case SPACE:
            scene.space();
            console.log('Player at ' + scene.player.pos);
            break;
        case ESC:
            // Start over
            scene.reset();
            scene.load(lev0, true);
            break;
        case ENTER:
            scene.enter();
            break;
    }
}, false);

window.addEventListener('touchstart', function(e) {
    e.preventDefault();
	if (e.touches[1])
        scenes.enter();
    scene.touch(e.touches[0].clientX, e.touches[0].clientY);
});

window.addEventListener('click', function(e) {
    e.preventDefault();
    scene.touch(e.clientX, e.clientY);
});

window.addEventListener('touchmove', function(e) {
    e.preventDefault();
});


window.onload = function () {
    var canvas = document.getElementsByTagName('canvas')[0],
        context = canvas.getContext('2d');
    canvas.width = BOX;
    canvas.height = BOX;

    context.lineWidth = 4;

    scene = new Scene(context);

    scene.load(lev0, true);

    var loop = function() {
        scene.render();

        window.requestAnimationFrame(loop);
    }

    window.requestAnimationFrame(loop);
};

// Levels
var lev0 = {
    'title': 'Welcome!',
    'msg': "You control that ant with the arrow keys or sort of by touch. Let's see if you can guess the rest OK.<br>Press enter to dismiss these messages or press with two fingers.",
    'bonus': 100,
    'tiles': [
        [E, E, E, E, E, E],
        [E, E, E, E, E, E],
        [E, E, P, E, E, E],
        [E, E, E, E, E, E],
        [E, E, E, E, E, E],
        [E, E, E, F, E, E],
    ]
};

var levels = [lev0];

levels.push({
    'title': 'Great',
    'msg': "Now there are two sorts of ants. Sick ants, and you. If you touch a sick ant, you die. Press enter (or two-finger tap).",
    'bonus': 100,
    'tiles': [
        [E, E, E, E, A, E],
        [E, E, E, E, E, E],
        [F, F, F, F, F, F],
        [E, E, E, E, E, E],
        [E, P, E, E, E, E],
        [E, E, E, E, E, E],
    ]

});

levels.push({
    'title': 'What!?',
    'msg': "This level was a joke. So you figured it's a bit of a stretch to guess which ant you are, and which ones are sick, cause I ran out of money for the cheap sprite designer so they all look the same. This is no joke, there's a bad virus out there, you touch an ant, you really die. There will be no shelter in place for the next level.",
    'bonus': 100,
    'tiles': [
        [E, E, E, E, A, E],
        [E, E, E, E, E, E],
        [E, E, E, E, E, E],
        [E, E, E, E, F, E],
        [E, P, E, E, E, E],
        [E, E, E, E, E, E],
    ]

});

levels.push({
    'title': 'Got it!?',
    'msg': "I suppose you got it - Feel free to send money to kalou at this domain so I can afford a sprite designer. If you want to pay me large sums of money so I never work in the game industry the above email also works.",
    'bonus': 100,
    'tiles': [
        [E, E, E, E, A, E],
        [E, P, E, E, E, E],
        [E, E, E, E, E, E],
        [E, E, E, E, E, E],
        [E, E, E, A, E, E],
        [E, E, E, F, E, E],
    ]

});


levels.push({
    'title': "Bravo!",
    'msg': "Ants are small. Will you figure out your ant and the exit in this smaller world without your reading glasses? Press enter to find out.",
    'bonus': 400,
    'tiles': [
       [P, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, A, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, A, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, A, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, F],
       [E, E, E, E, E, E, E, E, E, E, E, E],
    ]
});

levels.push({
    'title': "Cheers..",
    'msg': "More ants - and the next level will be really cool!",
    'bonus': 400,
    'tiles': [
       [P, E, E, E, E, E, E, E, A, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, A, E, E, E],
       [E, E, E, A, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, A, E, E, F],
       [E, E, E, E, E, E, E, E, E, E, E, E],
    ]
});

levels.push({
    'title': "You're too good!",
    'msg': "Did you consider playing competitive ants? Let me make them smaller.",
    'bonus': 400,
    'tiles': [
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, A, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, A, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, A, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, F],
       [E, E, E, E, P, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
    ]
});

levels.push({
    'title': "Add some anties!",
    'msg': "How do you perform during peak ant time",
    'bonus': 400,
    'tiles': [
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, A, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, A, E, E, E, E, E, E, E, E, E, E, A, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, A, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, A, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, F],
       [E, E, E, E, P, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, A, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
    ]
});

levels.push({
    'title': "Are you beating the high score?",
    'msg': "It's getting a bit tough here",
    'bonus': 400,
    'tiles': [
       [P, E, E, E, E, E, E, E, A, E, E, E],
       [E, E, E, E, E, E, A, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, A, E, E, E],
       [E, E, E, A, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, A, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, A, E, E, E, E, A, E, E, F],
       [E, E, E, E, E, E, E, E, E, E, E, E],
    ]
});


levels.push({
    'title': 'Mega Boss level',
    'msg': "Sorry if your fan makes noise! Can you win this one? Hint: figure out where you start, and it'll be easy",
    'bonus': 2500,
    'tiles': [
       [E, E, E, E, E, E, E, E, E, E, E, E, P, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, A, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, A, E, E, E],
       [E, E, E, A, E, E, E, E, E, E, E, E, E, E, A, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, A, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, A, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, A, E, A, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, F],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, A, E, E, E, E, E, A, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, A, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, A, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, A, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
       [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
    ]
});
