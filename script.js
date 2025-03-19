const videoElement = document.getElementById('video');
const feedbackElement = document.getElementById('feedback');
const beepSound = document.getElementById('beep');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const bodyElement = document.body;

let isPostureCheckActive = false;
let camera = null;

// Initialize MediaPipe Pose
const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  smoothSegmentation: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

pose.onResults(onResults);

// Start the webcam
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoElement.srcObject = stream;
    isPostureCheckActive = true;
    startButton.style.display = 'none'; // Hide the start button
    stopButton.style.display = 'inline-block'; // Show the stop button
    feedbackElement.innerText = 'Analyzing posture...';
  } catch (error) {
    feedbackElement.innerText = 'Error accessing webcam: ' + error.message;
  }
}

// Stop the webcam and reset the UI
function stopCamera() {
  if (videoElement.srcObject) {
    const tracks = videoElement.srcObject.getTracks();
    tracks.forEach(track => track.stop()); // Stop all video tracks
  }
  videoElement.srcObject = null;
  isPostureCheckActive = false;
  startButton.style.display = 'inline-block'; // Show the start button
  stopButton.style.display = 'none'; // Hide the stop button
  feedbackElement.innerText = 'Posture check stopped. Click "Start Posture Check" to begin.';
  bodyElement.classList.remove('blur'); // Remove blur effect
  if (!beepSound.paused) {
    beepSound.pause();
    beepSound.currentTime = 0; // Reset sound to the beginning
  }
}

// Process pose detection results
function onResults(results) {
  if (!isPostureCheckActive) return; // Skip if posture check is not active

  if (!results.poseLandmarks) {
    feedbackElement.innerText = 'No person detected.';
    return;
  }

  // Draw landmarks on the video
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
  drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 4 });
  drawLandmarks(ctx, results.poseLandmarks, { color: '#FF0000', lineWidth: 2 });

  // Analyze posture
  const isGoodPosture = analyzePosture(results.poseLandmarks);

  // Provide feedback, play beep sound, and blur screen for bad posture
  if (!isGoodPosture) {
    feedbackElement.innerText = 'Wrong posture! Adjust your body.';
    bodyElement.classList.add('blur'); // Add blur effect
    if (beepSound.paused) {
      beepSound.play().catch(error => {
        console.error('Error playing sound:', error);
      });
    }
  } else {
    feedbackElement.innerText = 'Good posture! Keep it up.';
    bodyElement.classList.remove('blur'); // Remove blur effect
    if (!beepSound.paused) {
      beepSound.pause();
      beepSound.currentTime = 0; // Reset sound to the beginning
    }
  }
}

// Analyze posture based on landmarks
function analyzePosture(landmarks) {
  const leftShoulder = landmarks[11]; // Left shoulder landmark
  const rightShoulder = landmarks[12]; // Right shoulder landmark
  const leftHip = landmarks[23]; // Left hip landmark
  const rightHip = landmarks[24]; // Right hip landmark

  // Calculate shoulder and hip alignment
  const shoulderSlope = Math.abs((rightShoulder.y - leftShoulder.y) / (rightShoulder.x - leftShoulder.x));
  const hipSlope = Math.abs((rightHip.y - leftHip.y) / (rightHip.x - leftHip.x));

  // Thresholds for alignment
  const shoulderThreshold = 0.1; // Adjust this value as needed
  const hipThreshold = 0.1; // Adjust this value as needed

  // Check if shoulders and hips are level
  if (shoulderSlope > shoulderThreshold || hipSlope > hipThreshold) {
    return false; // Bad posture
  } else {
    return true; // Good posture
  }
}

// Start the camera and pose detection when the start button is clicked
startButton.addEventListener('click', () => {
  startCamera();
  camera = new Camera(videoElement, {
    onFrame: async () => {
      await pose.send({ image: videoElement });
    },
    width: 640,
    height: 480,
  });
  camera.start();
});

// Stop the camera and reset the UI when the stop button is clicked
stopButton.addEventListener('click', () => {
  stopCamera();
  if (camera) {
    camera.stop();
  }
});