const { app, BrowserWindow, ipcMain } = require('electron');
const jetpack = require('fs-jetpack');
const path = require('path');
const axios = require('axios');
const { createObjectCsvWriter } = require('csv-writer');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
app.allowRendererProcessReuse = true;
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true
        }
    });

    mainWindow.loadFile('src/index.html');
    mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.on('file-selected', async (event, filePath) => {
    try {
        const fileName = path.basename(filePath);
        const baseName = path.basename(filePath, path.extname(filePath));
        const extension = path.extname(filePath);

        const uploadFolderPath = jetpack.path(__dirname, 'uploads');
        jetpack.dir(uploadFolderPath);
        
        const duploadFolderPath = jetpack.path(uploadFolderPath, 'dupload');
        jetpack.dir(duploadFolderPath);

        const uniqueFileName = generateUniqueFileName(uploadFolderPath, baseName, extension);
        const destinationPath = jetpack.path(uploadFolderPath, uniqueFileName);
        jetpack.copy(filePath, destinationPath);

        console.log('File saved successfully');

        await processAndFetchPanData(destinationPath);
    } catch (err) {
        console.error(err);
    }
});

async function processAndFetchPanData(filePath) {
    const xlsx = require('xlsx');
    const uploadFolderPath = jetpack.path(__dirname, 'uploads');

    const workbook = xlsx.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    const uniqueCsvFileName = generateUniqueFileName(uploadFolderPath, 'pan_details', '.csv');
    const csvPath = jetpack.path(uploadFolderPath, 'dupload', uniqueCsvFileName);

    const panDetailsArray = [];

    await Promise.all(rows.map(async (row) => {
        const panNumber = row[0];

        if (panNumber) {
            console.log('Extracted PAN Number:', panNumber);

            try {
                const panDetails = await fetchPanDetailsFromApi(panNumber);
                console.log('PAN Details:', panDetails);

                panDetailsArray.push({
                    panNumber: panNumber,
                    clientName: panDetails?.data?.clientName,
                    clientStatus: panDetails?.data?.clientStatus,
                    requestid: panDetails?.requestid,
                    sequenceid: panDetails.sequenceId

                });
            } catch (error) {
                console.error(`Error fetching details for ${panNumber}:`, error.message);
            }
        }
    }));

    const csvWriter = createObjectCsvWriter({
        path: csvPath,
        header: [
            { id: 'panNumber', title: 'PAN Number' },
            { id: 'clientName', title: 'Client Name' },
            { id: 'clientStatus', title: 'Client Status' },
            { id: 'sequenceid', title: 'Sequence Id'},
            { id: 'requestid', title: 'Request Id'}
        ]
    });

    await csvWriter.writeRecords(panDetailsArray);
    console.log('CSV file saved successfully:', uniqueCsvFileName);
}


async function fetchPanDetailsFromApi(panNumber) {
    const apiUrl = 'https://api.rpacpc.com/services/get-pan-details';
    const headers = {
        secretkey: 'e5b45d31-7a63-4dfa-a7f1-c8fc89192fe8',
        token: 'HZqJwTTU+6SnoILGiwfD2h6Lgpp977mCfFJ4+XrnVvUDKENPJ0WjgRGO0uv9NODrf7KjCl6d34LQJOvn8w/aih79BZHUU6zKzfcoQDLBHkAHaUceuj1AUFRwD6kdoXZLSaZofXaeNXH2P7bcfGvVjM0kW7VS3bmljOlKz0wC2K5lhXs5eeXuKK7IAIGPNoXeXqU8UTaJtdQk4B3N4sM9v/R/6zuvMSz2t6oJQRTj4geWs9nKW6StVxZk2JzwGR1bw2cqWh00lwXmOCKmOxNhdDmMfQBQVXtH6qrBX2FykV162zMzzFMIoBOxdqBdCq0abjZH+hzQpIBUlmFDAIJFS/XL3I3/Or5fD3wNvt4Il5MhZqYCIwIFg2yH9hNvbPQ7gaNvz1zsLf0CBrFqUiw9P2JV3laBgkKHj26ooq9cj8mEy2EEn4YduF3wNcnuuLrl'
    };

    try {
        const response = await axios.post(apiUrl, { pancard: panNumber }, {
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        });

        if (response.status !== 200) {
            console.error('API Error Response:', {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                body: response.data
            });
            throw new Error('API Error');
        }

        return response.data;
    } catch (error) {
        console.error('Fetch Error:', error);
        throw new Error('API Error');
    }
}

function generateUniqueFileName(folderPath, baseName, extension) {
    const timestamp = new Date().getTime(); // Get current timestamp
    const randomString = Math.random().toString(36).substring(7); // Generate a random string

    const uniqueName = `${baseName}_${timestamp}_${randomString}${extension}`;
    return uniqueName;
}

