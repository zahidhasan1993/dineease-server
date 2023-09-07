const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;
const app = express();
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.uoombu0.mongodb.net/?retryWrites=true&w=majority`;


//middle ware

app.use(cors());
app.use(express.json());
//db connection




// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();


    // db-access
    const database = client.db("dineease");
    const menuCollection = database.collection("menu");
    const reviewCollection = database.collection("reviews");
    const cartCollection = database.collection("carts");


    // route connections


    // get apis
    app.get('/menu', async(req,res) => {
        const result = await menuCollection.find().toArray();
        res.send(result);
    })

    app.get('/reviews', async(req,res) => {
        const result = await reviewCollection.find().toArray();
        res.send(result);
    })

    app.get('/carts', async(req,res) => {
      const email = req.query.email;
      console.log(email);
      const query = {userEmail : email}
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    })


    // post apis

    app.post('/carts', async(req,res)=> {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


//connection routes

app.get('/', (req,res) => {
    res.send('WELCOME TO DINEEASE SERVER')
})

//checking connection

app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})