import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import cors from "cors";

// Initialize the Express app
const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(express.json());
app.use(cors());

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

// Post Data to MongoDB
app.post("/add-destination", async (req, res) => {
  try {
    const collection = db.collection("destinations");
    const result = await collection.insertOne(req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error("Error inserting destination:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
