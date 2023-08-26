const fs = require('fs');
const { ipcRenderer } = require('electron');

const uploadButton = document.getElementById('upload');
const fileInput = document.getElementById('fileInput');

uploadButton.addEventListener('click', () => {
  fileInput.click(); // Programmatically trigger file input click
});

fileInput.addEventListener('change', (event) => {
  const selectedFile = event.target.files[0];
  if (selectedFile) {
    ipcRenderer.send('file-selected', selectedFile.path);
  }
});


if (global.filepath && !file.canceled) {
  fs.readFile(global.filepath, { encoding: 'utf-8' }, function (err, data) {
    if (!err) {
      console.log('received data: ' + data);
      // Save the data to local storage
      localStorage.setItem('uploadedFileData', data);
    } else {
      console.log(err);
    }
  });
}

