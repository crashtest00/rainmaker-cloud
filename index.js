/* This server provides an api that delivers irrigation durations as well as an api
that can be used to update those durations. It also provides updated firmware.
*/

// Start this server with the following command:
// node index.js

// If conflicting process is running, use this:
// sudo lsof -i :3000
// kill -9 <PID>
const express = require('express');
const morgan = require('morgan');
const { networkInterfaces } = require('os');
const path = require('path');
const fs = require('fs');
const { time } = require('console');
 
const app = express();
app.use(express.json()); // Enable JSON body parsing
const nets = networkInterfaces();

// Server port
const PORT = 3000;

// Create a write stream to the log file
const logStream = fs.createWriteStream('logs.txt', { flags: 'a' });

// Enable JSON body parsing
app.use(express.json());

// Enable logging to console and file using Morgan
app.use(morgan('combined', { stream: logStream }));

// Log requests manually
app.use((req, res, next) => {
  // Log the request details to the console
  console.log(`${req.method} ${req.url}`);
  console.log('Request Headers:', req.headers);
  console.log('Request Body:', req.body);

  // Log the request details to the file
  logStream.write(`${req.method} ${req.url}\n`);
  logStream.write('Request Headers: ' + JSON.stringify(req.headers) + '\n');
  logStream.write('Request Body: ' + JSON.stringify(req.body) + '\n');

  next();
});

app.get('/', (request, response) => response.send('Hello from Rainmaker'));

// API route to handle the /api/getUpdate request
app.get('/api/getUpdate', (req, res) => {
  const filePath = path.join(__dirname, 'currentVersion.json');

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Failed to read currentVersion.json:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    try {
      const versionData = JSON.parse(data);
      res.json(versionData);
      console.log(`JSON was delivered successfully at ${new Date().toLocaleString()}!`)
    } catch (parseError) {
      console.error('Failed to parse currentVersion.json:', parseError);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });
});

// API route that responds with JSON object based on MAC address in manifolds.json
app.get('/api/manifolds', (req, res) => {
    const clientMacAddress = req.headers['mac-address']; // Assuming the MAC address is passed as a custom header 'mac-address'
    
    // Read the data from "manifolds.json" file
    fs.readFile(path.join(__dirname, 'manifolds.json'), 'utf8', (err, data) => {
      if (err) {
        console.error('Failed to read manifolds.json:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      try {
        const manifoldsData = JSON.parse(data);
  
        // Find the manifold with the matching MAC address
        const manifold = manifoldsData.find(manifold => manifold.macAddress === clientMacAddress);
  
        if (manifold) {
          // Respond with the zone data for the matched manifold
          res.json(manifold.zones);
          console.log(`Zone durations sent to ${manifold.manifoldID} at MAC address: ${clientMacAddress}`);
        } else {
          // No matching MAC address found
          res.status(404).json({ error: 'MAC address not found' });
          console.log('Could not resolve MAC address:', clientMacAddress);
        }
      } catch (parseError) {
        console.error('Failed to parse manifolds.json:', parseError);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });
});

// API route to update manifolds.json
app.patch('/api/manifolds/:manifoldID', (req, res) => {
  const manifoldID = req.params.manifoldID;
  const manifoldData = req.body;
  updateManifold(manifoldID, manifoldData, res);
});
  
// Update firmware
app.get('/firmware/:filename', (request, response) => {
  console.log("New download request")
  const filePath = path.join(__dirname, 'currentVersion.json');

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Failed to read currentVersion.json:', err);
      return response.status(500).json({ error: 'Internal Server Error' });
    }

    try {
      const versionData = JSON.parse(data);
      const firmwarePath = versionData.firmware_path;
      const firmwareFileName = path.basename(firmwarePath);

      if (request.params.filename === firmwareFileName) {
        response.download(firmwarePath, firmwareFileName, (err) => {
          if (err) {
            console.error('Problem on downloading firmware:', err);
          } else {
            console.log('Latest firmware was downloaded successfully!');
          }
        });
      } else {
        response.status(404).json({ error: 'File not found' });
      }
    } catch (parseError) {
      console.error('Failed to parse currentVersion.json:', parseError);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  });
});

// Endpoint to calculate time until referenced datetime
app.get('/api/nextrun', (req, res) => {
  // Read the JSON file
  const jsonData = fs.readFileSync('nextRun.json');
  const { datetime } = JSON.parse(jsonData);

  // Calculate the time difference in seconds
  const targetDatetime = new Date(datetime);
  const currentTime = new Date();
  const timeDifferenceSeconds = Math.floor((targetDatetime - currentTime) / 1000);
  // const timeDifferenceSeconds = 2000; // Hack to handle overflowing int on client side
  console.log('Sleeping for %d seconds at %s', timeDifferenceSeconds, currentTime)

  // Return the time difference as an unsigned int
  res.send(timeDifferenceSeconds.toString());
});
 
// Start the server
app.listen(PORT, () => {
    const results = {}; // Or just '{}', an empty object
 
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                results[name].push(net.address);
            }
        }
    }
 
    console.log('Listening on port '+PORT+'\n', results)
});

// Helper function to read and send the JSON response
function sendResponse(filename, res) {
  fs.readFile(filename, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading zones file:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    
    try {
      const manifold = JSON.parse(data);
      res.json(manifold);
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
}

// Helper function to update the JSON file
function updateZones(filename, manifoldData, res) {
  const jsonData = JSON.stringify(manifoldData);
  
  fs.writeFile(filename, jsonData, 'utf8', (err) => {
    if (err) {
      console.error('Error updating zones file:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    
    res.json({ message: `File ${filename} updated successfully` });
  });
}

// Helper function to update the manifolds.json file
function updateManifold(manifoldID, manifoldData, res) {
  // Read the existing data from manifolds.json
  fs.readFile('manifolds.json', 'utf8', (err, data) => {
    if (err) {
      console.error('Failed to read manifolds.json:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    try {
      // Parse the JSON data from manifolds.json
      const jsonData = JSON.parse(data);

      // Find the index of the manifold with the given manifoldID
      const index = jsonData.findIndex(manifold => manifold.manifoldID === manifoldID);

      if (index === -1) {
        // Manifold with the given ID not found
        return res.status(404).json({ error: 'Manifold not found' });
      }

      // Update the zones data for the manifold
      jsonData[index].zones = manifoldData.zones;

      // Convert the updated JSON data back to string
      const updatedData = JSON.stringify(jsonData, null, 2);

      // Write the updated data back to manifolds.json
      fs.writeFile('manifolds.json', updatedData, 'utf8', err => {
        if (err) {
          console.error('Failed to write manifolds.json:', err);
          return res.status(500).json({ error: 'Internal Server Error' });
        }

        console.log(`Manifold ${manifoldID} data updated successfully`);
        res.json({ message: 'Manifold data updated successfully' });
      });
    } catch (parseError) {
      console.error('Failed to parse manifolds.json:', parseError);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });
}
