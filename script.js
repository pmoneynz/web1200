//sequencer.js
// =========================== INIT ================================= //

// Initialize the transport
Tone.Transport.PPQ = 24;
Tone.Transport.timeSignature = 4;
Tone.Transport.bpm.value = 120;
Tone.Transport.swingSubdivision = '16n';

// Retrieve DOM elements
const partLengthInput = document.getElementById('partLength');
const tempoInput = document.getElementById('tempo');
const playStopButton = document.getElementById('playStopButton');
const deleteButton = document.getElementById('deleteButton');
const eraseAllButton = document.getElementById('eraseAllButton');
const counterDisplay = document.getElementById('counter');
const swingSelect = document.getElementById('swingSelect');
const swingValue = document.getElementById('swingValue');
const muteButton = document.getElementById('muteButton');
const quantizeSelect = document.getElementById('quantizeSelect');
let quantizeValue = quantizeSelect.value; 

// =========================== EVENT LISTENERS ================================= //

// Bind the functions to the input elements and button
partLengthInput.addEventListener('change', setPartLength);
tempoInput.addEventListener('change', debounce(setTempo, 200)); // 200ms delay
playStopButton.addEventListener('click', togglePlayback);
eraseAllButton.addEventListener('click', removeAllEventsFromPart);
muteButton.addEventListener('click', mute);
swingSelect.addEventListener('change', (e) => {
  const swingValue = parseFloat(e.target.value);
  Tone.Transport.swing = swingValue;
});
swingValue.addEventListener('change', (e) => {
  const swingSubdivisionValue = e.target.value;
  Tone.Transport.swingSubdivision = swingSubdivisionValue;
});
quantizeSelect.addEventListener('change', (e) => {
  quantizeValue = e.target.value;
});

// =========================== METRONOME ================================= //

// Load the metronome samples
const clickHi = new Tone.Player("samples/ClickHi.mp3").toDestination();
const clickLo = new Tone.Player("samples/ClickLo.mp3").toDestination();

function mute() {
  // Toggle the mute state based on the current state
  const newState = !clickHi.mute;
  clickLo.mute = newState;
  clickHi.mute = newState;
  muteButton.textContent = newState ? "Metronome Off" : "Metronome On";
}

function createMetronomePart() {
  const metronomeLoop = new Tone.Loop((time) => {
    const position = Tone.Transport.position;
    const parts = position.split(':');
    const beats = parseInt(parts[1]);
    if (beats === 0) {
      clickHi.start(time);
    } else {
      clickLo.start(time);
    }
  }, '4n');

  return {
    start: function() {
      metronomeLoop.start(0);
    },
    stop: function() {
      metronomeLoop.stop();
    }
  };
}

const metronomePart = createMetronomePart();

// =========================== PADS ================================= //

// Define pads
const pads = [
  // Bank A
  { name: "pad0", sample: "samples/kick.wav" },
  { name: "pad1", sample: "samples/snare.wav" },
  { name: "pad2", sample: "samples/hihat.wav" },
  { name: "pad3", sample: "samples/clap.wav" },
  { name: "pad4", sample: "samples/tom.wav" },
  { name: "pad5", sample: "samples/perc.wav" },
  { name: "pad6", sample: "samples/ride.wav" },
  { name: "pad7", sample: "samples/cowbell.wav" },
  // Bank B
  { name: "pad8", sample: "samples/OS_IV1_Kick_Sharp.wav" },
  { name: "pad9", sample: "samples/OS_IV1_Snare_Trap_1.wav" },
  { name: "pad10", sample: "samples/empty.mp3" },
  { name: "pad11", sample: "samples/empty.mp3" },
  { name: "pad12", sample: "samples/empty.mp3" },
  { name: "pad13", sample: "samples/empty.mp3" },
  { name: "pad14", sample: "samples/empty.mp3" },
  { name: "pad15", sample: "samples/empty.mp3" }
];

// Create an array of promises for loading the samples
const preloadPromises = pads.map((pad) => {
  return new Promise((resolve) => {
    pad.player = new Tone.Player(pad.sample).toDestination();
    pad.player.onload = () => {
      resolve(); // Resolve the promise when the sample is loaded
    };
  });
});

