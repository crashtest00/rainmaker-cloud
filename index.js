const express = require('express');
const { networkInterfaces } = require('os');
const path = require('path');
 
const app = express();
const nets = networkInterfaces();
 
// Server port
const PORT = 3000;
 
app.get('/', (request, response) => response.send('Hello from Rainmaker'));

let downloadCounter = 1;
app.get('/firmware/httpUpdateNew.bin', (request, response) => {
    response.download(path.join(__dirname, 'firmware/httpUpdateNew.bin'), 'httpUpdateNew.bin', (err)=>{
        if (err) {
            console.error("Problem on download firmware: ", err)
        }else{
            downloadCounter++;
        }
    });
    console.log('Your file has been downloaded '+downloadCounter+' times!')
})

let downloadFSCounter = 1;
app.get('/filesystem/httpUpdateNewFS.bin', (request, response) => {
    response.download(path.join(__dirname, 'filesystem/httpUpdateNewFS.bin'), 'httpUpdateNewFS.bin', (err)=>{
        if (err) {
            console.error("Problem on download filesystem: ", err)
        }else{
            downloadFSCounter++;
        }
    });
    console.log('Your file FS has been downloaded '+downloadFSCounter+' times!')
})
 
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