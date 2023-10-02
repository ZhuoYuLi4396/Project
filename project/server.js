const express = require('express');
const SerialPort = require('serialport').SerialPort;
const mongoose = require('mongoose');
const plotly = require('plotly')("zhuoyuli", "xjgp980yPSWrzMAXFztD");
const app = express();
const port = 3000;
const Schema = mongoose.Schema;
// const axios = require('axios');

//mongo的东西
mongoose.connect('mongodb+srv://lzhuo:zhuoyuli2023@sit314.owwdshd.mongodb.net/test', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', function () {
  console.log('Successful connection to MongoDB database');
});

const ledSchema = new Schema({
  timestamp: Date,
  states: [
    {
      name: String,
      status: Number,
      timestamp: Date
    }
  ]
});

const LEDModel = mongoose.model('LED', ledSchema);

const portName = 'COM4'; // 根据Arduino端口来
const serialPort = new SerialPort(
  {
    path: portName,
    baudRate: 9600,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    flowControl: false,
    //autoOpen: false,
  }
);

app.use(express.static('C:\\Users\\10111\\Desktop\\314\\project\\web'));

// 用于存储 LED 数据
let LEDData = {
  LED1: { x: [], y: [], name: 'LED1', type: 'scatter' },
  LED2: { x: [], y: [], name: 'LED2', type: 'scatter' },
  LED3: { x: [], y: [], name: 'LED3', type: 'scatter' },
  AllLED: { x: [], y: [], name: 'AllLED', type: 'scatter' }
};

// 使用Plotly库添加数据到图表
function PushDataToPlotly() {
  const data = [LEDData.LED1, LEDData.LED2, LEDData.LED3, LEDData.AllLED];

  const graphOptions = { filename: 'SIT314_Project', fileopt: 'overwrite' };


  plotly.plot(data, graphOptions, function (err, msg) {
    if (err) {
      console.error(err);
    } else {
      console.log(msg);
    }
  });
}

// 处理 LED 数据的路由
app.get('/sendCommand/:command', (req, res) => {
  const command = req.params.command;
  let ledName;

  // 根据命令设置 LED 的名称
  switch (command) {
    //控制全部的LED开关
    case 'O':
      ledName = 'AllLED';
      break;
    case 'F':
      ledName = 'AllLED';
      break;
      //控制单个的
    case 'O1':
      ledName = 'LED1';
      break;
    case 'F1':
      ledName = 'LED1';
      break;
    case 'O2':
      ledName = 'LED2';
      break;
    case 'F2':
      ledName = 'LED2';
      break;
    case 'O3':
      ledName = 'LED3';
      break;
    case 'F3':
      ledName = 'LED3';
      break;
    // ...
    default:
      ledName = 'Undefine';
  }

  // 发送命令到 Arduino
  serialPort.write(command);

  // 获取当前时间
  const timestamp = new Date();

  // 存储 LED 状态到 MongoDB
  LEDModel.findOneAndUpdate(
    {},
    {
      $push: {
        states: {
          name: ledName,
          status: command.includes('O') ? 1 : 0,
          timestamp
        }
      }
    },
    { upsert: true }
  )
    .then((doc) => {
      // 更新储存的 LED 数据
      LEDData[ledName].x.push(timestamp.toISOString());
      LEDData[ledName].y.push(command.includes('O') ? 1 : 0);



      // 输出 LED 数据
      console.log(`Plotly diagram generated by ${ledName}:`);
      console.log(LEDData[ledName]);

      //将数据发送到 Plotly
      PushDataToPlotly();

      res.send(`Command sent: ${command}`);
    })
    .catch((err) => {
      console.error('Failure to store to database：', err);
      res.status(500).send('Server Error');
    });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});