// Wait for all promises to resolve, indicating that all samples are loaded
Promise.all(preloadPromises).then(() => {
  console.log('All samples loaded');
  // You can now start using the loaded samples
});

// Function to play a sample from the specified pad
function playSample(padIndex, time) {
  pads[padIndex].player.start(time);
}

// Method to load a sample into the specified pad
function loadSample(padIndex, sampleUrl) {
  if (pads[padIndex].player) {
    pads[padIndex].player.dispose();
  }
  pads[padIndex].player = new Tone.Player(sampleUrl).toDestination();
}


// Create an array of pad elements
const padElements = Array(16).fill(null).map((_, i) => document.getElementById(`pad${i}`));

  // Attach click listeners to the pads
  padElements.forEach((padElement, i) => {
    padElement.addEventListener('mousedown', (e) => {
      if (e.shiftKey) {
        // Open file browser to select and load a sample
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.onchange = (event) => {
          const file = event.target.files[0];
          const url = URL.createObjectURL(file);
          loadSample(i, url);
        };
        input.click();
      } else {
        // Play the sample
        playSample(i);
        // Get the current time position in Bars:Beats:Sixteenths
        const currentTimeInBBS = getCurrentPositionInBBS();
        // Get the corresponding name for the pad (now retrieved from the pads array)
        const padNameValue = pads[i].name;
        // Add a new event to the part at the current time
        if (recordMode) {
          // Add a new event to the part at the current time
          addEventToPart(currentTimeInBBS, padNameValue);
        }
        // Check if delete mode is active
        // else if (deleteMode) {
        //   const padNameValue = pads[i].name;
        //   console.log("Delete mode active for pad:", padNameValue); // Print pad name value
        //   removeEventFromPart(padNameValue);
        // }
      }
    });
  });

// =========================== Pad Banks ============================= //

document.querySelectorAll('input[name="bank"]').forEach((radio) => {
  radio.addEventListener('change', (e) => {
    const bank = e.target.value;

    // Hide both banks first
    document.getElementById('bank0').classList.add('hidden');
    document.getElementById('bank1').classList.add('hidden');

    // Show the selected bank
    document.getElementById(`bank${bank}`).classList.remove('hidden');
  });
});

// Initially set the state based on the default checked radio button
document.querySelector('input[name="bank"]:checked').dispatchEvent(new Event('change'));


// =========================== Tone.Part ================================= //

// Create a part
const part = new Tone.Part((time, padNameValue) => {
  const padIndex = pads.findIndex(pad => pad.name === padNameValue);
  playSample(padIndex, time); // Pass the time parameter
});

// Enable looping for the part
part.loop = true;

// Function to set the part length
function setPartLength() {
  const measures = partLengthInput.value;
  part.loopEnd = `${measures}m`;
  metronomePart.loopEnd = `${measures}m`;
}

setPartLength();

function getCurrentPositionInBBS() {
  const position = Tone.Transport.position;
  const positionInSeconds = Tone.Time(position).toSeconds() - Tone.Time(part.loopStart).toSeconds();
  const loopEnd = part.loopEnd;
  const loopLength = Tone.Time(loopEnd).toSeconds() - Tone.Time(part.loopStart).toSeconds();
  const positionInLoopInSeconds = positionInSeconds % loopLength;
  return Tone.Time(positionInLoopInSeconds).toBarsBeatsSixteenths();
}

// =========================== RECORDING ================================= //

let recordMode = false;

// Record Button Event Listener
recordButton.addEventListener('click', () => {
  recordMode = !recordMode;
  if (recordMode) {
    recordButton.textContent = "Recording";
    recordButton.classList.add('recordModeOn');
    deleteMode = false;
    deleteButton.textContent = "Erase";
    deleteButton.classList.remove('deleteModeOn');
  } else {
    recordButton.textContent = "Record";
    recordButton.classList.remove('recordModeOn');
  }

  // Start playback if record mode is enabled and playback is stopped
  if (recordMode && Tone.Transport.state !== "started") {
    startPlayback();
  }
});

