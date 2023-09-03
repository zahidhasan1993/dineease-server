const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;
const app = express();
require('dotenv').config()



//middle ware

app.use(cors());
app.use(express.json());


//connection routes

app.get('/', (req,res) => {
    res.send('WELCOME TO DINEEASE SERVER')
})

//checking connection

app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})