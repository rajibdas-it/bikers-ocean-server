const express = require("express");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
    // Database Collections
    const usersCollection = client.db("bikersOcean").collection("users");
    const bookingsCollection = client.db("bikersOcean").collection("bookings");
    const categoryCollection = client
      .db("bikersOcean")
      .collection("categories");
    const productsCollection = client.db("bikersOcean").collection("products");
    const advertiseProductCollection = client
      .db("bikersOcean")
      .collection("advertise");
    const wishlistCollection = client.db("bikersOcean").collection("wishlists");
    const reportedItemsCollection = client
      .db("bikersOcean")
      .collection("reportedItem");
    const paymentsCollection = client.db("bikersOcean").collection("payments");

    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    const verifySeller = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "seller") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    //Authentication and Authorization Related API

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
    // api for useAdmin Hook
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });
    // api for useSeller Hook
    app.get("/users/seller/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send({ isSeller: user.role === "seller" });
    });

    //-------------- Category Related API -----------------
    app.post("/categories", verifyJWT, verifyAdmin, async (req, res) => {
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

    app.delete("/categories/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await categoryCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/category/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { categoryId: id };
      const products = await productsCollection
        .find(filter)
        .sort({ date: -1 })
        .toArray();
      res.send(products);
    });
    //Product Related API
    app.get("/productCategory", async (req, res) => {
      const query = {};
      const result = await categoryCollection
        .find(query)
        .project({ categoryName: 1 })
        .toArray();
      res.send(result);
    });

    app.post("/products", verifyJWT, verifySeller, async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      // console.log(result);
      res.send(result);
    });

    app.get("/products", verifyJWT, verifySeller, async (req, res) => {
      const email = req.query.email;
      const filter = { sellerEmail: email };
      const products = await productsCollection.find(filter).toArray();
      res.send(products);
    });

    app.delete("/products/:id", verifyJWT, verifySeller, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const products = await productsCollection.deleteOne(filter);
      res.send(products);
    });
    // Booking Related API
    app.post("/bookings", verifyJWT, async (req, res) => {
      const booking = req.body;
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    app.get("/bookings", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      // console.log(req.headers.authorization);
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      const result = await bookingsCollection.find(filter).toArray();
      res.send(result);
    });

    //This api use for payment.
    app.get("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await bookingsCollection.findOne(filter);
      res.send(result);
    });

    app.delete("/bookings/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await bookingsCollection.deleteOne(filter);
      res.send(result);
    });

    app.post("/mywishlist", async (req, res) => {
      const item = req.body;
      const result = await wishlistCollection.insertOne(item);
      res.send(result);
    });

    app.get("/mywishlist", async (req, res) => {
      const email = req.query.email;
      const filter = { userEmail: email };
      const result = await wishlistCollection
        .find(filter)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    app.delete("/mywishlist/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await wishlistCollection.deleteOne(filter);
      res.send(result);
    });

    app.get("/verifyseller/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const seller = await usersCollection.findOne(filter);
      // console.log(seller);
      res.send(seller);
    });

    // Product Advertise Related API
    app.put("/createAdvertise", verifyJWT, verifySeller, async (req, res) => {
      const advertiseProduct = req.body;
      const filter = { productId: advertiseProduct.productId };
      const options = { upsert: true };
      // console.log(advertiseProduct);
      const updatedDoc = {
        $set: {
          date: advertiseProduct.date,
          productId: advertiseProduct.productId,
          productName: advertiseProduct.productName,
          image: advertiseProduct.image,
          status: advertiseProduct.status,
        },
      };
      const result = await advertiseProductCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    app.get("/createAdvertise", async (req, res) => {
      const query = {};
      const result = await advertiseProductCollection.find(query).toArray();
      res.send(result);
    });

    // Admin Related API
    app.get("/allUsers", verifyJWT, verifyAdmin, async (req, res) => {
      const query = { role: "user" };
      const allUsers = await usersCollection.find(query).toArray();
      res.send(allUsers);
    });

    app.get("/allSeller", verifyJWT, verifyAdmin, async (req, res) => {
      const query = { role: "seller" };
      const allSeller = await usersCollection.find(query).toArray();
      res.send(allSeller);
    });

    app.patch("/verifySeller/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "verified",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete("/users/:id", verifyJWT, verifyAdmin, async (req, res) => {
      // const decodedEmail = req.decoded.email;
      // // console.log(decodedEmail);

      // const query = { email: decodedEmail };
      // const user = await usersCollection.findOne(query);
      // if (user?.role !== "admin") {
      //   return res.status(403).send({ message: "forbidden access" });
      // }
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    app.post("/reportedItems", verifyJWT, async (req, res) => {
      const reportedItem = req.body;
      const result = await reportedItemsCollection.insertOne(reportedItem);
      res.send(result);
    });

    app.get("/reportedItems", verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const result = await reportedItemsCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    app.delete(
      "/deletedReportedItem/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        // console.log(id);
        const filter = { _id: ObjectId(id) };
        const result = await productsCollection.deleteOne(filter);
        const reportedItemFilter = { productId: id };
        const updatedDoc = {
          $set: {
            adminComments: "Product Deleted",
          },
        };
        const updateReportedItemResult =
          await reportedItemsCollection.updateOne(
            reportedItemFilter,
            updatedDoc
          );
        res.send(result);
      }
    );

    // Payment Related API
    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      // console.log(payment);
      const result = await paymentsCollection.insertOne(payment);

      //Booking status update
      const bookingId = payment.bookingId;
      const bookingFilter = { _id: ObjectId(bookingId) };
      const updatedBookingDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const bookingUpdatedResult = await bookingsCollection.updateOne(
        bookingFilter,
        updatedBookingDoc
      );

      //Update for remove item from advertise section.
      const productId = payment.productId;
      const advertiseFilter = { productId: productId };
      const advertiseUpdatedDoc = {
        $set: {
          status: "sold",
        },
      };
      const advertiseUpdatedResult = await advertiseProductCollection.updateOne(
        advertiseFilter,
        advertiseUpdatedDoc
      );

      //Update for change product status in product section.
      const productFilter = { _id: ObjectId(productId) };
      const productUpdatedDoc = {
        $set: {
          status: "sold",
        },
      };
      const productUpdatedResult = await productsCollection.updateOne(
        productFilter,
        productUpdatedDoc
      );
      res.send(result);
    });
  } finally {
  }
}

run().catch((err) => console.log(err));

app.listen(port, () => {
  console.log(`Bikers Ocean server is running on port ${port}`);
});