// Function to add an event to the part
function addEventToPart(time, padNameValue) {
  // Find the padIndex corresponding to the padNameValue
  const padIndex = pads.findIndex(pad => pad.name === padNameValue);

  // Create a Tone.Time object from the input time
  const toneTime = new Tone.Time(time);
  // Quantize the Tone.Time object using the selected quantize value
  const quantizedValue = toneTime.quantize(quantizeValue);
  const quantizedTimeInBBS = new Tone.Time(quantizedValue).toBarsBeatsSixteenths();

  // Remove existing events at the same quantized time and padIndex
  part.remove(quantizedValue, padNameValue);
  // Add the event to the part at the quantized time
  part.add(quantizedValue, padNameValue);

  // Log the recorded events
  // console.log(`Original Time: ${time}, Quantized Time: ${quantizedTimeInBBS}`);
}

// =========================== ERASE & DELETE ================================ //

// let deleteMode = false;

// // Event listener to toggle delete mode
// deleteButton.addEventListener('click', () => {
//   deleteMode = !deleteMode;
//   if (deleteMode) {
//     deleteButton.textContent = "Erase Pad";
//     deleteButton.classList.add('deleteModeOn');
//     recordMode = false;
//     recordButton.textContent = 'Record';
//     recordButton.classList.remove('recordModeOn');// Add the class when deleteMode is on
//   } else {
//     deleteButton.textContent = "Erase";
//     deleteButton.classList.remove('deleteModeOn'); // Remove the class when deleteMode is off
//   }
// });

// Function to Remove All Events
function removeAllEventsFromPart() {
  part.clear(); // Removes all the events from the part
}

// =========================== SET TEMPO ================================= //

tempoInput.addEventListener('change', (e) => {
  let value = parseInt(e.target.value, 10);

  // Clamp the value to the allowed range
  if (value < 40) value = 40;
  if (value > 240) value = 240;

  // Update the input element with the clamped value
  e.target.value = value;
});

// Function to set the tempo
function setTempo() {
  const bpm = tempoInput.value;
  Tone.Transport.bpm.value = bpm;
}

function debounce(func, delay) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(function() {
      func.apply(context, args);
    }, delay);
  };
}

setTempo();

// =========================== PLAYBACK ================================= //

// Function to start playback
function startPlayback() {
  Tone.start();
  Tone.Transport.start();
  part.start(0);
  metronomePart.start(0);
  playStopButton.textContent = "Stop";
  playStopButton.classList.add('playModeOn');
}

// Function to toggle playback
function togglePlayback() {
  Tone.start();
  if (Tone.Transport.state === "started") {
    Tone.Transport.stop();
    part.stop(0);
    metronomePart.stop(0);
    playStopButton.textContent = "Play";
    playStopButton.classList.remove('playModeOn');
    // Turn off record mode when playback is stopped
    recordMode = false;
    recordButton.textContent = 'Record';
    recordButton.classList.remove('recordModeOn');// Update the record button state
  } else {
    startPlayback();
  }
}

// =========================== CLOCK DISPLAY ================================= //

// Function to pad a number with leading zeros
function padNumber(number) {
  return number.toString().padStart(2, '0');
}

// Function to update the counter display
function updateCounterDisplay(time) {
  const position = Tone.Transport.position;
  const positionInSeconds = Tone.Time(position).toSeconds() - Tone.Time(part.loopStart).toSeconds();
  const loopEnd = part.loopEnd;
  const loopLength = Tone.Time(loopEnd).toSeconds() - Tone.Time(part.loopStart).toSeconds();
  const positionInLoopInSeconds = positionInSeconds % loopLength;
  const positionInLoopInBBS = Tone.Time(positionInLoopInSeconds).toBarsBeatsSixteenths();
  counterDisplay.innerText = formatTime(positionInLoopInBBS);
}
// Function to format the time in BBS format
function formatTime(position) {
  const parts = position.split(':');
  const bars = padNumber(parseInt(parts[0]) + 1);
  const beats = padNumber(parseInt(parts[1]) + 1);
  const sixteenths = padNumber(parseInt(parts[2]) + 1);
  return `${bars}:${beats}:${sixteenths}`;
}

