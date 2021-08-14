const express = require('express');
const app = express();
const pool = require('./db');
const path = require('path');


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({extended: true}));
app.use(express.json());


app.get('/', (req, res) => {
  res.send('hallo dunia');
})



app.listen(3000, () => {
  console.log('server sudah berjalan di port 3000');
})