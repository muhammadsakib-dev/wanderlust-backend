import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import cors from "cors";

// Initialize the Express app
const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(express.json());

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server proxy)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Dev-friendly fallback
    },
    credentials: true,
  })
);

// Connect to MongoDB
const uri = `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.p16xpfx.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri);

const dbName = process.env.DB_NAME || "wanderlust";

const db = client.db(dbName);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return db;
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

await connectToMongoDB();

// Start the server
app.get("/", (req, res) => {
  res.send("Hello, World!");
});

// Handler for creating a destination
const handleCreateDestination = async (req, res) => {
  try {
    const { destinationName, name, title, country, price } = req.body;
    if (!destinationName && !name && !title) {
      return res.status(400).json({ error: "Destination name is required." });
    }
    const collection = db.collection("destinations");
    const payload = {
      ...req.body,
      price: Number(price) || price || 0,
      createdAt: new Date(),
    };
    const result = await collection.insertOne(payload);
    res.status(201).json({ ...payload, _id: result.insertedId });
  } catch (error) {
    console.error("Error inserting destination:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};

// Post Data to MongoDB (RESTful /destinations + legacy alias /add-destination)
app.post("/destinations", handleCreateDestination);
app.post("/add-destination", handleCreateDestination);

app.get("/destinations", async (req, res) => {
  try {
    const collection = db.collection("destinations");
    const destinations = await collection.find({}).toArray();
    res.status(200).json(destinations);
  } catch (error) {
    console.error("Error fetching destinations:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// Get Single Destination by ID or Slug
app.get("/destinations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const collection = db.collection("destinations");
    const query = ObjectId.isValid(id)
      ? { $or: [{ _id: new ObjectId(id) }, { id: id }] }
      : { $or: [{ id: id }, { slug: id }] };
    const destination = await collection.findOne(query);

    if (!destination) {
      return res.status(404).json({ error: "Destination not found" });
    }
    res.status(200).json(destination);
  } catch (error) {
    console.error("Error fetching destination by id:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// Update Destination by ID
app.put("/destinations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const collection = db.collection("destinations");
    const query = ObjectId.isValid(id)
      ? { $or: [{ _id: new ObjectId(id) }, { id: id }] }
      : { $or: [{ id: id }, { slug: id }] };
    const { _id, ...updateData } = req.body;
    const result = await collection.updateOne(query, { $set: updateData });
    res.status(200).json(result);
  } catch (error) {
    console.error("Error updating destination:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// Delete Destination by ID
app.delete("/destinations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const collection = db.collection("destinations");
    const query = ObjectId.isValid(id)
      ? { $or: [{ _id: new ObjectId(id) }, { id: id }] }
      : { $or: [{ id: id }, { slug: id }] };
    const result = await collection.deleteOne(query);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error deleting destination:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// GET Bookings (Support filter by logged-in user email or fetch all for admin, exclude legacy fake seeds)
app.get("/bookings", async (req, res) => {
  try {
    const collection = db.collection("bookings");
    const { email } = req.query;
    const query = {
      id: { $nin: ["b1", "b2", "b3"] },
      ...(email ? { userEmail: email } : {}),
    };
    const bookings = await collection.find(query).sort({ createdAt: -1 }).toArray();
    res.status(200).json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// POST Create Real Booking attached to logged-in user
app.post("/bookings", async (req, res) => {
  try {
    const { userEmail, destinationName } = req.body;
    if (!userEmail || !destinationName) {
      return res
        .status(400)
        .json({ error: "userEmail and destinationName are required to create a booking." });
    }
    const collection = db.collection("bookings");
    const newBooking = {
      ...req.body,
      id: req.body.id || `b-${Date.now().toString().slice(-6)}`,
      userEmail: String(userEmail).trim().toLowerCase(),
      userName: req.body.userName || "Traveler",
      status: req.body.status || "Confirmed",
      price: Number(req.body.price) || 1299,
      createdAt: new Date(),
    };
    const result = await collection.insertOne(newBooking);
    res.status(201).json({ ...newBooking, _id: result.insertedId });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// DELETE Booking by ID (Cancel Booking)
app.delete("/bookings/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const collection = db.collection("bookings");
    const query = ObjectId.isValid(id)
      ? { $or: [{ _id: new ObjectId(id) }, { id: id }] }
      : { id: id };
    const result = await collection.deleteOne(query);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// PUT Update Booking Status
app.put("/bookings/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const collection = db.collection("bookings");
    const query = ObjectId.isValid(id)
      ? { $or: [{ _id: new ObjectId(id) }, { id: id }] }
      : { id: id };
    const { _id, ...updateData } = req.body;
    const result = await collection.updateOne(query, { $set: updateData });
    res.status(200).json(result);
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
