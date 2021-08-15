const express = require('express');
const app = express();
const pool = require('./db');
const path = require('path');


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')))

//test
app.get('/', (req, res) => {
  res.send('hallo dunia');
})

//form register
app.get('/registerStudent', (req, res) => {
    res.render('register-pelajar');
})

//post register
app.post('/', async(req, res) => {
  try{
    
  } catch(err){

  }

})


app.listen(3000, () => {
  console.log('server sudah berjalan di port 3000');
})