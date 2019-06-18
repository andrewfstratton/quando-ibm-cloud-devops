'use strict'
const express = require('express')
const express_static = express.static
const session = require('express-session')
const MemoryStore = require('memorystore')(session)
const app = express()
const fs = require('fs')
const body_parser = require('body-parser')
const base64Img = require('base64-img');
const join = require('path').join
const http = require('http').Server(app)
const https = require('https')
const io = require('socket.io')(http)

function fail(response, msg) {
  response.json({'success': false, 'message': msg})
}

function success(response, obj = false) {
  if (!obj) {
    obj = {}
  }
  obj.success = true
  response.json(obj)
}

//Watson services
const TextToSpeechV1 = require('watson-developer-cloud/text-to-speech/v1');
const tts = new TextToSpeechV1({
  iam_apikey: 'rRDUgzsh17bWWYS2VesXDCkHIanOQIuE42ccPOI7qivX',
  url: 'https://gateway-lon.watsonplatform.net/text-to-speech/api'
});

const VisualRecognitionV3 = require('watson-developer-cloud/visual-recognition/v3');
const visRec = new VisualRecognitionV3({
  version: '2018-03-19',
  iam_apikey: 'md2b1cDrwPHQC-a-hJovQnsgdvRyympAfBArw4niQCn9',
  url: 'https://gateway.watsonplatform.net/visual-recognition/api'
});

var ToneAnalyzerV3 = require('watson-developer-cloud/tone-analyzer/v3');
var toneAnalyzer = new ToneAnalyzerV3({
  version: '2017-09-21',
  iam_apikey: 'WcRnTs5agEpG9o_PKiTTQSJK1G7fUpcdodKWuVCJivUh',
  url: 'https://gateway-lon.watsonplatform.net/tone-analyzer/api'
});

var SpeechToTextV1 = require('watson-developer-cloud/speech-to-text/v1');
var stt = new SpeechToTextV1({
  iam_apikey: 'WiLEvMCQ1hPxKRYtpFo98jYg6jsc2QSnEHx2hfsYiseu',
 url: 'https://gateway-lon.watsonplatform.net/speech-to-text/api'
});

let port = process.env.PORT || 80
let appEnv = require('cfenv').getAppEnv() // For IBM Cloud
if (appEnv.isLocal == false) { // i.e. if running on cloud server
  console.log("INFO: Running on IBM Cloud, port="+port+" >> "+appEnv.port)
  port = appEnv.port // override the port
} else {
  console.log("INFO: Running as Hub, port="+port)
}

function drop_client(client) {
  let index = io.clients.indexOf(client)
  if (index != -1) {
    io.clients.splice(index, 1) // unlike delete, remove the array entry, rather than set to null
  }
}

let server = http.listen(port, () => {
  let host = process.env.IP || server.address().address
  console.log(`Quando Server listening at http://${host}:${server.address().port}`)
  io.clients=[]
  io.broadcast = (msg) => {
    io.clients.forEach(client => {
      client.write(msg + '\n')
    })
  }
  io.on('connection', (client) => {
    console.log('Socket connected...')
    io.clients.push(client)
    client.on('error', ()=>{
      console.log('Socket error...')
      drop_client(client)
    })
    client.on('timeout', ()=>{
      console.log('Socket timeout...')
      drop_client(client)
    })
    client.on('data', (data)=>{
      console.log('Socket data...')
      console.log(data.toString())
      client.write('Ok\n')
    })
    client.on('end', ()=>{
      drop_client(client)
      console.log('...closed['+index+']')
    })
  })
})

const MEDIA_FOLDER = join(__dirname, 'client', 'media')
const MEDIA_MAP = {
  //TODO - refactor to videos & images
  'video': ['ogg', 'ogv', 'mp4', 'webm'],
  'audio': ['mp3', 'wav'],
  'images': ['bmp', 'jpg', 'jpeg', 'png', 'gif'],
  'objects': ['gltf', 'glb'], 
  // 'objects': ['obj', 'mtl'],
}
{
  let upload = []
  Object.keys(MEDIA_MAP).map((key)=>{upload = upload.concat(MEDIA_MAP[key])})
  MEDIA_MAP['UPLOAD'] = upload
}

// app.use(require('morgan')('dev'))

