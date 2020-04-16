// CC BY-SA
// Ant globals: sprite data
// CORS issues dev avoided with ~ python -m SimpleHTTPServer 8000
var body = new Image();
body.src = 'sprites/body.png';

var legs = new Array();
for (var i = 0; i < 8; i++) {
    legs[i] = new Image();
    legs[i].src = 'sprites/legs' + i + '.png';
}

var heads = {};
["head_rad", "head_lad", "headR", "headL", "head"].forEach(head => {
    heads[head] = new Image();
    heads[head].src = 'sprites/' + head + '.png';
});

var finish = new Image();
finish.src = 'sprites/finish.png';

function max(a, b) {
    return a < b ? b : a;
}
function min(a, b) {
    return a > b ? b : a;
}

function drawImage(img, ctx, x, y, scale) {
    ctx.drawImage(img, x, y, img.width/scale, img.height/scale);
}

function rotate(img, ctx, x, y, scale) {
    // Image needs to be square
    // This gets the raw data, and swaps the image in place
    // In a rotation (x,y) becomes (N-y, x)
    // With x=i%N, y=i//N -> tx=N-i//n, ty=i%N -> ti = N*(ty)+tx
    var data = ctx.getImageData(x, y, img.width/scale,
        img.height/scale);
    var newData = new ImageData(data.width, data.height);

    for (i = 0; i < data.width * data.height; i ++) {
        new_i = data.width * (i % data.width) +
            data.width - Math.floor(i / data.width) - 1;
        // XXX I want to access this array as an Int32 one instead
        newData.data[new_i*4] = data.data[i*4];
        newData.data[new_i*4 + 1] = data.data[i*4 + 1];
        newData.data[new_i*4 + 2] = data.data[i*4 + 2];
        newData.data[new_i*4 + 3] = data.data[i*4 + 3];
    }

    ctx.putImageData(newData, x, y);
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
            body.width/this.scale, body.height/this.scale);
        drawImage(finish, ctx, this.pos[0], this.pos[1], this.scale);

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
        this.going = this.vector;
    },

    turnRight() {
        this.vector = turnRight(this.vector);
        this.going = this.vector;
    },

    brain(scene) {
        // Decide what to do
        // For now: chaos
        rnd = Math.random();
        if (rnd < .01) {
            this.turnLeft();
        } else if (rnd > .99) {
            this.turnRight();
        }

        // I want to go all the time
        this.base_speed = 3;
    },

    maybeAlterDirection() {
        if (this.altering > 0) {
            this.altering -= 1;
            return;
        }
        if (veccmp(this.going, this.vector)) {
            // Slow down
            this.altering = 10;
            this.speed = max(this.speed - 1, 0);

            // If we can go there in just one turn, do
            if (!veccmp(turnRight(this.vector), this.going) ||
                !veccmp(turnLeft(this.vector), this.going)) {
                this.vector = this.going;
            } else {
                // Otherwise pick a random turnaround sequence
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
                case W:
                case P:
                case F:
                    return true;
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
            body.width/this.scale, body.height/this.scale);

        this.move(scene);

        drawImage(body, ctx, this.pos[0], this.pos[1], this.scale);
        drawImage(legs[frame], ctx, this.pos[0], this.pos[1], this.scale);

        // Head movement is random
        if (this.rad > 0) {
            drawImage(heads['head_rad'], ctx, this.pos[0], this.pos[1],
                this.scale);
        } else if (this.lad > 0) {
            drawImage(heads['head_lad'], ctx, this.pos[0], this.pos[1],
                this.scale);
        } else {
            switch(this.looking) {
                case 0:
                    drawImage(heads['head'], ctx, this.pos[0], this.pos[1],
                        this.scale);
                    break;
                case -1:
                    drawImage(heads['headL'], ctx, this.pos[0], this.pos[1],
                        this.scale);
                    break;
                case 1:
                    drawImage(heads['headR'], ctx, this.pos[0], this.pos[1],
                        this.scale);
                    break;
            }
        }
        // We pass "body" for image size reference below but other than
        // hinting on size, is not used - anything works
        switch(this.vector.join()) {
            case "0,0":
                // Assume by default ^
                break;
            case "1,0":
                rotate(body, ctx, this.pos[0], this.pos[1], this.scale);
                break;
            case "0,1":
                rotate(body, ctx, this.pos[0], this.pos[1], this.scale);
                rotate(body, ctx, this.pos[0], this.pos[1], this.scale);
                break;
            case "-1,0":
                rotate(body, ctx, this.pos[0], this.pos[1], this.scale);
                rotate(body, ctx, this.pos[0], this.pos[1], this.scale);
                rotate(body, ctx, this.pos[0], this.pos[1], this.scale);
                break;
            case "-1,-1":
                rotate(body, ctx, this.pos[0], this.pos[1], this.scale);
                rotate(body, ctx, this.pos[0], this.pos[1], this.scale);
                rotate(body, ctx, this.pos[0], this.pos[1], this.scale);
                rotate(body, ctx, this.pos[0], this.pos[1], this.scale);
        }

        return [this.pos[0], this.pos[1]];
    }
}

