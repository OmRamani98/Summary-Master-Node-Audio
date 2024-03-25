// const express = require('express');
// const multer = require('multer');
// const cors = require('cors');
// const { Storage } = require('@google-cloud/storage');
// const { SpeechClient } = require('@google-cloud/speech').v1;

// const app = express();
// app.use(cors());
// const port = process.env.PORT || 8000;

// // Set up Google Cloud Storage using service account key from environment variable
// const storage = new Storage({
//   projectId: "summary-master-sdp",
//   credentials: JSON.parse(process.env.CLOUD_STORAGE_KEYFILE)
// });
// const bucketName = 'summary-master'; // Replace with your GCS bucket name
// const bucket = storage.bucket(bucketName);

// // Set up Google Cloud Speech-to-Text
// const speechClient = new SpeechClient({
//   projectId: "summary-master-sdp", // Replace with your Google Cloud project ID
//   credentials: JSON.parse(process.env.SPEECH_TO_TEXT_KEYFILE)
// });

// // Configure multer for handling file uploads
// const upload = multer({ storage: multer.memoryStorage() });

// // Define endpoint for uploading MP3 files
// app.post('/upload-audio', upload.single('audioFile'), async (req, res) => {
//   try {
//     const file = req.file;
//     if (!file) {
//       return res.status(400).json({ error: 'No file uploaded' });
//     }

//     // Configure audio settings for speech recognition
//     const audioConfig = {
//       encoding: 'MP3',
//       sampleRateHertz: 16000, // Adjust as needed
//       languageCode: 'en-US', // Language code
//       enableAutomaticPunctuation: true // Enable automatic punctuation
//     };

//     // Configure the audio source
//     const audio = {
//       content: file.buffer.toString('base64')
//     };

//     // Set up the speech recognition request
//     const request = {
//       audio: audio,
//       config: audioConfig
//     };

//     // Perform the speech recognition
//     const [response] = await speechClient.recognize(request);

//     // Process the transcription response
//     const transcription = response.results
//       .map(result => result.alternatives[0].transcript)
//       .join('\n');

//     // Respond with the transcription
//     res.status(200).json({ textContent: transcription });
//   } catch (error) {
//     console.error('Error processing audio:', error);
//     res.status(500).json({ error: 'Failed to process audio' });
//   }
// });

// // Start the server
// app.listen(port, () => {
//   console.log(`Server is running on port ${port}`);
// });


const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const { SpeechClient } = require('@google-cloud/speech').v1;

const app = express();
app.use(cors());
const port = process.env.PORT || 8000;

// Set up Google Cloud Storage using service account key from environment variable
const storage = new Storage({
  projectId: "summary-master-sdp",
  credentials: JSON.parse(process.env.CLOUD_STORAGE_KEYFILE)
});
const bucketName = 'summary-master'; // Replace with your GCS bucket name
const bucket = storage.bucket(bucketName);

// Set up Google Cloud Speech-to-Text
const speechClient = new SpeechClient({
  projectId: "summary-master-sdp", // Replace with your Google Cloud project ID
  credentials: JSON.parse(process.env.SPEECH_TO_TEXT_KEYFILE)
});

// Configure multer for handling file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Define endpoint for uploading MP3 files
app.post('/upload-audio', upload.single('audioFile'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Configure audio settings for speech recognition
    const audioConfig = {
      encoding: 'MP3',
      sampleRateHertz: 16000, // Adjust as needed
      languageCode: 'en-US', // Language code
      enableAutomaticPunctuation: true // Enable automatic punctuation
    };

    // Configure the audio source
    const audio = {
      content: file.buffer.toString('base64')
    };

    // Set up the speech recognition request
    const request = {
      audio: audio,
      config: audioConfig
    };

    // Perform the speech recognition
    const [response] = await speechClient.recognize(request);

    // Process the transcription response
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');

    // Remove the uploaded file from memory
    deleteUploadedFile(file);

    // Respond with the transcription
    res.status(200).json({ textContent: transcription });
  } catch (error) {
    console.error('Error processing audio:', error);
    res.status(500).json({ error: 'Failed to process audio' });
  }
});

// Function to delete the uploaded file from memory
function deleteUploadedFile(file) {
  // Use the file reference to delete the buffer from memory
  file.buffer = null;
}

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
