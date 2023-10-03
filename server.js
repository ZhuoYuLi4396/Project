const express = require('express');
const bcrypt = require('bcrypt');
const SerialPort = require('serialport').SerialPort;
const mongoose = require('mongoose');
const plotly = require('plotly')("zhuoyuli", "xjgp980yPSWrzMAXFztD");
const session = require('express-session');
const path = require('path');

const app = express();
const port = 3000;
const Schema = mongoose.Schema;
const crypto = require('crypto');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: generateRandomString(32),
  resave: true,
  saveUninitialized: true
}));


function generateRandomString(length) {
  return crypto.randomBytes(length).toString('hex');
}


// 连接到 MongoDB
mongoose.connect('mongodb+srv://lzhuo:zhuoyuli2023@sit314.owwdshd.mongodb.net/test', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', function () {
  console.log('Successful connection to MongoDB database');
});

// 用户数据模型，存储在数据库里的格式
const userSchema = new Schema({
  username: { type: String, unique: true },
  password: String
});

const UserModel = mongoose.model('User', userSchema);

// 注册页面路由
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // 使用 bcrypt 对密码进行加密以确保数据安全
  const hashedPassword = await bcrypt.hash(password, 10);

  // 创建新用户
  const newUser = new UserModel({
    username,
    password: hashedPassword
  });

  // 将数据保存在数据库中
  newUser.save()
    .then(() => {
      res.redirect('/login'); // 注册成功后重定回到登录页面
    })
    .catch((error) => {
      console.error('Error registering user:', error);
      res.status(500).send('Registration failed.');
    });
});


// 登录页面路由
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // 在数据库中查找用户是否存在
  const user = await UserModel.findOne({ username });

  if (!user) {
    return res.status(401).send('Invalid username or password.');
  }

  // 使用 bcrypt 验证密码
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).send('Invalid username or password.');
  }

  // 登录成功，设置用户会话
  req.session.user = user;

  // 重定向到web.html也就是LED控制页面
  res.redirect('/web.html');
});

// 中间件，检查用户是否已登录
function requireLogin(req, res, next) {
  if (req.session.user) {
    return next(); // 用户已登录，继续下一个中间件或路由处理
  } else {
    res.redirect('/login'); // 用户未登录，重定向到登录页面
  }
}

// 将中间件应用于需要登录的路由
app.get('/web.html', requireLogin, (req, res) => {
  // 用户已登录，可以访问LED控制页面
   res.sendFile(path.join(__dirname, 'web.html'));
  // res.sendFile(path.join(__dirname, 'new_web', 'web.html'));
});

// 处理 GET 请求，返回登录页面
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// 处理 GET 请求，返回注册页面
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'register.html'));
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

//app.use(express.static('C:\\Users\\10111\\Desktop\\314\\project\\web'));
app.use(express.static('C:\\Users\\10111\\Desktop\\314\\project\\new_web'));

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
