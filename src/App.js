import React, { useState, useEffect } from "react";
import axios from "axios";
import { ZoomMtg } from "@zoomus/websdk"; // Import ZoomMtg component
import KJUR from "jsrsasign"; // Import KJUR library

ZoomMtg.setZoomJSLib("https://source.zoom.us/2.15.2/lib", "/av");
ZoomMtg.preLoadWasm();
ZoomMtg.prepareWebSDK();
ZoomMtg.i18n.load("en-US");
ZoomMtg.i18n.reload("en-US");

const clientId = "86p_Jo3RVOshONM3pKetg";
const redirectUri = "https://3c47-45-125-4-65.ngrok-free.app/"; // Replace with your actual ngrok URL

const App = () => {
  const [accessToken, setAccessToken] = useState("");
  const [createdMeeting, setCreatedMeeting] = useState(null); // Added state for created meeting

  //Zoom OAuth Process
  const handleLogin = () => {
    // Take user to Zoom OAuth page
    window.location.href = `https://zoom.us/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
  };

  useEffect(() => {
    // After user logs in and receives authorization code, make a POST request to exchange the code for an access token
    const urlParams = new URLSearchParams(window.location.search);
    const authorizationCode = urlParams.get("code");

    if (authorizationCode) {
      console.log("Received authorization code:", authorizationCode);

      axios
        .post(
          "https://3c47-45-125-4-65.ngrok-free.app/oauth/callback",
          { code: authorizationCode },
          { headers: { "Content-Type": "application/json" } }
        )
        .then((response) => {
          const accessToken = response.data.access_token;
          console.log("Access token received:", accessToken);
          setAccessToken(accessToken);
        })
        .catch((error) => {
          console.error("Error exchanging code for access token:", error);
        });
    }
  }, []);
  //Zoom OAuth Process

  const fetchZAKToken = async (userId, accessToken) => {
    try {
      const response = await axios.get(
        `https://3c47-45-125-4-65.ngrok-free.app/generate-zak/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`, // Include the access token in the headers
          },
        }
      );

      return response.data.zakToken;
    } catch (error) {
      console.error("Error fetching ZAK token:", error);
      return null;
    }
  };

  const fetchSignature = async (meetingId) => {
    try {
      const response = await axios.post(
        "https://3c47-45-125-4-65.ngrok-free.app/generate-signature", // Replace with the URL of your backend route that generates the signature
        {
          meetingNumber: meetingId, // Meeting ID
          role: 1, //
        }
      );

      return response.data.signature; // Return the generated signature
    } catch (error) {
      console.error("Error fetching signature:", error);
      return null;
    }
  };

  const startMeeting = async () => {
    try {
      const getUserIdResponse = await axios.get(
        "https://3c47-45-125-4-65.ngrok-free.app/fetch-user-id", // Update with your server domain
        {
          params: {
            accessToken: accessToken, // Pass the access token obtained during OAuth
          },
        }
      );

      const userId = getUserIdResponse.data.userId;
      console.log("User ID:", userId);

      const createMeetingResponse = await axios.post(
        "https://3c47-45-125-4-65.ngrok-free.app/create-meeting",
        {
          userId: userId,
          accessToken: accessToken,
          meetingData: {
            topic: "My Meeting",
            type: 1,
          },
        }
      );

      const newMeeting = createMeetingResponse.data;
      console.log(newMeeting, "newMeeting");

      setCreatedMeeting(newMeeting); // Update the createdMeeting state

      const zakToken = await fetchZAKToken(userId, accessToken);

      if (zakToken) {
        const signature = await fetchSignature(newMeeting.id);

        if (signature) {
          document.getElementById("zmmtg-root").style.display = "block";

          ZoomMtg.init({
            leaveUrl: "https://zoom.us",
            success: (success) => {
              ZoomMtg.join({
                sdkKey: clientId,
                signature: signature,
                meetingNumber: newMeeting.id,
                userName: "React User",
                // userEmail: "user@example.com",
                tk: "",
                zak: zakToken,
                success: (success) => {
                  console.log("success", success);
                },
                error: (error) => {
                  console.log("error joining", error);
                },
              });
            },
            error: (error) => {
              console.log("error", error);
            },
          });
        }
      }
    } catch (error) {
      console.error("Error creating or starting meeting:", error);
      // Handle the error
    }
  };

  return (
    <div className="App">
      <main>
        <h1>Zoom Meeting App</h1>
        {!accessToken ? (
          <div>
            <button onClick={handleLogin}>Login with Zoom</button>
          </div>
        ) : (
          <div>
            <p>Access Token: {accessToken}</p>
            {createdMeeting ? (
              <div>
                <p>Meeting ID: {createdMeeting.id}</p>
                <p>Meeting Topic: {createdMeeting.topic}</p>
              </div>
            ) : (
              <div>
                <button onClick={startMeeting}>Create Meeting</button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
