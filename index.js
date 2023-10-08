const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;
const app = express();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(
  "sk_test_51NH9tHKbxj1W5bNviBMKxwoIjnsEpooBKGrCDltRbzhEqfltnb7GLOSHp8L2sanh8uTXTAIylI9dZ47cEpmEQT2q00luP7mc2H"
);
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.uoombu0.mongodb.net/?retryWrites=true&w=majority`;

//middle ware

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  // console.log(authorization);
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "User is not authorized" });
  }
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "user is not varified" });
    }
    req.decoded = decoded;
    next();
  });
};
//db connection

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
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
    const userCollection = database.collection("users");
    const bookingCollection = database.collection("bookings");
    const paymentCollection = database.collection("payments");

    //jwt

    app.post("/jwt", (req, res) => {
      const body = req.body;
      const token = jwt.sign(body, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    //admin middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };

      const user = await userCollection.findOne(query);

      if (user?.role !== "admin") {
        res.status(403).send({ error: true, message: "User is not an admin" });
      }

      next();
    };
    // route connections

    // get apis
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);

      res.send(result);
    });

    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "User has no access" });
      }
      // console.log(email);
      const query = { userEmail: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    //check admin
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded.email;

      if (email !== decodedEmail) {
        res.send({ isAdmin: false });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "admin" };

      res.send(result);
    });
    app.get("/booking/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };

      const result = await bookingCollection.find(query).toArray();

      res.send(result);
    });
    app.get("/bookings", async (req, res) => {
      const result = await bookingCollection.find().toArray();
      res.send(result);
    });

    app.get('/admin-stats',verifyJWT,verifyAdmin, async(req,res) => {
      const items = await menuCollection.estimatedDocumentCount();
      const users = await userCollection.estimatedDocumentCount();
      const bookings = await bookingCollection.estimatedDocumentCount();
      const payment = await paymentCollection.find().toArray();

      const revenue = payment.reduce((sum,item) => sum + item.amount,0)
      res.send({
        items,
        users,
        bookings,
        revenue

      })
    })
    // post apis

    app.post("/carts", async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const email = user.email;
      const query = { email: email };
      const existingUser = await userCollection.findOne(query);
      if (!existingUser) {
        const result = await userCollection.insertOne(user);

        res.send(result);
      } else {
        console.log("user already exists");
      }
    });

    app.post("/menu", verifyJWT, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    });
    app.post("/booking", async (req, res) => {
      const item = req.body;
      const result = await bookingCollection.insertOne(item);

      res.send(result);
    });
    app.post("/review", async (req, res) => {
      const item = req.body;
      const result = await reviewCollection.insertOne(item);

      res.send(result);
    });
    //payment-intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      // console.log(paymentIntent.client_secret);
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payment", verifyJWT, async (req, res) => {
      const body = req.body;
      const email = body.email;
      console.log(email);
      const query = { userEmail: { $regex: email } };
      const deleteResult = await cartCollection.deleteMany(query);
      const result = await paymentCollection.insertOne(body);
      res.send({result,deleteResult});
    });

    //patch apis

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.patch("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "approved",
        },
      };

      const result = await bookingCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    app.patch("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedItem = req.body;
      const item = {
        $set: {
          name: updatedItem.name,
          price: updatedItem.price,
        },
      };
      const result = await menuCollection.updateOne(filter, item);
      res.send(result);
    });

    //delete apis

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    app.delete("/menu/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });
    app.delete("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      // console.log(id);
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

//connection routes

app.get("/", (req, res) => {
  res.send("WELCOME TO DINEEASE SERVER");
});

//checking connection

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
