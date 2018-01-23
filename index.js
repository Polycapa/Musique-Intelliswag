var baudio = require('baudio');
var SerialPort = require("serialport");
var player = require('play-sound')(opts = {})
const request = require('request');
const Readline = SerialPort.parsers.Readline;
const parser = new Readline();
const apiUrl = 'http://localhost:8080/rest';

const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const autoMode = false

app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
    extended: true
}));
// const port = '/dev/ttyACM0';
// var sp = new SerialPort(port);



const datas = require('./captors-config.json');

var playing = false;
var stopping = false;

const playLimit = 100;
const maxInputValue = 900;
const stopAtXLimit = 1;
var endCount = 0;

const readedDataStartChar = '!';
const readedDataStopChar = '?';
var readedDataStartCharFound = false;
var readedDataStopCharFound = false;
var currentReadedData = '';


// sp.pipe(parser);
// sp.on("data", handleData);

setInterval(function () {
    let max = 900;
    let min = 0;
    let value = Math.floor(Math.random() * (max - min + 1)) + min;
    let pin = Math.floor(Math.random() * (15 - 14 + 1)) + 14;
    handleData(`!${pin}-${value}?`);
}, 500);

app.post('/', (req, res) => {
    let pin = Number(req.query.pin);
    let value = Number(req.query.value);
    console.log(pin, value);
    if (pin && value) {
        let item = getData(pin);
        if (item) {
            handleValueChange(item, pin, value);
        }
    }
    res.send('');
})

app.post('/frequency', (req, res) => {
    let pin = Number(req.query.pin);
    let frequency = Number(req.query.frequency);
    let value = Number(req.query.value);
    console.log(pin, frequency, value);
    if (pin && frequency && value !== undefined) {
        let item = getData(pin);
        if (item) {
            handlePlayFrequency(item, pin, frequency, value);
        }
    }
    res.send('');
})

app.post('/stop', (req, res) => {
    let pin = Number(req.query.pin);
    if (pin) {
        stopSound(pin)
    }
    res.send('');
})


app.listen(3000, () => {
    console.log('App listening on port 3000!');
});

function handleData(data) {
    data = data.toString('utf8');
    if (data.indexOf(readedDataStartChar) !== -1) {
        readedDataStartCharFound = true;
    }

    if (data.indexOf(readedDataStopChar) !== -1) {
        readedDataStopCharFound = true;
    }

    currentReadedData += data;

    if (readedDataStartCharFound && readedDataStopCharFound) {
        data = currentReadedData;
        data = data.substring(data.indexOf(readedDataStartChar) + 1);
        data = data.substring(0, data.indexOf(readedDataStopChar));
        currentReadedData = '';
        readedDataStartCharFound = false;
        readedDataStopCharFound = false;
    } else {
        return;
    }

    if (data.indexOf('-') === -1) {
        return;
    }

    data = data.split('-');

    let pin = Number(data[0]);
    let value = Number(data[1]);
    let item = getData(pin);
    if (!item) {
        return;
    }

    request.put({
            url: `${apiUrl}/items/PressionCaptor${pin}/state`,
            body: `${value}`
        })
        .on('error', err => {})
}

function handleValueChange(item, pin, value) {
    if (item && value > playLimit) {
        item.endCount = 0;
        playSound(pin, getVolume(value));
    } else {
        item.endCount++;
        if (item.endCount >= stopAtXLimit) {
            stopSound(pin);
        }
    }
}

function handlePlayFrequency(item, pin, frequency, value) {
    if (item && value > playLimit) {
        item.endCount = 0;
        playSoundWithFrequency(pin, frequency, getVolume(value));
    } else {
        item.endCount++;
        if (item.endCount >= stopAtXLimit) {
            stopSound(pin);
        }
    }
}

function stopSound(pin) {
    let data = getData(pin);
    if (data && !data.stopping) {
        console.log('stop ' + pin);
        data.b.end();
        data.playing = false;
        data.stopping = true;
        data.endCount = 0;
    }
}

function playSound(pin, volume = 1) {
    let data = getData(pin);
    if (data.playing) {
        return;
    }

    let frequency = data.frequency;

    data.b = baudio(function (t) {
        return Math.sin(t * frequency * Math.PI);
    });

    data.b.play({
        'v': volume
    });
    // player.play('./c2.mp3', function (err) {
    //     if (err) throw err
    // })
    data.playing = true;
    data.stopping = false;
    console.log(`play ${frequency} on ${pin}`);
}

function playSoundWithFrequency(pin, frequency, volume = 1) {
    let data = getData(pin);
    if (data.playing) {
        return;
    }

    data.b = baudio(function (t) {
        return Math.sin(t * frequency * Math.PI);
    });

    data.b.play({
        'v': volume
    });
    // player.play('./c2.mp3', function (err) {
    //     if (err) throw err
    // })
    data.playing = true;
    data.stopping = false;
    console.log(`play ${frequency} on ${pin}`);
}

function getData(pin) {
    let foundItem = datas.find(item => item.pin === pin);
    return foundItem;
}

function setData(pin, property, value) {
    let index = datas.findIndex(item => item.pin === pin);
    datas[index][property] = value;
}

function getVolume(value) {
    return value / maxInputValue * 2;
}