const express = require('express');
const fs = require('fs');
const app = express();
app.use(express.json()); // Enable JSON body parsing

// MAC addresses to compare against
const macAddress1 = 'AA:BB:CC:DD:EE:FF';
const macAddress2 = '11:22:33:44:55:66';

// API route that responds with JSON object based on MAC address
app.get('/api/zones', (req, res) => {
  const clientMacAddress = req.headers['mac-address']; // Assuming the MAC address is passed as a custom header 'mac-address'
  
  // Check the MAC address against the hardcoded values
  if (clientMacAddress === macAddress1) {
    sendResponse('zones1.json', res);
  } else if (clientMacAddress === macAddress2) {
    sendResponse('zones2.json', res);
  } else {
    res.status(404).json({ error: 'MAC address not found' });
  }
});

// API route to update zones1.json
app.put('/api/zones/1', (req, res) => {
  const zonesData = req.body;
  updateZones('zones1.json', zonesData, res);
});

// API route to update zones2.json
app.put('/api/zones/2', (req, res) => {
  const zonesData = req.body;
  updateZones('zones2.json', zonesData, res);
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
      const zones = JSON.parse(data);
      res.json(zones);
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
}

// Helper function to update the JSON file
function updateZones(filename, zonesData, res) {
  const jsonData = JSON.stringify(zonesData);
  
  fs.writeFile(filename, jsonData, 'utf8', (err) => {
    if (err) {
      console.error('Error updating zones file:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    
    res.json({ message: `File ${filename} updated successfully` });
  });
}

// Start the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
