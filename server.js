// Load environment variables from a .env file into process.env
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");


// Import required modules
const express = require("express"); // Framework for building web applications
const mongoose = require("mongoose"); // MongoDB object modeling tool
const jwt = require("jsonwebtoken"); // JSON Web Token library for authentication
const cors = require("cors"); // Middleware to enable Cross-Origin Resource Sharing
const bcrypt = require("bcryptjs"); // Library to hash passwords
const genAI = new GoogleGenerativeAI(process.env.API_KEY);


// Initialize the Express app
const app = express();

// Define the secret key for JWT from environment variables
const SECRET_KEY = process.env.JWT_SECRET;

// Middleware to enable Cross-Origin Resource Sharing for all routes
app.use(cors());

// Middleware to parse incoming JSON request bodies
app.use(express.json());

// ===============================
// Define MongoDB User Schema and Model
// ===============================
// Define the schema for user documents in MongoDB
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
});

// Create a User model using the defined schema
const User = mongoose.model("User", UserSchema);
const URI =
  "mongodb+srv://kennyabolade117:Jrzfi7b71DFRacTH@cluster0.vitq7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
// ===============================
// Connect to MongoDB
// ===============================
// Connect to the MongoDB database using the connection string from environment variables
mongoose
  .connect(URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB Connected")) // Log success message on connection
  .catch((err) => console.error("MongoDB Connection Error:", err)); // Log error if connection fails

// ===============================
// User Signup Endpoint
// ===============================
// Define the /signup route to handle user registration
app.post("/signup", async (req, res) => {
  try {
    // Extract the username, email, and password from the request body
    const { username, email, password } = req.body;

    // Check if a user with the same username or email already exists
    let user = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (user) {
      // If user exists, respond with a 400 status and an error message
      return res.status(400).json({ message: "User already exists" });
    }

    // Generate a salt for password hashing
    const salt = await bcrypt.genSalt(10);
    // Hash the user's password using bcrypt
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create a new user object with the provided details
    user = new User({
      username,
      email,
      password: hashedPassword,
    });

    // Save the new user to the database
    await user.save();

    // Generate a JWT token for the newly registered user
    const token = jwt.sign(
      { id: user._id, username: user.username },
      SECRET_KEY,
      { expiresIn: "1h" } // Token expires in 1 hour
    );

    // Respond with the generated token
    res.status(201).json({ token });
  } catch (error) {
    // Respond with a 500 status if there is a server error
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ===============================
// User Login Endpoint
// ===============================
// Define the /login route to handle user authentication
app.post("/login", async (req, res) => {
  try {
    // Extract the username and password from the request body
    const { username, password } = req.body;

    // Find a user with the provided username
    const user = await User.findOne({ username });
    if (!user) {
      // Respond with a 400 status if the user is not found
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Compare the provided password with the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Respond with a 400 status if the password does not match
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate a JWT token for the authenticated user
    const token = jwt.sign(
      { id: user._id, username: user.username },
      SECRET_KEY,
      { expiresIn: "1h" } // Token expires in 1 hour
    );

    // Respond with the generated token
    res.json({ token });
  } catch (error) {
    // Respond with a 500 status if there is a server error
    res.status(500).json({ message: "Server error" });
  }
});

// ===============================
// Protected Route
// ===============================
// Define the /protected route to access dashboard/homepage
app.get("/homepage", authenticateToken, (req, res) => {
  // Respond with a message and the authenticated user's data
  res.json({
    message: "User can access dashboard",
    user: req.user,
  });
});

app.post("/translate", async (req, res) => {
  try {
    const { textTotranslate } = req.body;
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Translate this text: ${textTotranslate} to yoruba, dont give me anything else apart from the translation`;
    const result = await model.generateContent(prompt);
    res.json(result.response.text());
  } catch (error) {
    console.log(error);   
  }
});

// ===============================
// Middleware for Token Verification
// ===============================
// Middleware to authenticate JWT tokens
function authenticateToken(req, res, next) {
  // Extract the Authorization header from the request
  const authHeader = req.headers["authorization"];
  // Extract the token from the header (format: "Bearer <token>")
  const token = authHeader && authHeader.split(" ")[1];

  // If no token is provided, respond with a 401 status
  if (token == null) return res.sendStatus(401);

  // Verify the token using the secret key
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403); // Respond with 403 if the token is invalid
    req.user = user; // Attach the decoded user data to the request
    next(); // Proceed to the next middleware or route handler
  });
}

// ===============================
// Start the Server
// ===============================
// Define the port from environment variables or default to 5000
const PORT = process.env.PORT || 5000;
// Start the server and listen for incoming requests
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