app.use(session({
  secret: 'quando_secret',
  resave: false, // i.e. only save when changed
  saveUninitialized: true,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
        // name: may need this later - if sessions exist for clients...
    httpOnly: false
  },
  store: new MemoryStore({
    checkPeriod: 7 * 24 * 60 * 60 * 1000
  })
}))
app.use('/', (req, res, next) => {
    // console.log(">>" + JSON.stringify(req.session.user))
  next()
})
app.use('/', express_static(join(__dirname, 'hub')))

//increased limit of bp to allow for visrec 
app.use(body_parser.json({ limit: '10mb' }));
app.use(body_parser.urlencoded({ extended: true, limit:'10mb' }))

app.use(body_parser.json())

require('./server/rest/login')(app, success, fail)
require('./server/rest/script')(app, io, success, fail)
require('./server/rest/file')(app, MEDIA_FOLDER, MEDIA_MAP, success, fail)

// Static for inventor
app.use('/inventor', express_static(join(__dirname, 'inventor')))
app.use('/favicon.ico', express_static(join(__dirname, 'inventor/favicon.ico')))

const client_dir = join(__dirname, 'client')
require('./server/rest/client')(app, client_dir, express_static, success, fail)
require('./server/rest/message')(app, io, https)

//WATSON SERVICES

//Text-To-Speech
app.post('/watson/TTS_request', (req, res) => {
  console.log('Text to Speech Requested...')
  let text = req.body.text;
  console.log('TTS Text is: ' + text);
  let params = { //stuff sent to API
    text: text,
    accept: 'audio/wav'
  } 
  tts.synthesize(params, function(err, audio) { //handling errors and file
    if (err) {
      console.log(err);
      return;
    } 
    //save output file
    tts.repairWavHeader(audio);
    fs.writeFileSync(__dirname + '/client/media/tts.wav', audio);
    console.log('TTS - audio written as tts.wav');
    res.json({});
  });
});

//Visual-Recognition
app.post('/watson/VISREC_request', (req, res) => {
  console.log('Visual Recognition Requested...');
  let imgData = req.body.imgData;
  base64Img.img(imgData, __dirname + '/client/media', 'visrec', function(err, filepath) {

    let file = fs.createReadStream(__dirname +'/client/media/visrec.png');
    let params = { //stuff sent to API
      images_file: file
    };
    //call API
    visRec.classify(params, function(err, response) {
      if (err) {
        console.log(err);
      } else {
        //TODO - need to parse out the classification here n pass it back with the socket signal
        console.log(JSON.stringify(response, null, 2));
        res.json(JSON.stringify(response, null, 2));
      };
    });

  });
  //io.emit('VISREC_return', {}) //send socket signal to client saying rec complete
});

//Tone Analyzer
app.post('/watson/TONE_request', (req, res) => {
  console.log('Tone Analyzer Requested...');
  let text = req.body.text;
  let params = { //stuff sent to API
    tone_input: {'text': text},
    content_type: 'application/json'
  };
  toneAnalyzer.tone(params, function (error, toneAnalysis) {
    if (error) {
      console.log(error);
    } else { 
      //console.log(JSON.stringify(toneAnalysis, null, 2));
      res.json(JSON.stringify(toneAnalysis, null, 2));
    }
  })
});

//Speech to Text
app.post('/watson/SPEECH_request', (req, res) => {
  console.log('Speech to Text Requested...');
  var combinedStream = CombinedStream.create();
  combinedStream.append(fs.createReadStream(__dirname + 'audio-file1.wav'));
  combinedStream.append(fs.createReadStream(__dirname + 'audio-file2.wav'));
  
  var params = {
    audio: combinedStream,
    content_type: 'audio/wav',
    timestamps: true,
    word_alternatives_threshold: 0.9
  };
  speechToText.recognize(recognizeParams, function(error, speechRecognitionResults) {
    if (error) {
      console.log(error);
    } else {
      console.log(JSON.stringify(speechRecognitionResults, null, 2));
    }
  });
});

app.post('/socket/:id', (req, res) => {
  let id = req.params.id
  let val = req.body.val
  let msg = JSON.stringify({id:id, val:val})
  io_server.broadcast(msg)
  res.json({})
})

require('./server/rest/blocks')(app, __dirname, success, fail)
require('./server/rest/ubit')(app, io)
require('./server/rest/ip')(app, appEnv, success, fail)
require('./server/rest/user')(app, appEnv, success, fail)
