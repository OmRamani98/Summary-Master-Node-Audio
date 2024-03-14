const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { SpeechClient } = require('@google-cloud/speech').v1;
const path = require('path');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 8000;

app.use(cors({
  origin: '*' // Replace with your React app's origin
}));// Enable CORS for all routes

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Generate a dynamic filename with a unique suffix
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Function to split audio into 1-second segments
const splitAudioIntoSegments = async (filePath) => {
  const audioSegments = [];

  // Read the audio file
  const audioData = fs.readFileSync(filePath);
  const audioLength = audioData.length;
  const segmentSize = 16000 * 2; // Assuming 16-bit audio at 16 kHz (1-second segment)

  // Split the audio into segments
  for (let i = 0; i < audioLength; i += segmentSize) {
    const segment = audioData.slice(i, i + segmentSize);
    audioSegments.push(segment);
  }

  return audioSegments;
};

// Function to get file extension
const getFileExtension = (filename) => {
  return filename.split('.').pop().toLowerCase();
};

// POST endpoint for handling audio file upload and text extraction
app.post('/upload-audio', upload.single('audioFile'), async (req, res) => {
  const { path } = req.file;

  try {
    // Create a Speech-to-Text client
    const client = new SpeechClient({
      keyFilename: 'node audioserver.js' // Replace with your Google Cloud service account key file path
    });

    // Split the audio into 1-second segments
    const audioSegments = await splitAudioIntoSegments(path);

    // Define recognition config
    let config = {
      sampleRateHertz: 16000,
      languageCode: 'en-US',
      enableAutomaticPunctuation: true
    };

    // Detect file extension and set encoding accordingly
    const fileExtension = getFileExtension(req.file.originalname);
    if (fileExtension === 'mp3') {
      config.encoding = 'MP3';
    } else if (fileExtension === 'wav') {
      config.encoding = 'LINEAR16';
    } // Add more cases as needed for other audio formats

    const transcriptions = [];

    // Recognize speech for each segment
    for (const segment of audioSegments) {
      const audio = {
        content: segment
      };

      const [response] = await client.recognize({
        audio: audio,
        config: config
      });

      const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join('\n');

      transcriptions.push(transcription);
    }

    // Join transcriptions from all segments
    const fullTranscription = transcriptions.join('\n');

    res.header('Access-Control-Allow-Origin', '*'); // Allow CORS for this specific route
    res.json({ textContent: fullTranscription });
  } catch (error) {
    console.error('Error extracting text:', error);
    res.status(500).json({ error: 'Failed to extract text' });
  } finally {
    // Delete the temporary uploaded file
    fs.unlinkSync(path);
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