function Player(x, y, scale) {
    Ant.call(this, x, y, scale);
    this.type = P;
}

Player.prototype = Object.create(Ant.prototype);

function Scene() {
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

Scene.prototype = {
    collisions(obj) {
        // Fake walls around scene
        if ((obj.pos[0] < 0) || (obj.pos[1] < 0) ||
            (obj.pos[0] >= 768 - obj.width) || (obj.pos[1] >= 768 - obj.height))
            return [new Wall(0,0,0)];

        // Returns an array of collided objects for me
        // X: this is O(N^2) -- well.
        return this.gameObjects.filter((x) => x != obj).filter((target) => {
            return collides(obj, target);
        });
    },
    load(array) {
        // A scene is square.
        // A scene definition has:
        // Nothing (...)
        // Player (my ant)
        // Ants ("IA" shit)
        // Scale is computed by how many cells in the array
        // depending on the canvas size.
        // The reference sprite is 128x128 and the canvas size is 768x768

        this.scale = Math.ceil(128 * array.length / 768);
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
    render(ctx) {
        this.gameObjects.forEach((obj) => {
            switch(obj.type) {
                case A:
                    obj.brain(this);
                    break;
            }
            obj.render(this, ctx);
        });
    }
}

const LEFT=37;
const UP=38;
const RIGHT=39;
const DOWN=40;
const SPACE=32;

var pressed = {
	LEFT: false,
	UP: false,
	RIGHT: false,
	DOWN: false,
    SPACE: false
};

window.addEventListener("keydown", function (e) {
    pressed[e.keyCode] = true;
    e.preventDefault();
});

window.addEventListener("keyup", function (e) {
    pressed[e.keyCode] = false;
});

window.onload = function () {
    var canvas = document.getElementsByTagName('canvas')[0],
        context = canvas.getContext('2d');
    canvas.width = 768;
    canvas.height = 768;

    context.lineWidth = 4;

    var scene = new Scene();

    scene.load(lev9);


    var loop = function() {
        scene.render(context);
        window.requestAnimationFrame(loop);

        if (pressed[LEFT])
            scene.player.goLeft();
        if (pressed[RIGHT])
            scene.player.goRight();
        if (pressed[UP])
            scene.player.goUp();
        if (pressed[DOWN])
            scene.player.goDown();
        if (pressed[SPACE]) {
            scene.player.speedBoost();
            console.log('Player at ' + scene.player.pos);
        }
    }

    window.requestAnimationFrame(loop);
};

// Levels
var lev0 = [
    [E, E, E, E, E, E],
    [E, E, E, E, E, E],
    [E, E, A, E, E, E],
    [E, E, E, E, E, E],
    [E, E, E, E, E, E],
    [E, E, E, F, E, E],
];

var lev9 = [
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
    ];


