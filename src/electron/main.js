const { app, ipcMain, BrowserWindow } = require('electron');
let fs = require('fs');

let window;

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = '0';

const ipc = require('electron').ipcMain;

function createWindow () {

    window = new BrowserWindow({
        autoHideMenuBar: true,
        title: 'Kafka Viewer',
        webPreferences: {
            webSecurity: false
        }
    });

    window.loadURL(`file://${__dirname}/../../dist/angular/index.html`);

    // win.webContents.openDevTools();

    window.maximize();

    window.on('closed', function () {
        window = null;
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('activate', function () {
    if (window === null) {
        createWindow()
    }
});

ipcMain.on("job-runs", async (event, data) => {
    let folder = 'C:\\Users\\glauco_martins\\Downloads\\mocks\\4\\';
    let filename = data.job.url.replace(/.*\/job\//, '') + '.json';
    console.log(filename);
    let response = {
        pipelineId: data.pipelineId,
        jobName: data.job.name,
        jobRuns: fs.readFileSync(folder + filename, 'utf8')
    };
    window.webContents.send('get-file-response', response);
});
