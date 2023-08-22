const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const KJUR = require("jsrsasign");

const app = express();
const port = 4000;

const clientId = "86p_Jo3RVOshONM3pKetg"; // Replace with your actual client ID
const clientSecret = "83CEye9y7tRNnMzx5oqar6ZPTvgfzSbg"; // Replace with your actual client secret
const redirectUri = "https://3c47-45-125-4-65.ngrok-free.app/"; // Replace with your actual ngrok URL

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());

app.use(express.static(path.join(__dirname, "build")));

app.get("/fetch-user-id", async (req, res) => {
  const accessToken = req.query.accessToken; // Get the access token from the query parameter

  try {
    const response = await axios.get("https://api.zoom.us/v2/users/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userId = response.data.id; // Extract the userId from the response
    console.log("User ID:", userId);
    res.json({ userId });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

app.get("/generate-zak/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const accessToken = req.headers.authorization.split(" ")[1]; // Extract token from authorization header

    const response = await axios.get(
      `https://api.zoom.us/v2/users/${userId}/token?type=zak`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const zakToken = response.data.token;
    console.log("Zak token retrieved:", zakToken);

    res.json({ zakToken });
  } catch (error) {
    console.error("Error getting ZAK token:", error);
    res.status(500).json({ error: "Error getting ZAK token" });
  }
});

app.post("/generate-signature", (req, res) => {
  const iat = Math.round(new Date().getTime() / 1000) - 30;
  const exp = iat + 60 * 60 * 2;

  const oHeader = { alg: "HS256", typ: "JWT" };

  const oPayload = {
    sdkKey: clientId,
    mn: req.body.meetingNumber,
    role: req.body.role,
    iat: iat,
    exp: exp,
    appKey: clientId,
    tokenExp: iat + 60 * 60 * 2,
  };

  const sHeader = JSON.stringify(oHeader);
  const sPayload = JSON.stringify(oPayload);
  const signature = KJUR.jws.JWS.sign("HS256", sHeader, sPayload, clientSecret);

  res.json({
    signature: signature,
  });
});

app.post("/oauth/callback", async (req, res) => {
  // Exchange authorization code for access token
  const code = req.body.code;
  console.log("Making post request with code:", code);

  if (code) {
    try {
      const response = await axios.post(
        "https://zoom.us/oauth/token",
        `grant_type=authorization_code&code=${code}&redirect_uri=${redirectUri}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${clientId}:${clientSecret}`
            ).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const accessToken = response.data.access_token;
      console.log("Access token retrieved:", accessToken);

      res.json(response.data);
    } catch (error) {
      console.error("Error exchanging code for access token:", error);
      res.status(500).json({ error: "Error exchanging code for access token" });
    }
  } else {
    res.status(400).json({ error: "Missing code parameter" });
  }
});

app.post("/create-meeting", async (req, res) => {
  // Create meeting via Zoom API
  const { userId, accessToken, meetingData } = req.body; // Access token obtained from OAuth process

  try {
    const response = await axios.post(
      "https://api.zoom.us/v2/users/me/meetings",
      // `https://api.zoom.us/v2/users/${userId}/meetings`,
      meetingData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error creating meeting:", error);
    res.status(500).json({ error: "Error creating meeting" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
