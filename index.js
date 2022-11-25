const express = require("express");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();

const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Bikers Ocean Server is running.");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fe8xrlp.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.AccessToken, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    const usersCollection = client.db("bikersOcean").collection("users");
    const bookingsCollection = client.db("bikersOcean").collection("bookings");
    const categoryCollection = client
      .db("bikersOcean")
      .collection("categories");
    const productsCollection = client.db("bikersOcean").collection("products");

    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updatedDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      // const result = await usersCollection.insertOne(user);
      // console.log(result);
      res.send(result);
    });

    // app.get("/users/admin/:email", async (req, res) => {
    //   const email = req.params.email;
    //   const query = { email: email };
    //   const user = await usersCollection.findOne(query);
    //   console.log(user);
    //   if (!user) {
    //     return res.status(403).send({ message: "No User" });
    //   }
    //   res.send({ isAdmin: user.role === "admin" });
    // });
    // app.get("/users/seller/:email", async (req, res) => {
    //   const email = req.params.email;
    //   const query = { email: email };
    //   const user = await usersCollection.findOne(query);
    //   console.log(user);
    //   if (!user) {
    //     return res.status(403).send({ message: "No User" });
    //   }
    //   res.send({ isSeller: user.role === "seller" });
    // });

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        // console.log(user);
        const token = jwt.sign({ email }, process.env.AccessToken, {
          expiresIn: "1h",
        });
        return res.send({ accessToken: token });
      }

      return res.status(403).send({ accessToken: "", message: "Forbidden" });
    });

    app.post("/categories", async (req, res) => {
      const category = req.body;
      const result = await categoryCollection.insertOne(category);
      // console.log(result);
      res.send(result);
    });

    app.get("/categories", async (req, res) => {
      const query = {};
      const categories = await categoryCollection.find(query).toArray();
      res.send(categories);
    });

    app.get("/category/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { categoryId: id };
      const products = await productsCollection.find(filter).toArray();
      res.send(products);
    });

    app.get("/productCategory", async (req, res) => {
      const query = {};
      const result = await categoryCollection
        .find(query)
        .project({ categoryName: 1 })
        .toArray();
      res.send(result);
    });

    app.post("/products", async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      // console.log(result);
      res.send(result);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    app.get("/bookings", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const decodedEmail = req.decoded;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      const result = await bookingsCollection.find(filter).toArray();
      res.send(result);
    });

    app.get("/verifyseller/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const seller = await usersCollection.findOne(filter);
      // console.log(seller);
      res.send(seller);
    });
  } finally {
  }
}

run().catch((err) => console.log(err));

app.listen(port, () => {
  console.log(`Bikers Ocean server is running on port ${port}`);
});
