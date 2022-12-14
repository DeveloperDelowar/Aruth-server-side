const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const PORT = process.env.PORT || 5000;
require("dotenv").config();

app.use(express.json());
app.use(cors());

// default route
app.get("/", (req, res) => {
  res.send("The server is running");
});

/*
  ===========================================
    *** JSON web token ( verify token) ***
   ===========================================
*/
function verifyToken(req, res, next) {
  const authorization = req.headers.auth;
  const email = req.query.email;

  if (!authorization) {
    return res.status(401).send({ message: "Unauthorize access" });
  }
  // get access token from a sting;
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    } else {
      // Check access token email & api requested email;
      if (decoded.email === email) {
        return next();
      } else {
        return res.status(403).send({ message: "Forbidden access" });
      }
    }
  });
}

/*======================================================================================*/
/*======================================================================================*/
/*======================================================================================*/
/*======================================================================================*/

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.otkxf.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();

    // Data base collection
    const productCollection = client.db("Aruth").collection("products");
    const usersCollection = client.db("Aruth").collection("users");
    const orderCollection = client.db("Aruth").collection("orders");
    const categoryCollection = client.db("Aruth").collection("categories");
    const slidersCollection = client.db("Aruth").collection("sliders");
    const reviewsCollection = client.db("Aruth").collection("reviews");

    /*===========================================
        *** Verify admin ***
===========================================*/

    const verifyAdmin = async (req, res, next) => {
      const email = req.query.email;
      const query = { email };
      const user = await usersCollection.findOne(query);

      if (user?.role === "admin") {
        return next();
      } else {
        return res.status(403).send({ message: "Forbidden access" });
      }
    };

    /*=============================================
           ************** Products API ***********
        ============================================*/

    // get popular products
    app.get("/popular-products", async (req, res) => {
      const totalProduct = await productCollection.estimatedDocumentCount();
      const skipCount = totalProduct - 5 <= 0 ? 0 : totalProduct - 5;

      const latestProducts = await productCollection
        .find({ type: 'popular' })
        .project({
          img: 1,
          name: 1,
          ratings: 1,
          price: 1,
          discount: 1,
        })
        .skip(skipCount)
        .toArray();

      const reverse = latestProducts.reverse();
      res.send(reverse);
    });

    // Get all products
    app.get("/all-products", async (req, res) => {
      const result = await productCollection.find().toArray();
      const latestProduct = result.reverse();
      res.send(latestProduct);
    });

    // get product info by id
    app.get("/product-details/:id", async (req, res) => {
      const { id } = req.params;
      const product = await productCollection.findOne({ _id: ObjectId(id) });
      res.send(product);
    });

    // get product by category
    app.get("/categories-product/:name", async (req, res) => {
      const { name } = req.params;
      const query = { categories: name };
      const result = await productCollection.find(query).toArray();
      res.send(result);
    });

    // Recommended product
    app.get('/recommended-products/:category', async(req, res)=>{
      const {category} = req.params;
      const result = await productCollection.find({categories : category}).limit(6).toArray();
      res.send(result);
    });

    // Just for you products
    app.get('/just-for-you', async(req, res)=>{
      const totalProduct = await productCollection.estimatedDocumentCount();
      const skipCount = totalProduct - 5 <= 0 ? 0 : totalProduct - 5;

      const latestProducts = await productCollection
        .find({ type: 'justForYou' })
        .project({
          img: 1,
          name: 1,
          ratings: 1,
          price: 1,
          discount: 1,
        })
        .skip(skipCount)
        .toArray();

      const reverse = latestProducts.reverse();
      res.send(reverse);
    });

    /*********** Admin control ***********/

    // Insert a new product
    app.post("/insert-product", verifyToken, verifyAdmin, async (req, res) => {
      const info = req.body;
      const result = await productCollection.insertOne(info);
      res.send(result);
    });

    // get our available products
    app.get("/products", verifyToken, verifyAdmin, async (req, res) => {
      const product = await productCollection
        .find()
        .project({
          img: 1,
          name: 1,
          price: 1,
          totalSells: 1,
          couponCode: 1,
          categories: 1,
        })
        .toArray();

      const latestProduct = product.reverse();
      res.send(latestProduct);
    });

    // product details
    app.get(
      "/product-explore/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;
        const product = await productCollection.findOne({ _id: ObjectId(id) });
        res.send(product);
      }
    );

    // update product information
    app.patch(
      "/update-product-info/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const updatedInfo = req.body;
        const { id } = req.params;
        const result = await productCollection.updateOne(
          { _id: ObjectId(id) },
          { $set: updatedInfo }
        );

        res.send(result);
      }
    );

    /*================================================================================
          ********* Order management **********
    ==============================================================================*/

    // place order
    app.post("/place-order", verifyToken, async (req, res) => {
      const ordersInfo = req.body;
      const totalOrders = await orderCollection.estimatedDocumentCount();

      // make order number
      const orderNum = `AR${require("crypto")
        .randomBytes(2)
        .toString("hex")}C${totalOrders}`;
      const doc = { ...ordersInfo, orderNum };

      const result = await orderCollection.insertOne(doc);
      res.send(result);
    });

    // Get my orders
    app.get("/my-orders", verifyToken, async (req, res) => {
      const { email } = req.query;
      const result = await orderCollection
        .find({ email })
        .project({
          productImg: 1,
          productName: 1,
          productQuantity: 1,
          size: 1,
          status: 1,
          orderNum: 1,
          date: 1,
        })
        .toArray();
      const latestOrders = result.reverse();
      res.send(latestOrders);
    });

    // My order details
    app.get("/my-order-details/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const order = await orderCollection.findOne({ _id: ObjectId(id) });
      res.send(order);
    });

    // add a review And update product ratings
    app.put("/add-review/:orderNum", verifyToken, async (req, res) => {
      const { orderNum } = req.params;
      const review = req.body;

      // Insert / update a review
      const result = await reviewsCollection.updateOne(
        { orderNum },
        { $set: review },
        { upsert: true }
      );

      // Find the product
      const productId = review?.productId;
      const productInfo = await productCollection.findOne({
        _id: ObjectId(productId),
      });

      // Find all reviews star
      const allStars = await reviewsCollection
        .find({ productId })
        .project({ ratings: 1 })
        .toArray();

        // Calculate the product ratings
      const stars = allStars?.map(star => star?.ratings);
      const sumOfStars = stars.reduce((sum, a) => sum + a, 0);
      const averageStaring = sumOfStars / (stars?.length || 1);
      const newRatings = averageStaring.toPrecision(2);

      // Update product Ratings
      const updateReview = await productCollection.updateOne(
        { _id: ObjectId(productId) },
        { $set: { ratings: newRatings } },
        { upsert: true }
      );

      res.send(result);
    });

    // get comments for display product
    app.get("/product-reviews/:productId", async (req, res) => {
      const { productId } = req.params;
      const reviews = await reviewsCollection.find({ productId }).toArray();
      const latestReviews = reviews.reverse();
      res.send(latestReviews);
    });

    // Get my all review by email;
    app.get("/my-all-review", async (req, res) => {
      const { email } = req.query;
      const reviews = await reviewsCollection
        .find({ email })
        .project({
          productImg: 1,
          ratings: 1,
          text: 1,
          productName: 1,
          orderId: 1,
        })
        .toArray();
      const latestReviews = reviews.reverse();

      res.send(latestReviews);
    });

    // get review by order number
    app.get(
      "/get-review-by-order-number/:orderNum",
      verifyToken,
      async (req, res) => {
        const { orderNum } = req.params;
        const review = await reviewsCollection.findOne({ orderNum });
        res.send(review);
      }
    );

    // Delete my review
    app.delete("/delete-my-review", verifyToken, async (req, res) => {
      const { id } = req.query;
      const deleteReview = await reviewsCollection.deleteOne({
        _id: ObjectId(id),
      });
      res.send(deleteReview);
    });

    // My recent orders
    app.get("/my-recent-orders", verifyToken, async (req, res) => {
      const { email } = req.query;
      const orders = await orderCollection
        .find({ email })
        .project({
          orderNum: 1,
          date: 1,
          productImg: 1,
          total: 1,
        })
        .toArray();

      const orderLength = orders.length;
      const sliceOrders =
        orderLength > 3 ? orders.slice(orderLength - 3, orderLength) : orders;

      res.send(sliceOrders);
    });

    // ************ Admin control *******

    app.get("/orders", verifyToken, verifyAdmin, async (req, res) => {
      const orders = await orderCollection
        .find()
        .project({
          _id: 1,
          productImg: 1,
          productName: 1,
          productQuantity: 1,
          status: 1,
          date: 1,
        })
        .toArray();
      const recentOrders = orders.reverse();
      res.send(recentOrders);
    });

    // Order details
    app.get(
      "/order-details/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;
        const query = { _id: ObjectId(id) };
        const order = await orderCollection.findOne(query);
        res.send(order);
      }
    );

    // update order status
    app.patch(
      "/update-order-info/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;
        const updatedInfo = req.body;
        const result = await orderCollection.updateOne(
          { _id: ObjectId(id) },
          { $set: updatedInfo }
        );
        res.send(result);
      }
    );

    // Order delete
    app.delete(
      "/order-delete/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;
        const result = await orderCollection.deleteOne({ _id: ObjectId(id) });
        res.send(result);
      }
    );

    // Search order by order number
    app.get("/search-order/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await orderCollection
        .find({ orderNum: id })
        .project({
          _id: 1,
          productImg: 1,
          productName: 1,
          productQuantity: 1,
          status: 1,
          date: 1,
        })
        .toArray();
      res.send(result);
    });

    /*=====================================================================================
          ********* Manage category **********
        ==================================================================================*/
    // Get all category
    app.get("/categories", async (req, res) => {
      const result = await categoryCollection.find().toArray();
      res.send(result);
    });

    // Get latest 4 category
    app.get("/latest-category", async (req, res) => {
      const latestCategories = await categoryCollection
        .find({type : 'home'})
        .limit(4)
        .toArray();

      const reverseCategory = latestCategories.reverse();
      res.send(reverseCategory);
    });

    /*-------------- Admin control -----------------*/

    // inset a new category;
    app.post("/create-category", verifyToken, verifyAdmin, async (req, res) => {
      const categoryInfo = req.body;
      const result = await categoryCollection.insertOne(categoryInfo);
      res.send(result);
    });

    // Get all category title
    app.get("/category-title", verifyToken, verifyAdmin, async (req, res) => {
      const result = await categoryCollection
        .find()
        .project({ text: 1 })
        .toArray();
      res.send(result);
    });

    // delete category
    app.delete(
      "/delete-category/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;
        const result = await categoryCollection.deleteOne({
          _id: ObjectId(id),
        });
        res.send(result);
      }
    );

    /*==========================================
          ********* Manage Sliders **********
        ============================================*/

    // Add a new sliders
    app.post("/insert-slider", verifyToken, verifyAdmin, async (req, res) => {
      const info = req.body;
      const result = await slidersCollection.insertOne(info);
      res.send(result);
    });

    // delete a slider
    app.delete(
      "/delete-slider/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;
        const result = await slidersCollection.deleteOne({ _id: ObjectId(id) });
        res.send(result);
      }
    );

    // get sliders
    app.get("/sliders", async (req, res) => {
      const result = await slidersCollection.find().toArray();
      res.send(result);
    });

    /*============================================================
          ******** Login & Register ( User management) *******
        ============================================*/

    //  send Token after login
    app.get("/access-token", async (req, res) => {
      const { email } = req.query;
      const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
        expiresIn: "1y",
      });

      res.send({ token });
    });

    // Register
    app.put("/register", async (req, res) => {
      const email = req.query.email;
      const userDoc = { $set: req.body };
      const query = { email };
      const option = { upsert: true };
      const result = await usersCollection.updateOne(query, userDoc, option);
      res.send(result);
    });

    // get all users
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      const reverseUserInfo = result.reverse();
      res.send(reverseUserInfo);
    });

    // make amin
    app.patch("/make-admin", verifyToken, verifyAdmin, async (req, res) => {});

    // delete admin

    // get all amin
    app.get("/all-admins", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find({ role: "admin" }).toArray();
      res.send(result);
    });

    // is admin
    app.get("/is-admin/:email", async (req, res) => {
      const { email } = req.params;
      const user = await usersCollection.findOne({ email });

      if (user?.role === "admin") {
        res.send({ isAdmin: true });
      } else {
        res.send({ isAdmin: false });
      }
    });

    // Update user Address
    app.put("/update-address", verifyToken, async (req, res) => {
      const { email } = req.query;
      const query = { email };
      const option = { upsert: true };
      const info = req.body;
      const address = { $set: { address: info?.address, mob: info?.mob } };
      const result = await usersCollection.updateOne(query, address, option);
      res.send(result);
    });

    // Get my info
    app.get("/my-info", verifyToken, async (req, res) => {
      const { email } = req.query;
      const info = await usersCollection.findOne({ email });
      res.send(info);
    });
  } finally {
  }
}

run().catch(console.dir);

app.listen(PORT, () => {
  console.log("The app is running");
});
