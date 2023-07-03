/* This server provides an api that delivers irrigation durations as well as an api
that can be used to update those durations. It also provides updated firmware.
*/

// Start this server with the following command:
// node index.js

// If conflicting process is running, use this:
// sudo lsof -i :3000
// kill -9 <PID>
const express = require('express');
const { networkInterfaces } = require('os');
const path = require('path');
const fs = require('fs');
 
const app = express();
app.use(express.json()); // Enable JSON body parsing
const nets = networkInterfaces();

// MAC addresses to compare against
const macAddress1 = 'C8:F0:9E:4E:10:8C';
const macAddress2 = '11:22:33:44:55:66';

// Server port
const PORT = 3000;
 
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

// API route that responds with JSON object based on MAC address
app.get('/api/manifolds', (req, res) => {
    const clientMacAddress = req.headers['mac-address']; // Assuming the MAC address is passed as a custom header 'mac-address'
    
    // Check the MAC address against the hardcoded values
    if (clientMacAddress === macAddress1) {
      sendResponse('manifold1.json', res);
      console.log("Response sent to Manifold 1 at MAC address: ", macAddress1)
    } else if (clientMacAddress === macAddress2) {
      sendResponse('manifold2.json', res);
      console.log("Response sent to Manifold 2 at MAC address: ", macAddress1)
    } else {
      res.status(404).json({ error: 'MAC address not found' });
      console.log("Could not resolve MAC address: ", req.headers['mac-address']);
    }
});

// API route to update manifold1.json
app.put('/api/manifolds/1', (req, res) => {
    const manifoldData = req.body;
    updateZones('manifold1.json', manifoldData, res);
  });
  
// API route to update zones2.json
app.put('/api/manifolds/2', (req, res) => {
  const manifoldData = req.body;
  updateZones('manifold2.json', manifoldData, res);
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
