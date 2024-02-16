require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();

app.use(express.json());
app.use(cors());
const port = process.env.PORT || 5000;

const SSLCommerzPayment = require("sslcommerz-lts");
const store_id = "bussw65890f65c0819";
const store_passwd = "bussw65890f65c0819@ssl";
const is_live = false; //true for live, false for sandbox

app.get("/", async (req, res) => {
  res.send("hey running");
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://volunteer:${process.env.PASSWORD}@cluster0.5mwmpl3.mongodb.net/?retryWrites=true&w=majority`;

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
    const ItemsCollection = client.db("Restaurant").collection("Items");
    const cartCollection = client.db("Restaurant").collection("cart");
    const orderCollection = client.db("Restaurant").collection("order");

    app.get("/items", async (req, res) => {
      const query = {};
      const result = await ItemsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/items/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };

      const result = await ItemsCollection.findOne(query);
      res.send(result);
    });

    // handeling the cart ..........
    app.post("/cart", async (req, res) => {
      try {
        const query = req.body;

        // Perform any necessary operations with the request body here
        const result = await cartCollection.insertOne(query);
        res.send(result);
        //     console.log(result);
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/cart", async (req, res) => {
      const query = {};
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/deletecart", async (req, res) => {
      const id = req.body._id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);

      console.log(id);
    });

    app.post("/orderData", async (req, res) => {
      const query = req.body;
      const result = await orderCollection.insertOne(query);
      console.log(result);
      res.send(result);
    });
    app.post("/updatecart", async (req, res) => {
      try {
        const updatedCarts = req.body;
    
        // Iterate through each updated cart item and update in the database
        const updatePromises = updatedCarts.map(async (updatedCart) => {
          const { _id, count } = updatedCart;
    
          // Assuming each item in the cart has a unique identifier like '_id'
          const filter = { _id: new ObjectId(_id) };
          const update = { $set: { count } };
    
          // Update the cart item in the database
          const result = await cartCollection.updateOne(filter, update);
    
          return result;
        });
    
        // Wait for all updates to complete
        const updateResults = await Promise.all(updatePromises);
    
        // Calculate the total updated count
        const updatedCount = updateResults.reduce(
          (total, result) => total + result.modifiedCount,
          0
        );
    
        res.json({ updatedCount });
      } catch (error) {
        console.error('Error updating cart:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });
    

    app.get('/order',async(req,res)=>{
       const query={}
       const result=await orderCollection.find(query).toArray()
       res.send(result)
    })
    const tran_id = new ObjectId().toString();
    app.post("/orderpayment", async (req, res) => {
      const query = req.body;
      // const result = await orderCollection.insertOne(query);
      const price = query.total;
      // res.send(result);

      const data = {
        total_amount: price,
        currency: "BDT",
        tran_id: tran_id, // use unique tran_id for each api call
        success_url: `http://localhost:4000/payment/success/${tran_id}`,
        fail_url: `http://localhost:4000/payment/fail/${tran_id}`,
        cancel_url: "http://localhost:3030/cancel",
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: "Computer.",
        product_category: "Electronic",
        product_profile: "general",
        cus_name: "Customer Name",
        cus_email: "customer@example.com",
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };

      console.log(data);
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then((apiResponse) => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.send({ url: GatewayPageURL });

        console.log("Redirecting to: ", GatewayPageURL);
        const finalOrder = {
            paidStatus: false,
            tranjectionId: tran_id,
            orderInfo: query,
          };
          const result = orderCollection.insertOne(finalOrder);
          console.log("Redirecting to: ", finalOrder);
      });
    });

    app.post("/payment/success/:tranId", async (req, res) => {
      console.log("train id", req.params.tranId);
      const result = await orderCollection.updateOne(
        {
          tranjectionId: req.params.tranId,
        },
        {
          $set: {
            paidStatus: true,
          },
        }
      );

      if (result.modifiedCount > 0) {
        res.redirect(
          `http://localhost:5173/payment/success/${req.params.tranId}`
        );
      }
    });

    app.post("/payment/fail/:tranId", async (req, res) => {
      console.log("Failure route accessed. TranId:", req.params.tranId);
      res.redirect(`http://localhost:5173/payment/fail/${req.params.tranId}`);
      
      const result = await orderCollection.deleteOne({
        tranjectionId: req.params.tranId,
      });
    
      
    });
    

    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //     await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`running at ${port}`);
});
