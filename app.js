const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const indexRouter = require('./routes/index');
const downloadRouter = require('./routes/download')
const convertRouter = require('./routes/convert')
const progressRouter = require('./routes/progress')
const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/convert', convertRouter)
app.use('/download', downloadRouter)
app.use('/progress', progressRouter)

module.exports = app;
