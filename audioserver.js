const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const { SpeechClient } = require('@google-cloud/speech').v1;

const app = express();
const port = process.env.PORT || 8000;

// Use cors middleware to allow requests from any origin
app.use(cors());

// Set up Google Cloud Storage
const storage = new Storage({
  keyFilename: JSON.parse(process.env.CLOUD_STORAGE_KEYFILE),
});
const bucketName = 'summary-master'; // Replace with your GCS bucket name
const bucket = storage.bucket(bucketName);

// Set up Google Cloud Speech-to-Text
const speechClient = new SpeechClient({
  keyFilename: JSON.parse(process.env.SPEECH_TO_TEXT_KEYFILE),
});

// Configure multer for handling file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Define endpoint for uploading audio and transcribing
app.post('/upload-audio', upload.single('audioFile'), async (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        // Divide the audio file into smaller segments (e.g., 30 seconds each)
        const segmentSize = 30 * 1000; // 30 seconds in milliseconds
        const audioSegments = divideAudioIntoSegments(file.buffer, segmentSize);

        // Object to store transcriptions of each segment
        const transcriptions = {};

        // Process each audio segment asynchronously
        await Promise.all(audioSegments.map(async (segment, index) => {
            try {
                // Upload the segment to GCS asynchronously
                const segmentFileName = `${file.originalname}-part-${index}`;
                await uploadToGCS(segmentFileName, segment);

                // Configure the audio settings for transcription
                const audioConfig = {
                    encoding: 'MP3',
                    sampleRateHertz: 16000,
                    languageCode: 'en-US',
                    enableAutomaticPunctuation: true, // Enable automatic punctuation
                };

                // Configure the audio source
                const audio = {
                    uri: `gs://${bucketName}/${segmentFileName}`,
                };

                // Set up the speech recognition request
                const request = {
                    audio: audio,
                    config: audioConfig,
                };

                // Perform the speech recognition asynchronously
                const [response] = await speechClient.recognize(request);

                // Process the transcription response
                const transcription = response.results
                    .map(result => result.alternatives[0].transcript)
                    .join('\n');

                // Store the transcription with its segment index
                transcriptions[index] = transcription;
            } catch (error) {
                console.error(`Error processing segment ${index}:`, error);
                // Store an empty transcription if an error occurs
                transcriptions[index] = '';
            }
        }));

        // Combine transcriptions from all segments
        const fullTranscription = Object.values(transcriptions).join('\n');

        console.log('Full Transcription:', fullTranscription);

        // Delete the uploaded files from GCS
        await deleteSegmentsFromGCS(file.originalname, audioSegments.length);

        console.log('Segments deleted from GCS');

        res.status(200).json({ transcription: fullTranscription });
    } catch (error) {
        console.error('Error processing audio:', error);
        res.status(500).json({ error: 'Failed to process audio' });
    }
});

// Function to divide audio into smaller segments
function divideAudioIntoSegments(audioData, segmentSize) {
    const audioSegments = [];
    let offset = 0;

    while (offset < audioData.length) {
        const segment = audioData.slice(offset, offset + segmentSize);
        audioSegments.push(segment);
        offset += segmentSize;
    }

    return audioSegments;
}

// Function to upload a file to GCS asynchronously
async function uploadToGCS(bucketName, fileName, data) {
  try {
    // Convert fileName to a string if it's not already
    const stringFileName = String(fileName);

    // Log the stringFileName to check its value
    console.log('stringFileName:', stringFileName);

    // Create a file object representing the destination in GCS
    const file = bucket.file(stringFileName);

    // Create a write stream for uploading data to the file
    const stream = file.createWriteStream({
      metadata: {
        contentType: 'audio/mpeg' // Set content type for MP3 files
      }
    });

    // Efficiently stream the data to GCS
    await new Promise((resolve, reject) => {
      stream.on('error', (err) => {
        console.error('Error uploading file to GCS:', err);
        reject(err);
      });

      stream.on('finish', () => {
        console.log('File uploaded successfully:', stringFileName);
        resolve();
      });

      stream.write(data); // Write the data to the stream
      stream.end(); // Signal the end of the stream
    });

    return { message: 'File uploaded successfully!' }; // Return success message
  } catch (err) {
    console.error('Error uploading file to GCS:', err);
    throw err; // Re-throw for external error handling
  }
}


// Function to delete the uploaded segments from GCS
async function deleteSegmentsFromGCS(originalFileName, numSegments) {
    const deletePromises = [];

    for (let i = 0; i < numSegments; i++) {
        const segmentFileName = `${originalFileName}-part-${i}`;
        const file = bucket.file(segmentFileName);
        deletePromises.push(file.delete());
    }

    await Promise.all(deletePromises);
}

// Start the server
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
