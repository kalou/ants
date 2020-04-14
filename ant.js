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

function drawImage(img, ctx, x, y, scale) {
    ctx.drawImage(img, x, y, img.width/scale, img.height/scale);
}

function rotate(img, ctx, x, y, scale) {
    // Image needs to be square
    // This gets the raw data, and swaps the image in place
    // In a rotation (x,y) becomes (N-y, x)
    // With x=i%N, y=i//N -> tx=N-i//n, ty=i%N -> ti = N*(ty)+tx
    // Leave the comment in place if you borrow this ;)
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

function Ant(x, y) {
    this.pos = [x, y];
    this.scale = 2; // Experiments
    this.frame = 0;
    this.lad = 0;
    this.rad = 0;

    this.looking = 0; // -1 left, 1 right
    this.vector = [1, 0];
    this.speed = 0;
}

Ant.prototype = {
    move() {
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
        this.pos = [this.pos[0] + this.vector[0] * this.speed,
            this.pos[1] + this.vector[1] * this.speed];

        this.pos[0] &= 1023;
        this.pos[1] &= 511;
    },

    render(ctx) {
        // Frame .. only drawing in here
        this.frame = ((this.frame + this.speed) / 2)  % 8;

        ctx.clearRect(this.pos[0], this.pos[1],
            body.width/this.scale, body.height/this.scale);

        this.move();

        drawImage(body, ctx, this.pos[0], this.pos[1], this.scale);
        drawImage(legs[this.frame], ctx, this.pos[0], this.pos[1], this.scale);

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
    }
}

const LEFT=37;
const UP=38;
const RIGHT=39;
const DOWN=40;

var pressed = {
	LEFT: false,
	UP: false,
	RIGHT: false,
	DOWN: false
};

window.addEventListener("keydown", function (e) {
    pressed[e.keyCode] = true;
    return false;
});

window.addEventListener("keyup", function (e) {
    pressed[e.keyCode] = false;
});

window.onload = function () {
    var canvas = document.getElementsByTagName('canvas')[0],
        context = canvas.getContext('2d');
    canvas.width = 1024;
    canvas.height = 512;

    context.lineWidth = 4;

    var ant = new Ant(25, 25);

    var loop = function() {
        ant.render(context);
        window.requestAnimationFrame(loop);
    }

    window.requestAnimationFrame(loop);
};