// Schedule the counter display update every sixteenth note
Tone.Transport.scheduleRepeat(updateCounterDisplay, '16n');

// =========================== KEY MAP ================================= //

let activeBank = 0; // Keep track of the active bank (0 for Bank A, 1 for Bank B)
let activeMode = 0; // Keep track of the active mode (0 for "Tune", 1 for "Mix")

// Listen for changes to the bank radio buttons
document.querySelectorAll('input[name="bank"]').forEach((radio, index) => {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      activeBank = index; // Update the active bank
    }
  });
});

function debounce(func, delay) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(function() {
      func.apply(context, args);
    }, delay);
  };
}

const debouncedKeydown = debounce(function(event) {
    switch(event.key) {
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
    case '8':
    // Trigger a mousedown event on the corresponding pad element
      const padIndex = parseInt(event.key) - 1 + (activeBank * 8); // Add 8 if activeBank is 1;
      const padElement = document.getElementById(`pad${padIndex}`);
      padElement.dispatchEvent(new Event('mousedown'));
      break;        
    // Add more cases for other keys //
    case ' ':
      togglePlayback();
      break;
    case 'r':
      recordButton.click();
      break;
    case 'e':
      deleteButton.click(); // erase all selected pad notes
      break;
    case 'd': // Clear entire sequence
      eraseAllButton.click();
      break;
    case 'm':// toggle metronome
      muteButton.click();
      break;
    case '`': // toggle Pad Bank
      activeBank = (activeBank === 0) ? 1 : 0;
      // Update the radio button
      const radio = document.querySelector(`input[name="bank"][value="${activeBank}"]`);
      radio.checked = true;
      radio.dispatchEvent(new Event('change'));
      break;
    case '/': // toggle Mode Switch
      // Toggle active mode
      activeMode = (activeMode === 0) ? 1 : 0;
      // Update the radio button
      const modeRadio = document.querySelector(`input[name="mode"][value="${activeMode === 0 ? 'Tune' : 'Mix'}"]`);
      modeRadio.checked = true;
      modeRadio.dispatchEvent(new Event('change'));
      break;
  }
}, 5);

let keys = {};

document.addEventListener('keydown', function(event) {
  if (keys[event.key]) {
    // The key is already being pressed, so ignore this event
    return;
  }
  keys[event.key] = true;
  debouncedKeydown(event); // Use the debounced function here
});

document.addEventListener('keyup', function(event) {
  keys[event.key] = false; // The key is no longer being pressed
  event.preventDefault();
});

// =========================== SLIDERS ================================= //

// Get the sliders
const pitchSliders = document.querySelectorAll('.pitch-slider');
const volumeSliders = document.querySelectorAll('.volume-slider');

// Add event listeners
pitchSliders.forEach((slider, index) => {
  slider.addEventListener('input', (e) => {
    pads[index].player.playbackRate = e.target.value;
  });
});

volumeSliders.forEach((slider, index) => {
  slider.addEventListener('input', (e) => {
    const linearVolume = parseFloat(e.target.value);
    const dbVolume = Tone.gainToDb(linearVolume);
    pads[index].player.volume.value = dbVolume;
  });
});

document.querySelectorAll('input[name="mode"]').forEach((radio) => {
  radio.addEventListener('change', (e) => {
    const mode = e.target.value;

    const pitchSliders = document.querySelectorAll('.pitch-slider');
    const volumeSliders = document.querySelectorAll('.volume-slider');

    if (mode === 'Tune') {
      pitchSliders.forEach((slider) => slider.classList.remove('hidden'));
      volumeSliders.forEach((slider) => slider.classList.add('hidden'));
    } else if (mode === 'Mix') {
      pitchSliders.forEach((slider) => slider.classList.add('hidden'));
      volumeSliders.forEach((slider) => slider.classList.remove('hidden'));
    }
  });
});

// Initially set the state based on the default checked radio button
document.querySelector('input[name="mode"]:checked').dispatchEvent(new Event('change'));

// =========================== END ================================= //