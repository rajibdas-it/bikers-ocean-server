const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;

const app = express();
require("dotenv").config();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Bikers Ocean Server is running.");
});

app.listen(port, () => {
  console.log(`Bikers Ocean server is running on port ${port}`);
});
